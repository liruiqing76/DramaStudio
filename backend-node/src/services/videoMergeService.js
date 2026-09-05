const path = require('path');
const fs = require('fs');
const { getFfmpegPath, getFfprobePath, hasLocalFfmpeg } = require('../utils/ffmpegPath');
const storageLayout = require('./storageLayout');

function list(db, query) {
  let sql = 'FROM video_merges WHERE deleted_at IS NULL';
  const params = [];
  if (query.episode_id) {
    sql += ' AND episode_id = ?';
    params.push(query.episode_id);
  }
  if (query.drama_id) {
    sql += ' AND drama_id = ?';
    params.push(query.drama_id);
  }
  const rows = db.prepare('SELECT * ' + sql + ' ORDER BY created_at DESC').all(...params);
  return rows.map(rowToItem);
}

function rowToItem(r) {
  return {
    id: r.id,
    episode_id: r.episode_id,
    drama_id: r.drama_id,
    title: r.title,
    provider: r.provider,
    status: r.status,
    merged_url: r.merged_url,
    duration: r.duration ?? undefined,
    task_id: r.task_id,
    error_msg: r.error_msg ?? undefined,
    created_at: r.created_at,
    completed_at: r.completed_at,
  };
}

function getById(db, id) {
  const r = db.prepare('SELECT * FROM video_merges WHERE id = ? AND deleted_at IS NULL').get(Number(id));
  return r ? rowToItem(r) : null;
}

function create(db, log, req) {
  const now = new Date().toISOString();
  const taskService = require('./taskService');
  const task = taskService.createTask(db, log, 'video_merge', String(req.episode_id || ''));
  const mergeOptionsJson = (() => {
    const o = req.merge_options;
    if (o && typeof o === 'object') return JSON.stringify(o);
    return '{}';
  })();
  const info = db.prepare(
    `INSERT INTO video_merges (episode_id, drama_id, title, provider, model, status, scenes, merge_options, task_id, created_at)
     VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)`
  ).run(
    Number(req.episode_id) || 0,
    Number(req.drama_id) || 0,
    req.title ?? null,
    req.provider || 'ffmpeg',
    req.model ?? null,
    req.scenes ? JSON.stringify(req.scenes) : '[]',
    mergeOptionsJson,
    task.id,
    now
  );
  return { merge_id: info.lastInsertRowid, task_id: task.id, ...getById(db, info.lastInsertRowid) };
}

function deleteById(db, log, id) {
  const now = new Date().toISOString();
  const result = db.prepare('UPDATE video_merges SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL').run(now, Number(id));
  return result.changes > 0;
}

/** 获取 storage 根目录（绝对路径） */
function getStorageRoot() {
  const loadConfig = require('../config').loadConfig;
  const cfg = loadConfig();
  const p = cfg.storage?.local_path || './data/storage';
  return path.isAbsolute(p) ? p : path.join(process.cwd(), p);
}

/** 将 video_url 解析为本地文件路径，或下载到 temp 返回路径 */
async function resolveVideoToLocalPath(videoUrl, baseUrl, storageRoot, tempDir, index, log) {
  if (!videoUrl || typeof videoUrl !== 'string') return null;
  const u = videoUrl.trim();
  // 1) URL 以 baseUrl 开头（如 http://localhost:5679/static）-> 对应 storageRoot 下相对路径
  if (baseUrl && (u.startsWith(baseUrl) || u.startsWith(baseUrl.replace(/\/$/, '')))) {
    const base = baseUrl.replace(/\/$/, '');
    const rel = u.startsWith(base + '/') ? u.slice(base.length + 1) : u.slice(base.length).replace(/^\//, '');
    if (rel && !rel.startsWith('http')) {
      const localPath = path.join(storageRoot, rel.replace(/\//g, path.sep));
      if (fs.existsSync(localPath)) {
        log.info('Video merge: using local static file', { index, path: localPath });
        return localPath;
      }
    }
  }
  // 2) 已是本地绝对路径且存在
  if (path.isAbsolute(u) && fs.existsSync(u)) {
    log.info('Video merge: using absolute path', { index, path: u });
    return u;
  }
  // 3) 相对路径（相对 storageRoot）
  if (!u.startsWith('http://') && !u.startsWith('https://')) {
    const localPath = path.join(storageRoot, u.replace(/^\//, '').replace(/\//g, path.sep));
    if (fs.existsSync(localPath)) {
      log.info('Video merge: using relative path', { index, path: localPath });
      return localPath;
    }
  }
  // 4) 远程 URL：下载到 temp
  const ext = u.includes('.mp4') ? '.mp4' : u.includes('.webm') ? '.webm' : '.mp4';
  const destPath = path.join(tempDir, `dl_${Date.now()}_${index}${ext}`);
  try {
    const res = await fetch(u, { method: 'GET' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(destPath, buf);
    log.info('Video merge: downloaded to temp', { index, dest: destPath });
    return destPath;
  } catch (e) {
    log.warn('Video merge: download failed', { index, url: u, error: e.message });
    return null;
  }
}

/** 使用 ffmpeg concat 合并多个视频文件 */
function runFfmpegConcat(localPaths, outputPath, log) {
  const ffmpegBin = getFfmpegPath();
  const isWin = process.platform === 'win32';
  const listFile = path.join(path.dirname(outputPath), `concat_list_${Date.now()}.txt`);
  try {
    const lines = localPaths.map((p) => {
      const normalized = p.replace(/\\/g, '/');
      return `file '${normalized.replace(/'/g, "'\\''")}'`;
    });
    fs.writeFileSync(listFile, lines.join('\n'), 'utf8');
    const { spawnSync } = require('child_process');
    const args = [
      '-f', 'concat',
      '-safe', '0',
      '-i', listFile,
      '-c', 'copy',
      '-y',
      outputPath,
    ];
    const result = spawnSync(ffmpegBin, args, { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 });
    if (result.error) {
      log.warn('Video merge: ffmpeg spawn error', { error: result.error.message });
      return false;
    }
    if (result.status !== 0) {
      log.warn('Video merge: ffmpeg failed', { stderr: result.stderr?.slice(-500) });
      return false;
    }
    return true;
  } finally {
    try { if (fs.existsSync(listFile)) fs.unlinkSync(listFile); } catch (_) {}
  }
}

/**
 * 异步处理视频合成：优先使用 ffmpeg 真正合并多段视频；失败或无 ffmpeg 时用首段作为 merged_url。
 */
async function processVideoMerge(db, log, mergeId, baseUrl) {
  const r = db.prepare('SELECT * FROM video_merges WHERE id = ? AND deleted_at IS NULL').get(mergeId);
  if (!r) return;
  const taskId = r.task_id;
  const episodeId = r.episode_id;
  let scenes = [];
  try {
    scenes = JSON.parse(r.scenes || '[]');
  } catch (_) {
    log.warn('video merge parse scenes failed', { merge_id: mergeId });
  }
  const now = new Date().toISOString();
  db.prepare('UPDATE video_merges SET status = ? WHERE id = ?').run('processing', mergeId);
  const taskService = require('./taskService');
  if (scenes.length === 0) {
    db.prepare('UPDATE video_merges SET status = ?, error_msg = ? WHERE id = ?').run('failed', '无有效视频片段', mergeId);
    if (taskId) taskService.updateTaskError(db, taskId, '无有效视频片段');
    return;
  }
  const first = scenes[0];
  const mergedUrlFallback = first && first.video_url ? first.video_url : null;
  if (!mergedUrlFallback) {
    db.prepare('UPDATE video_merges SET status = ?, error_msg = ? WHERE id = ?').run('failed', '首段无视频地址', mergeId);
    if (taskId) taskService.updateTaskError(db, taskId, '首段无视频地址');
    return;
  }

  const totalDuration = scenes.reduce((sum, s) => sum + (Number(s.duration) || 0), 0);
  const storageRoot = getStorageRoot();
  const tempDir = path.join(require('os').tmpdir(), 'drama-video-merge');
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

  const localPaths = [];
  const toCleanup = [];
  for (let i = 0; i < scenes.length; i++) {
    const p = await resolveVideoToLocalPath(
      scenes[i].video_url,
      baseUrl,
      storageRoot,
      tempDir,
      i,
      log
    );
    if (p) {
      localPaths.push(p);
      if (p.startsWith(tempDir)) toCleanup.push(p);
    }
  }

  const ffmpegAvailable = hasLocalFfmpeg();
  log.info('Video merge: ffmpeg check', {
    merge_id: mergeId,
    has_ffmpeg: ffmpegAvailable,
    ffmpeg_path: getFfmpegPath(),
    local_video_count: localPaths.length,
    cwd: process.cwd(),
  });

  let mergedRelativePath = null;
  if (localPaths.length > 0 && ffmpegAvailable && localPaths.length <= 100) {
    const projectSubdir = storageLayout.getProjectStorageSubdir(db, r.drama_id);
    const sub = projectSubdir && String(projectSubdir).trim();
    const mergedDir = sub
      ? path.join(storageRoot, sub, 'videos', 'merged')
      : path.join(storageRoot, 'videos', 'merged');
    if (!fs.existsSync(mergedDir)) fs.mkdirSync(mergedDir, { recursive: true });
    const outputFileName = `merged_${Date.now()}.mp4`;
    const outputPath = path.join(mergedDir, outputFileName);
    const ok = runFfmpegConcat(localPaths, outputPath, log);
    if (ok && fs.existsSync(outputPath)) {
      mergedRelativePath = sub
        ? path.join(sub, 'videos', 'merged', outputFileName).replace(/\\/g, '/')
        : path.join('videos', 'merged', outputFileName).replace(/\\/g, '/');
      log.info('Video merge completed (ffmpeg)', { merge_id: mergeId, episode_id: episodeId, output: mergedRelativePath });
    }
  }

  let mergeOpts = {};
  try {
    mergeOpts = JSON.parse(r.merge_options || '{}');
  } catch (_) {
    mergeOpts = {};
  }
  const postNeed =
    !!mergeOpts.burn_narration_subtitles
    || !!mergeOpts.burn_dialogue_audio
    || !!(mergeOpts.watermark_text && String(mergeOpts.watermark_text).trim());
  if (mergedRelativePath && ffmpegAvailable && postNeed) {
    const mergedAbsPath = path.join(storageRoot, mergedRelativePath.replace(/\//g, path.sep));
    if (fs.existsSync(mergedAbsPath)) {
      const mergedPP = require('./mergedEpisodePostProcess');
      const post = await mergedPP.runMergedEpisodePostProcess(db, log, {
        mergedAbsPath,
        storageRoot,
        scenes,
        episodeId,
        mergeOpts,
      });
      if (post.ok && post.relativePath) {
        mergedRelativePath = post.relativePath;
        log.info('Video merge: merged episode post-process', { merge_id: mergeId, out: mergedRelativePath });
      } else if (post.error && post.error !== 'NO_POST_OPTS') {
        log.warn('Video merge: post-process skipped', { merge_id: mergeId, err: post.error });
      }
    }
  }

  for (const p of toCleanup) {
    try { if (fs.existsSync(p)) fs.unlinkSync(p); } catch (_) {}
  }

  const finalMergedUrl = mergedRelativePath || mergedUrlFallback;
  db.prepare(
    'UPDATE video_merges SET status = ?, merged_url = ?, duration = ?, completed_at = ?, error_msg = ? WHERE id = ?'
  ).run('completed', finalMergedUrl, Math.round(totalDuration) || null, now, null, mergeId);
  db.prepare('UPDATE episodes SET video_url = ?, status = ?, updated_at = ? WHERE id = ?').run(finalMergedUrl, 'completed', now, episodeId);
  if (taskId) {
    taskService.updateTaskResult(db, taskId, { merge_id: mergeId, video_url: finalMergedUrl, duration: Math.round(totalDuration) });
  }
  if (!mergedRelativePath) {
    log.info('Video merge completed (first-clip fallback)', { merge_id: mergeId, episode_id: episodeId });
  }
}

// ════════════════════════════════════════════════════════════
// Week 2: 视频时间线编辑器
// ════════════════════════════════════════════════════════════

const VALID_TRANSITIONS = new Set(['cut', 'fade', 'black']);

/**
 * 预览可合并的视频列表：返回分镜视频 + 时长/缩略图
 */
async function previewMerge(db, log, dramaId, episodeId) {
  let sql = `
    SELECT vg.id, vg.video_url, vg.local_path, vg.storyboard_id,
           sb.title as storyboard_title, sb.storyboard_number,
           sb.image_url as thumbnail, sb.duration as sb_duration
    FROM video_generations vg
    LEFT JOIN storyboards sb ON vg.storyboard_id = sb.id
    WHERE vg.deleted_at IS NULL AND vg.status = 'completed'
  `;
  const params = [];
  if (episodeId) {
    sql += ' AND sb.episode_id = ?';
    params.push(Number(episodeId));
  } else if (dramaId) {
    sql += ' AND vg.drama_id = ?';
    params.push(Number(dramaId));
  }
  sql += ' ORDER BY sb.storyboard_number ASC, vg.created_at ASC';

  const rows = db.prepare(sql).all(...params);

  // 获取时长
  const ffmpegAvailable = hasLocalFfmpeg();
  const ffprobePath = getFfprobePath();
  const items = [];
  for (const row of rows) {
    const videoPath = resolveLocalVideoPath(row.video_url, row.local_path);
    let duration = row.sb_duration || 0;
    if (ffmpegAvailable && videoPath && fs.existsSync(videoPath)) {
      duration = await getVideoDuration(ffprobePath, videoPath) || duration;
    }
    items.push({
      id: row.id,
      video_url: row.video_url,
      local_path: row.local_path,
      thumbnail: row.thumbnail,
      storyboard_title: row.storyboard_title,
      storyboard_number: row.storyboard_number,
      duration,
    });
  }
  return items;
}

/**
 * 创建带时间线的合成任务
 */
function createWithTimeline(db, log, req) {
  const now = new Date().toISOString();
  const taskService = require('./taskService');
  const task = taskService.createTask(db, log, 'video_merge_timeline', String(req.episode_id || ''));

  const segmentsJson = req.segments && Array.isArray(req.segments)
    ? JSON.stringify(req.segments)
    : null;

  const info = db.prepare(
    `INSERT INTO video_merges (episode_id, drama_id, title, provider, model, status, scenes, merge_options, segments_json, task_id, created_at)
     VALUES (?, ?, ?, ?, ?, 'pending', ?, '{}', ?, ?, ?)`
  ).run(
    Number(req.episode_id) || 0,
    Number(req.drama_id) || 0,
    req.title ?? '时间线合成',
    req.provider || 'ffmpeg',
    req.model ?? null,
    req.scenes ? JSON.stringify(req.scenes) : '[]',
    segmentsJson,
    task.id,
    now
  );

  // 异步处理
  const mergeId = info.lastInsertRowid;
  setImmediate(async () => {
    try {
      const result = await mergeWithTimeline(db, log, mergeId, req);
      log.info('[时间线合成] 完成', { merge_id: mergeId, result });
    } catch (err) {
      log.error('[时间线合成] 失败', { merge_id: mergeId, error: err.message });
      db.prepare('UPDATE video_merges SET status = ?, error_msg = ? WHERE id = ?')
        .run('failed', err.message, mergeId);
      taskService.updateTaskError(db, task.id, err.message);
    }
  });

  return { merge_id: mergeId, task_id: task.id, ...getById(db, mergeId) };
}

/**
 * 带时间线的视频合成：
 * 1. 对每个 segment 用 ffmpeg 裁剪
 * 2. 应用转场效果（fade/black）
 * 3. concat 合并
 */
async function mergeWithTimeline(db, log, mergeId, req) {
  const r = db.prepare('SELECT * FROM video_merges WHERE id = ? AND deleted_at IS NULL').get(mergeId);
  if (!r) throw new Error('合成任务不存在');

  let segments = [];
  try {
    segments = JSON.parse(r.segments_json || req.segments || '[]');
  } catch (_) {
    segments = req.segments || [];
  }

  if (!Array.isArray(segments) || segments.length === 0) {
    // 无 segments 时走原 merge 逻辑
    log.info('[时间线合成] 无 segments，走原 merge 逻辑', { merge_id: mergeId });
    return processVideoMerge(db, log, mergeId, req.baseUrl);
  }

  const now = new Date().toISOString();
  db.prepare('UPDATE video_merges SET status = ? WHERE id = ?').run('processing', mergeId);
  const taskService = require('./taskService');

  const storageRoot = getStorageRoot();
  const tempDir = path.join(require('os').tmpdir(), 'drama-timeline-merge');
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

  const projectSubdir = storageLayout.getProjectStorageSubdir(db, r.drama_id);
  const sub = projectSubdir && String(projectSubdir).trim();
  const mergedDir = sub
    ? path.join(storageRoot, sub, 'videos', 'timeline')
    : path.join(storageRoot, 'videos', 'timeline');
  if (!fs.existsSync(mergedDir)) fs.mkdirSync(mergedDir, { recursive: true });

  const ffmpegBin = getFfmpegPath();
  const ffmpegAvailable = hasLocalFfmpeg();
  if (!ffmpegAvailable) {
    throw new Error('ffmpeg 不可用，无法执行时间线合成');
  }

  const { spawnSync } = require('child_process');
  const clipPaths = [];
  const toCleanup = [];

  // Step 1: 裁剪每个片段 + 应用转场
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const startSec = Number(seg.start_sec) || 0;
    const endSec = Number(seg.end_sec) || 0;
    const transition = VALID_TRANSITIONS.has(seg.transition) ? seg.transition : 'cut';

    // 解析视频路径
    const videoPath = resolveLocalVideoPath(seg.video_url || seg.video_path, seg.local_path);
    if (!videoPath || !fs.existsSync(videoPath)) {
      log.warn('[时间线合成] 片段视频不存在，跳过', { index: i, path: videoPath });
      continue;
    }

    const clipFile = `clip_${mergeId}_${i}_${Date.now()}.mp4`;
    const clipPath = path.join(tempDir, clipFile);

    // ffmpeg 裁剪命令
    const args = ['-y'];
    if (startSec > 0) args.push('-ss', String(startSec));
    args.push('-i', videoPath);
    if (endSec > startSec) args.push('-to', String(endSec));

    // 转场效果
    if (transition === 'fade') {
      const fadeDuration = 0.5;
      const segDuration = endSec - startSec;
      args.push('-vf', `fade=in:st=0:d=${fadeDuration},fade=out:st=${Math.max(0, segDuration - fadeDuration)}:d=${fadeDuration}`);
      args.push('-c:a', 'aac');
    } else if (transition === 'black') {
      // 黑场：在片段前后加 0.5s 黑场
      args.push('-c', 'copy');
    } else {
      // cut: 直接裁剪
      args.push('-c', 'copy');
    }

    args.push(clipPath);

    const result = spawnSync(ffmpegBin, args, { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 });
    if (result.status !== 0) {
      log.warn('[时间线合成] 片段裁剪失败', { index: i, stderr: result.stderr?.slice(-300) });
      // 降级：直接用原文件
      if (fs.existsSync(videoPath)) {
        clipPaths.push(videoPath);
      }
      continue;
    }

    clipPaths.push(clipPath);
    if (clipPath.startsWith(tempDir)) toCleanup.push(clipPath);

    // 黑场转场：插入 0.5s 黑场片段
    if (transition === 'black' && i < segments.length - 1) {
      const blackFile = `black_${mergeId}_${i}_${Date.now()}.mp4`;
      const blackPath = path.join(tempDir, blackFile);
      const blackArgs = [
        '-y', '-f', 'lavfi', '-i', 'color=c=black:s=1920x1080:d=0.5',
        '-c:v', 'libx264', '-pix_fmt', 'yuv420p', blackPath
      ];
      const blackResult = spawnSync(ffmpegBin, blackArgs, { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 });
      if (blackResult.status === 0 && fs.existsSync(blackPath)) {
        clipPaths.push(blackPath);
        toCleanup.push(blackPath);
      }
    }
  }

  if (clipPaths.length === 0) {
    db.prepare('UPDATE video_merges SET status = ?, error_msg = ? WHERE id = ?').run('failed', '无有效视频片段', mergeId);
    taskService.updateTaskError(db, r.task_id, '无有效视频片段');
    return { ok: false, error: '无有效视频片段' };
  }

  // Step 2: concat 合并
  const outputFileName = `timeline_${mergeId}_${Date.now()}.mp4`;
  const outputPath = path.join(mergedDir, outputFileName);
  const ok = runFfmpegConcat(clipPaths, outputPath, log);

  // 清理临时文件
  for (const p of toCleanup) {
    try { if (fs.existsSync(p)) fs.unlinkSync(p); } catch (_) {}
  }

  if (!ok || !fs.existsSync(outputPath)) {
    db.prepare('UPDATE video_merges SET status = ?, error_msg = ? WHERE id = ?').run('failed', 'ffmpeg 合并失败', mergeId);
    taskService.updateTaskError(db, r.task_id, 'ffmpeg 合并失败');
    return { ok: false, error: 'ffmpeg 合并失败' };
  }

  // 更新 DB
  const mergedRelativePath = sub
    ? path.join(sub, 'videos', 'timeline', outputFileName).replace(/\\/g, '/')
    : path.join('videos', 'timeline', outputFileName).replace(/\\/g, '/');

  const totalDuration = segments.reduce((sum, s) => sum + ((Number(s.end_sec) || 0) - (Number(s.start_sec) || 0)), 0);

  db.prepare(
    'UPDATE video_merges SET status = ?, merged_url = ?, duration = ?, completed_at = ?, error_msg = ? WHERE id = ?'
  ).run('completed', mergedRelativePath, Math.round(totalDuration) || null, new Date().toISOString(), null, mergeId);

  if (r.task_id) {
    taskService.updateTaskResult(db, r.task_id, { merge_id: mergeId, video_url: mergedRelativePath, duration: Math.round(totalDuration) });
  }

  log.info('[时间线合成] 成功', { merge_id: mergeId, output: mergedRelativePath, segments: segments.length });
  return { ok: true, merged_url: mergedRelativePath, duration: Math.round(totalDuration) };
}

/** 解析视频 URL 为本地文件路径 */
function resolveLocalVideoPath(videoUrl, localPath) {
  if (localPath) {
    const storageRoot = getStorageRoot();
    const abs = path.isAbsolute(localPath) ? localPath : path.join(storageRoot, localPath.replace(/\//g, path.sep));
    if (fs.existsSync(abs)) return abs;
  }
  if (videoUrl) {
    const u = videoUrl.trim();
    if (path.isAbsolute(u) && fs.existsSync(u)) return u;
    const storageRoot = getStorageRoot();
    const localAttempt = path.join(storageRoot, u.replace(/^\//, '').replace(/\//g, path.sep));
    if (fs.existsSync(localAttempt)) return localAttempt;
  }
  return null;
}

/** 使用 ffprobe 获取视频时长 */
function getVideoDuration(ffprobePath, videoPath) {
  return new Promise((resolve) => {
    const { spawnSync } = require('child_process');
    try {
      const result = spawnSync(ffprobePath, [
        '-v', 'error', '-show_entries', 'format=duration',
        '-of', 'default=noprint_wrappers=1:nokey=1', videoPath
      ], { encoding: 'utf8', timeout: 5000 });
      if (result.status === 0 && result.stdout) {
        const dur = parseFloat(result.stdout.trim());
        if (!isNaN(dur)) return resolve(dur);
      }
    } catch (_) {}
    resolve(0);
  });
}

module.exports = {
  list,
  getById,
  create,
  deleteById,
  processVideoMerge,
  mergeWithTimeline,
  previewMerge,
  createWithTimeline,
};
