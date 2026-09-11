/**
 * 成片合成端到端验证：生成两段合成视频 → processVideoMerge 真正合并 → 校验 merged_url 与 episodes 更新。
 * 不依赖外部 API，只依赖本机 ffmpeg（bundled 或系统 PATH 均可）。
 */
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { getFfmpegPath, hasLocalFfmpeg } = require('../src/utils/ffmpegPath');
const videoMergeService = require('../src/services/videoMergeService');

const ffmpeg = getFfmpegPath();
const TEST_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'drama-merge-e2e-'));

function makeClip(name, secs, color) {
  const out = path.join(TEST_ROOT, name);
  const r = spawnSync(ffmpeg, [
    '-y', '-f', 'lavfi', '-i', `color=c=${color}:s=640x360:r=24:d=${secs}`,
    '-f', 'lavfi', '-i', `sine=frequency=440:duration=${secs}`,
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', out,
  ], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  if (r.status !== 0) throw new Error('clip gen failed: ' + r.stderr?.slice(-300));
  return out;
}

function makeDb() {
  const Database = require('better-sqlite3');
  const db = new Database(path.join(TEST_ROOT, 'test.db'));
  const { runMigrationsAndEnsure } = require('../src/db/migrate.js');
  runMigrationsAndEnsure(db);
  const now = new Date().toISOString();
  const epInfo = db.prepare(
    'INSERT INTO episodes (drama_id, episode_number, title, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(1, 1, '第1集', 'draft', now, now);
  return { db, episodeId: epInfo.lastInsertRowid };
}

const logStub = { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} };

test('E2E: processVideoMerge 用 ffmpeg 把两段视频合为一集', async () => {
  assert.ok(hasLocalFfmpeg(), '本机应可解析 ffmpeg');
  const clipA = makeClip('clip_a.mp4', 3, 'red');
  const clipB = makeClip('clip_b.mp4', 4, 'blue');
  const { db, episodeId } = makeDb();

  const scenes = [
    { scene_id: 1, video_url: clipA, duration: 3, order: 0 },
    { scene_id: 2, video_url: clipB, duration: 4, order: 1 },
  ];
  const created = videoMergeService.create(db, logStub, {
    episode_id: episodeId, drama_id: 1, title: '测试剧 - 第1集',
    provider: 'ffmpeg', scenes, merge_options: {},
  });
  const mergeId = created.merge_id || created.id;
  assert.ok(mergeId, 'create 应返回 merge_id');

  // 模拟真实 flow：dramaService.finalizeEpisode 用 setImmediate 异步处理
  await new Promise((resolve) => {
    setImmediate(() => { videoMergeService.processVideoMerge(db, logStub, mergeId, 'http://localhost:5679').then(resolve); });
  });

  const rec = db.prepare('SELECT * FROM video_merges WHERE id = ?').get(mergeId);
  assert.strictEqual(rec.status, 'completed', `merge 状态应 completed，实际: ${rec.status} err=${rec.error_msg}`);
  assert.ok(rec.merged_url, 'merged_url 不应为空');
  assert.strictEqual(rec.duration, 7, '时长应为两段之和 7s');
  // merged_url 相对 storage root（cwd/data/storage）——验证实际文件存在
  const storageRoot = path.join(process.cwd(), 'data', 'storage');
  const mergedAbs = path.join(storageRoot, rec.merged_url.replace(/\//g, path.sep));
  assert.ok(fs.existsSync(mergedAbs), `合并输出文件应存在: ${mergedAbs}`);

  // episodes 应更新 video_url + completed
  const ep = db.prepare('SELECT * FROM episodes WHERE id = ?').get(episodeId);
  assert.strictEqual(ep.status, 'completed', 'episode status 应 completed');
  assert.ok(ep.video_url, 'episode video_url 应被更新');

  // 用 ffprobe 确认合并文件实际时长 ≈ 7s
  const probe = spawnSync(
    require('../src/utils/ffmpegPath').getFfprobePath(),
    ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', mergedAbs],
    { encoding: 'utf8' }
  );
  if (probe.status === 0) {
    const d = parseFloat(probe.stdout.trim());
    assert.ok(Math.abs(d - 7) < 0.5, `合并后视频时长应≈7s，实际 ${d}s`);
  }
});