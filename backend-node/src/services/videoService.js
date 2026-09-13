/** 轮询/同步返回的 video_url 须为 http(s)，避免中转 FAILURE 时 result_url 为错误文案 */
function resolveRemoteVideoUrl(videoUrl, fallbackError) {
  if (videoUrl && videoClient.isPlausibleHttpVideoUrl(videoUrl)) {
    return { ok: true, video_url: String(videoUrl).trim() };
  }
  if (videoUrl) {
    return { ok: false, error: (fallbackError || String(videoUrl)).slice(0, 500) };
  }
  return { ok: false, error: (fallbackError || '超时或失败').slice(0, 500) };
}

/** 将 video_generations 标为失败；若无 error_msg 列则只更新 status/updated_at */
function setVideoGenFailed(db, videoGenId, errorMsg, now) {
  try {
    db.prepare('UPDATE video_generations SET status = ?, error_msg = ?, updated_at = ? WHERE id = ?').run(
      'failed', (errorMsg || '').slice(0, 500), now, videoGenId
    );
  } catch (e) {
    if ((e.message || '').includes('error_msg')) {
      db.prepare('UPDATE video_generations SET status = ?, updated_at = ? WHERE id = ?').run('failed', now, videoGenId);
    } else throw e;
  }
}

function list(db, query) {
  let sql = 'FROM video_generations WHERE deleted_at IS NULL';
  const params = [];
  if (query.drama_id) {
    sql += ' AND drama_id = ?';
    params.push(query.drama_id);
  }
  if (query.storyboard_id) {
    sql += ' AND storyboard_id = ?';
    params.push(query.storyboard_id);
  }
  // 与 Go 前端行为对齐：请求 status=processing 时，同时包含“刚结束”的记录（5 分钟内变为 completed/failed），
  // 这样轮询刷新后任务不会从列表消失，无需改 Vue
  if (query.status === 'processing') {
    sql += " AND (status = 'processing' OR (status IN ('completed','failed') AND updated_at >= datetime('now', '-5 minutes')))";
  } else if (query.status) {
    sql += ' AND status = ?';
    params.push(query.status);
  }
  const countRow = db.prepare('SELECT COUNT(*) as total ' + sql).get(...params);
  const total = countRow.total || 0;
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(query.page_size, 10) || 20));
  const offset = (page - 1) * pageSize;
  const rows = db.prepare('SELECT * ' + sql + ' ORDER BY created_at DESC LIMIT ? OFFSET ?').all(...params, pageSize, offset);
  return { items: rows.map(rowToItem), total, page, pageSize };
}

function rowToItem(r) {
  return {
    id: r.id,
    storyboard_id: r.storyboard_id,
    drama_id: r.drama_id,
    provider: r.provider,
    prompt: r.prompt,
    model: r.model,
    image_gen_id: r.image_gen_id,
    image_url: r.image_url,
    video_url: r.video_url,
    local_path: r.local_path,
    status: r.status,
    task_id: r.task_id,
    error_msg: r.error_msg,
    created_at: r.created_at,
    updated_at: r.updated_at,
    completed_at: r.completed_at,
  };
}

function getById(db, id) {
  const r = db.prepare('SELECT * FROM video_generations WHERE id = ? AND deleted_at IS NULL').get(Number(id));
  return r ? rowToItem(r) : null;
}

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { randomUUID } = require('crypto');
const videoClient = require('./videoClient');
const taskService = require('./taskService');
const storageLayout = require('./storageLayout');
const { getFfmpegPath, hasLocalFfmpeg } = require('../utils/ffmpegPath');

/** @returns {{ dir: string, relPrefix: string }} 与图片 uploads 一致的工程子目录规则 */
function resolveVideosDir(storagePath, projectSubdir) {
  const sub = projectSubdir && String(projectSubdir).trim();
  if (sub) {
    const relPrefix = `${sub.replace(/\\/g, '/')}/videos`;
    return { dir: path.join(storagePath, sub, 'videos'), relPrefix };
  }
  return { dir: path.join(storagePath, 'videos'), relPrefix: 'videos' };
}

/**
 * 将远程 video_url 下载到本地
 * @returns {string|null} 相对 storage 根的路径，如 projects/.../videos/vg_1_xxx.mp4；无工程时为 videos/...
 */
async function downloadVideoToLocal(storagePath, videoUrl, videoGenId, log, projectSubdir = null) {
  if (!videoUrl || typeof videoUrl !== 'string') return null;
  const { dir, relPrefix } = resolveVideosDir(storagePath, projectSubdir);
  try {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const ext = (videoUrl.split('?')[0].match(/\.(mp4|webm|mov)$/i) || [])[1] || 'mp4';
    const name = `vg_${videoGenId}_${randomUUID().slice(0, 8)}.${ext}`;
    const filePath = path.join(dir, name);
    const res = await fetch(videoUrl, { method: 'GET' });
    if (!res.ok) {
      log.warn('Download video failed', { status: res.status, videoGenId });
      return null;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(filePath, buf);
    const relativePath = `${relPrefix}/${name}`.replace(/\\/g, '/');
    log.info('Video saved to local', { videoGenId, local_path: relativePath, projectSubdir: projectSubdir || '(root)' });
    return relativePath;
  } catch (e) {
    log.warn('Download video error', { videoGenId, error: e.message });
    return null;
  }
}

/** 与图生 aspectRatioToSize 对齐的归一化分辨率（偶数像素，便于 H.264） */
function targetVideoPixelsForAspect(aspectRatio) {
  const r = String(aspectRatio || '16:9').trim();
  const map = {
    '16:9': { w: 2560, h: 1440 },
    '9:16': { w: 1440, h: 2560 },
    '1:1': { w: 1920, h: 1920 },
    '4:3': { w: 1920, h: 1440 },
    '3:4': { w: 1440, h: 1920 },
    '3:2': { w: 2560, h: 1708 },
    '2:3': { w: 1708, h: 2560 },
    '21:9': { w: 2560, h: 1080 },
  };
  if (map[r]) return map[r];
  const m = r.match(/^(\d+)\s*:\s*(\d+)$/);
  if (m) {
    const a = parseInt(m[1], 10);
    const b = parseInt(m[2], 10);
    if (a > 0 && b > 0 && a !== b) {
      if (a > b) {
        const w = 2560;
        const h = Math.max(2, Math.round((w * b) / a / 2) * 2);
        return { w, h };
      }
      const h = 2560;
      const w = Math.max(2, Math.round((h * a) / b / 2) * 2);
      return { w, h };
    }
  }
  return { w: 1280, h: 720 };
}

/**
 * 用 ffmpeg 将视频缩放并加黑边到固定分辨率，避免 Grok 等返回实际像素不一致导致连播时画面跳动。
 */
function normalizeVideoFileToTargetPixels(absPath, tw, th, log, videoGenId) {
  if (!absPath || !tw || !th || !fs.existsSync(absPath)) return false;
  if (!hasLocalFfmpeg()) {
    log.info('[视频] 未找到 ffmpeg，跳过画幅归一化', { videoGenId });
    return false;
  }
  const ffmpeg = getFfmpegPath();
  const vf = `scale=${tw}:${th}:force_original_aspect_ratio=decrease,pad=${tw}:${th}:(ow-iw)/2:(oh-ih)/2:black`;
  const tmpOut = absPath + '.norm-' + randomUUID().slice(0, 8) + (path.extname(absPath) || '.mp4');
  const baseArgs = ['-y', '-i', absPath, '-vf', vf, '-c:v', 'libx264', '-preset', 'fast', '-crf', '23', '-pix_fmt', 'yuv420p', '-movflags', '+faststart'];
  let r = spawnSync(ffmpeg, [...baseArgs, '-c:a', 'copy', tmpOut], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  if (r.status !== 0) {
    r = spawnSync(ffmpeg, [...baseArgs, '-an', tmpOut], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  }
  if (r.status !== 0) {
    log.warn('[视频] 画幅归一化失败（保留原文件）', {
      videoGenId,
      stderr: (r.stderr || '').slice(-500),
    });
    try {
      fs.unlinkSync(tmpOut);
    } catch (_) {}
    return false;
  }
  try {
    fs.unlinkSync(absPath);
    fs.renameSync(tmpOut, absPath);
    log.info('[视频] 已统一画幅尺寸', { videoGenId, w: tw, h: th });
    return true;
  } catch (e) {
    log.warn('[视频] 替换归一化文件失败', { videoGenId, error: e.message });
    try {
      fs.unlinkSync(tmpOut);
    } catch (_) {}
    return false;
  }
}

function maybeNormalizeVideoAfterDownload(storagePath, localPath, row, videoGenId, log) {
  if (!localPath) return;
  const abs = path.join(storagePath, localPath);
  const dim = targetVideoPixelsForAspect(row.aspect_ratio);
  normalizeVideoFileToTargetPixels(abs, dim.w, dim.h, log, videoGenId);
}

/**
 * 解析分镜用于生成视频的角色一致性参考素材（带语义标签）。
 * 仅供 Agnes 视频 reference 模式使用（其语义是「角色定妆照锁外貌+服装」），
 * 不包含首尾帧分镜画面（首尾帧应走 first_frame_url / last_frame_url）。
 *
 * ⚠️ 顺序说明（官方文档 agnes-video-25「编号规则」）：
 *   `images` 数组从 1 开始编号，第 N 张即 `<Picture N>`。
 *   官方提示词建议：reference 模式应在 prompt 中显式写出 `<Picture N>` 及其用途，
 *   "比只上传素材但不解释用途更容易获得可控结果"。
 *   官方示例惯例把「角色/主体」放第 1 位，但文档未规定顺序影响语义权重。
 *   因此本函数按「角色定妆图优先、场景图靠后」排序，便于 prompt 以
 *   `<Picture 1..k>` 指代角色、`<Picture k+1>` 指代场景。
 *
 * 返回 [{ ref, kind: 'character'|'scene', name }]，由调用方转公网 URL 并编号。
 */
function resolveStoryboardVideoReferences(db, storyboardId) {
  const items = [];
  const refs = []; // 仅用于去重
  const sb = db.prepare('SELECT scene_id, characters FROM storyboards WHERE id = ? AND deleted_at IS NULL').get(Number(storyboardId));
  if (!sb) return items;

  // ── 1) 角色服装图（衣橱正面图优先于角色主图）—— 放最前，作为 <Picture 1..k> ──
  let charIds = [];
  if (sb.characters != null && String(sb.characters).trim() !== '') {
    try {
      const parsed = JSON.parse(sb.characters);
      if (Array.isArray(parsed)) {
        charIds = parsed
          .map((it) => Number(typeof it === 'object' && it != null ? it.id : it))
          .filter((n) => Number.isFinite(n));
      }
    } catch (_) {}
  }
  // 兼容：分镜未显式配置 characters 时，从 storyboard_characters 关联表兜底
  if (charIds.length === 0) {
    try {
      const links = db.prepare('SELECT character_id FROM storyboard_characters WHERE storyboard_id = ?').all(Number(storyboardId));
      charIds = links.map((l) => Number(l.character_id)).filter((n) => Number.isFinite(n));
    } catch (_) {}
  }

  for (const cid of charIds) {
    try {
      const c = db.prepare('SELECT name, image_url, local_path, default_outfit_id FROM characters WHERE id = ? AND deleted_at IS NULL').get(cid);
      if (!c) continue;
      let charRef = null;
      const outfitId = c.default_outfit_id != null ? Number(c.default_outfit_id) : null;
      if (outfitId != null && outfitId > 0) {
        const outfit = db.prepare('SELECT front_image_path FROM character_outfits WHERE id = ? AND deleted_at IS NULL').get(outfitId);
        if (outfit && outfit.front_image_path) charRef = outfit.front_image_path;
      }
      if (!charRef) charRef = c.local_path || c.image_url;
      if (!charRef) {
        const panel = db.prepare(
          "SELECT local_path, image_url FROM image_generations WHERE character_id = ? AND frame_type = 'quad_panel_1' AND status = 'completed' ORDER BY id DESC LIMIT 1"
        ).get(cid);
        if (panel && (panel.image_url || panel.local_path)) charRef = panel.image_url || panel.local_path;
      }
      if (charRef && !refs.includes(charRef)) {
        refs.push(charRef);
        items.push({ ref: charRef, kind: 'character', name: c.name || 'character' });
      }
    } catch (_) {}
  }

  // ── 2) 场景图：scenes 当前主图 → 历史 quad_panel_0 面板 —— 放最后，作为 <Picture k+1> ──
  if (sb.scene_id) {
    try {
      const scene = db.prepare('SELECT location, image_url, local_path FROM scenes WHERE id = ? AND deleted_at IS NULL').get(Number(sb.scene_id));
      let sceneRef = scene ? (scene.local_path || scene.image_url) : null;
      if (!sceneRef) {
        const panel = db.prepare(
          "SELECT local_path, image_url FROM image_generations WHERE scene_id = ? AND frame_type = 'quad_panel_0' AND status = 'completed' ORDER BY id DESC LIMIT 1"
        ).get(Number(sb.scene_id));
        if (panel && (panel.image_url || panel.local_path)) sceneRef = panel.local_path || panel.image_url;
      }
      if (sceneRef && !refs.includes(sceneRef)) {
        refs.push(sceneRef);
        items.push({ ref: sceneRef, kind: 'scene', name: (scene && scene.location) || 'scene' });
      }
    } catch (_) {}
  }

  return items;
}

async function processVideoGeneration(db, log, videoGenId) {
  log.info('processVideoGeneration started', { videoGenId });
  const row = db.prepare('SELECT * FROM video_generations WHERE id = ? AND deleted_at IS NULL').get(Number(videoGenId));
  if (!row) {
    log.error('Video generation not found', { id: videoGenId });
    return;
  }
  const now = new Date().toISOString();
  try {
    db.prepare('UPDATE video_generations SET status = ?, updated_at = ? WHERE id = ?').run('processing', now, videoGenId);
    const loadConfig = require('../config').loadConfig;
    const cfg = loadConfig();
    const filesBaseUrl = (cfg.storage && cfg.storage.base_url) ? String(cfg.storage.base_url).replace(/\/$/, '') : '';
    const storageLocalPath = path.isAbsolute(cfg.storage?.local_path)
      ? cfg.storage.local_path
      : path.join(process.cwd(), cfg.storage?.local_path || './data/storage');
    const config = videoClient.getDefaultVideoConfig(db, row.model);
    if (!config) {
      setVideoGenFailed(db, videoGenId, '未配置视频模型', now);
      if (row.task_id) taskService.updateTaskError(db, row.task_id, '未配置视频模型');
      return;
    }
    let reference_urls = null;
    if (row.reference_image_urls) {
      try {
        reference_urls = JSON.parse(row.reference_image_urls);
        if (!Array.isArray(reference_urls)) reference_urls = null;
      } catch (_) {}
    }
    /** Agnes reference 模式素材清单（带语义标签），用于 prompt 生成 <Picture N> 引用 */
    let agnesRefItems = null;
    // Agnes 视频 reference 模式需「角色定妆照/服装 + 场景」锁一致性；
    // 前端经典模式误把首尾帧塞进 reference_image_urls，导致服装漂移。
    // 这里对 Agnes 协议自动解析分镜的角色服装图+场景图，覆盖前端传的首尾帧。
    if (row.storyboard_id) {
      let protocol = 'openai';
      try { protocol = videoClient.resolveVideoProtocol(config); } catch (_) {}
      if (protocol === 'agnes') {
        const autoItems = resolveStoryboardVideoReferences(db, row.storyboard_id);
        if (autoItems.length > 0) {
          // 角色定妆图在前、场景图在后 → 便于 prompt 用 <Picture 1..k> 指代
          agnesRefItems = autoItems.slice(0, 5);
          reference_urls = agnesRefItems.map((it) => it.ref);
          log.info('[Agnes视频] 已用分镜角色服装图+场景图覆盖 reference', {
            videoGenId, storyboard_id: row.storyboard_id, ref_count: reference_urls.length,
            kinds: agnesRefItems.map((it) => it.kind).join(','),
          });
        }
      }
    }
    // 优先使用分镜自身的镜头时长（storyboard.duration），其次用 video_generations.duration
    let effectiveDuration = row.duration || null;
    if (row.storyboard_id) {
      const sb = db.prepare('SELECT duration FROM storyboards WHERE id = ?').get(row.storyboard_id);
      if (sb && sb.duration > 0) {
        effectiveDuration = sb.duration;
        log.info('使用分镜镜头时长', { storyboard_id: row.storyboard_id, duration: effectiveDuration, video_gen_id: videoGenId });
      }
    }
    let aspectForVideo = row.aspect_ratio;
    if (aspectForVideo) {
      const n = videoClient.normalizeAspectRatioForApi(aspectForVideo);
      if (n) aspectForVideo = n;
    }
    if (!aspectForVideo && row.drama_id) {
      try {
        const dramaRow = db.prepare('SELECT metadata FROM dramas WHERE id = ? AND deleted_at IS NULL').get(row.drama_id);
        if (dramaRow && dramaRow.metadata) {
          const meta =
            typeof dramaRow.metadata === 'string' ? JSON.parse(dramaRow.metadata) : dramaRow.metadata;
          if (meta && meta.aspect_ratio) {
            aspectForVideo = videoClient.normalizeAspectRatioForApi(meta.aspect_ratio);
          }
        }
      } catch (_) {}
    }
    const rowForAspect = { ...row, aspect_ratio: aspectForVideo || row.aspect_ratio };
    const result = await videoClient.callVideoApi(db, log, {
      prompt: row.prompt,
      model: row.model,
      duration: effectiveDuration,
      aspect_ratio: rowForAspect.aspect_ratio,
      resolution: row.resolution,
      seed: row.seed,
      camera_fixed: row.camera_fixed,
      watermark: row.watermark,
      provider: row.provider,
      drama_id: row.drama_id,
      storyboard_id: row.storyboard_id || undefined,
      image_url: row.image_url,
      first_frame_url: row.first_frame_url,
      last_frame_url: row.last_frame_url,
      reference_urls,
      agnes_ref_items: agnesRefItems,
      files_base_url: filesBaseUrl,
      storage_local_path: storageLocalPath,
      video_gen_id: videoGenId,
    });
    const now2 = new Date().toISOString();
    if (result.error) {
      setVideoGenFailed(db, videoGenId, result.error, now2);
      if (row.task_id) taskService.updateTaskError(db, row.task_id, result.error);
      log.error('Video generation failed', { id: videoGenId, error: result.error });
      return;
    }
    const directVideo = resolveRemoteVideoUrl(result.video_url, result.error);
    if (directVideo.ok) {
      let localPath = null;
      try {
        const loadConfig = require('../config').loadConfig;
        const cfg = loadConfig();
        const storagePath = path.isAbsolute(cfg.storage?.local_path)
          ? cfg.storage.local_path
          : path.join(process.cwd(), cfg.storage?.local_path || './data/storage');
        const projectSubdir = storageLayout.getProjectStorageSubdir(db, row.drama_id);
        localPath = await downloadVideoToLocal(storagePath, directVideo.video_url, videoGenId, log, projectSubdir);
        maybeNormalizeVideoAfterDownload(storagePath, localPath, rowForAspect, videoGenId, log);
      } catch (_) {}
      try {
        db.prepare(
          'UPDATE video_generations SET status = ?, video_url = ?, local_path = ?, completed_at = ?, updated_at = ? WHERE id = ?'
        ).run('completed', directVideo.video_url, localPath, now2, now2, videoGenId);
      } catch (e) {
        if ((e.message || '').includes('completed_at')) {
          db.prepare(
            'UPDATE video_generations SET status = ?, video_url = ?, local_path = ?, updated_at = ? WHERE id = ?'
          ).run('completed', directVideo.video_url, localPath, now2, videoGenId);
        } else throw e;
      }
      // 自动更新分镜的主视频
      if (row.storyboard_id) {
        try {
          db.prepare('UPDATE storyboards SET video_url = ?, local_path = ?, updated_at = ? WHERE id = ?').run(
            directVideo.video_url, localPath, now2, row.storyboard_id
          );
          log.info('Updated storyboard video', { storyboard_id: row.storyboard_id, video_url: directVideo.video_url });
        } catch (_) {}
      }
      if (row.task_id) taskService.updateTaskResult(db, row.task_id, { video_generation_id: videoGenId, video_url: directVideo.video_url, status: 'completed' });
      log.info('Video generation completed', { id: videoGenId, video_url: directVideo.video_url, local_path: localPath });
      return;
    }
    if (result.video_url) {
      setVideoGenFailed(db, videoGenId, directVideo.error, now2);
      if (row.task_id) taskService.updateTaskError(db, row.task_id, directVideo.error);
      log.error('Video generation failed', { id: videoGenId, error: directVideo.error });
      return;
    }
    if (result.task_id) {
      db.prepare('UPDATE video_generations SET status = ?, updated_at = ? WHERE id = ?').run(
        'processing',
        now2,
        videoGenId
      );
      // 官方文档：创建成功后应保存响应里的 video_id，它才是「查询任务」用的 ID。
      // 此前 DB 的 task_id 存的是内部 taskService 的 UUID，Agnes 的真实 video_id 从未落库，
      // 导致进程重启后无法凭 DB 续查任务，只能整条重提（浪费配额且必然重新排队）。
      // 这里把上游返回的真实任务 ID 一并持久化：protocol === 'agnes' 时即 Agnes video_id。
      try {
        const remoteTaskId = String(result.task_id);
        if (remoteTaskId) {
          const cols = db.prepare('PRAGMA table_info(video_generations)').all().map((c) => c.name);
          if (cols.includes('remote_task_id')) {
            db.prepare('UPDATE video_generations SET remote_task_id = ?, updated_at = ? WHERE id = ?').run(
              remoteTaskId,
              now2,
              videoGenId
            );
          }
        }
      } catch (_) {}
      // 官方轮询建议：每 1–2 秒查询一次，直至 completed/failed
      const POLL_INTERVAL_MS = 3000;
      const { resolveVideoGenerationTimeoutMinutes } = require('../config/videoGeneration');
      const generationTimeoutMinutes = resolveVideoGenerationTimeoutMinutes(cfg);
      const pollMaxAttempts = Math.max(
        1,
        Math.ceil((generationTimeoutMinutes * 60 * 1000) / POLL_INTERVAL_MS)
      );
      const pollResult = await videoClient.pollVideoTask(
        db,
        log,
        videoGenId,
        result.task_id,
        config,
        pollMaxAttempts,
        POLL_INTERVAL_MS
      );
      const now3 = new Date().toISOString();
      const polledVideo = resolveRemoteVideoUrl(pollResult.video_url, pollResult.error);
      if (polledVideo.ok) {
        let localPath = null;
        try {
          const loadConfig = require('../config').loadConfig;
          const cfg = loadConfig();
          const storagePath = path.isAbsolute(cfg.storage?.local_path)
            ? cfg.storage.local_path
            : path.join(process.cwd(), cfg.storage?.local_path || './data/storage');
          const projectSubdir = storageLayout.getProjectStorageSubdir(db, row.drama_id);
          localPath = await downloadVideoToLocal(storagePath, polledVideo.video_url, videoGenId, log, projectSubdir);
          maybeNormalizeVideoAfterDownload(storagePath, localPath, rowForAspect, videoGenId, log);
        } catch (_) {}
        try {
          db.prepare(
            'UPDATE video_generations SET status = ?, video_url = ?, local_path = ?, completed_at = ?, updated_at = ? WHERE id = ?'
          ).run('completed', polledVideo.video_url, localPath, now3, now3, videoGenId);
        } catch (e) {
          if ((e.message || '').includes('completed_at')) {
            db.prepare(
              'UPDATE video_generations SET status = ?, video_url = ?, local_path = ?, updated_at = ? WHERE id = ?'
            ).run('completed', polledVideo.video_url, localPath, now3, videoGenId);
          } else throw e;
        }
        // 自动更新分镜的主视频
        if (row.storyboard_id) {
          try {
            db.prepare('UPDATE storyboards SET video_url = ?, local_path = ?, updated_at = ? WHERE id = ?').run(
              polledVideo.video_url, localPath, now3, row.storyboard_id
            );
            log.info('Updated storyboard video (poll)', { storyboard_id: row.storyboard_id, video_url: polledVideo.video_url });
          } catch (_) {}
        }
        if (row.task_id) taskService.updateTaskResult(db, row.task_id, { video_generation_id: videoGenId, video_url: polledVideo.video_url, status: 'completed' });
        log.info('Video generation completed (after poll)', { id: videoGenId, local_path: localPath });
      } else {
        setVideoGenFailed(db, videoGenId, polledVideo.error, now3);
        if (row.task_id) taskService.updateTaskError(db, row.task_id, polledVideo.error);
        log.error('Video generation failed (after poll)', { id: videoGenId, error: polledVideo.error });
      }
      return;
    }
    setVideoGenFailed(db, videoGenId, '未返回 task_id 或 video_url', now2);
    if (row.task_id) taskService.updateTaskError(db, row.task_id, '未返回 task_id 或 video_url');
  } catch (err) {
    const now2 = new Date().toISOString();
    setVideoGenFailed(db, videoGenId, err.message, now2);
    if (row && row.task_id) taskService.updateTaskError(db, row.task_id, err.message);
    log.error('Video generation error', { id: videoGenId, error: err.message });
  }
}

function deleteById(db, log, id) {
  const now = new Date().toISOString();
  const result = db.prepare('UPDATE video_generations SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL').run(now, Number(id));
  return result.changes > 0;
}

/**
 * 恢复轮询：后端重启后，对已提交到远端（有 remote_task_id）的 video_generations
 * 重新发起轮询，而非标记 failed。Agnes 视频生成耗时数分钟，node --watch 重启会
 * 频繁打断 setImmediate 回调，但远端任务仍在运行——直接 failed 会浪费配额。
 */
async function resumeVideoPolling(db, log, videoGenId) {
  const row = db.prepare('SELECT * FROM video_generations WHERE id = ? AND deleted_at IS NULL').get(Number(videoGenId));
  if (!row || !row.remote_task_id) {
    log.warn('[resumeVideo] 跳过：任务不存在或无 remote_task_id', { videoGenId });
    return;
  }
  log.info('[resumeVideo] 恢复轮询', { videoGenId, remote_task_id: row.remote_task_id });
  try {
    const loadConfig = require('../config').loadConfig;
    const cfg = loadConfig();
    const config = videoClient.getDefaultVideoConfig(db, row.model);
    if (!config) {
      setVideoGenFailed(db, videoGenId, '未配置视频模型（恢复轮询时）', new Date().toISOString());
      return;
    }
    const POLL_INTERVAL_MS = 3000;
    const { resolveVideoGenerationTimeoutMinutes } = require('../config/videoGeneration');
    const generationTimeoutMinutes = resolveVideoGenerationTimeoutMinutes(cfg);
    const pollMaxAttempts = Math.max(1, Math.ceil((generationTimeoutMinutes * 60 * 1000) / POLL_INTERVAL_MS));
    const pollResult = await videoClient.pollVideoTask(
      db, log, videoGenId, row.remote_task_id, config, pollMaxAttempts, POLL_INTERVAL_MS
    );
    const now = new Date().toISOString();
    const polledVideo = resolveRemoteVideoUrl(pollResult.video_url, pollResult.error);
    if (polledVideo.ok) {
      let localPath = null;
      try {
        const storagePath = path.isAbsolute(cfg.storage?.local_path)
          ? cfg.storage.local_path
          : path.join(process.cwd(), cfg.storage?.local_path || './data/storage');
        const projectSubdir = storageLayout.getProjectStorageSubdir(db, row.drama_id);
        localPath = await downloadVideoToLocal(storagePath, polledVideo.video_url, videoGenId, log, projectSubdir);
        maybeNormalizeVideoAfterDownload(storagePath, localPath, row, videoGenId, log);
      } catch (_) {}
      try {
        db.prepare('UPDATE video_generations SET status = ?, video_url = ?, local_path = ?, completed_at = ?, updated_at = ? WHERE id = ?')
          .run('completed', polledVideo.video_url, localPath, now, now, videoGenId);
      } catch (e) {
        if ((e.message || '').includes('completed_at')) {
          db.prepare('UPDATE video_generations SET status = ?, video_url = ?, local_path = ?, updated_at = ? WHERE id = ?')
            .run('completed', polledVideo.video_url, localPath, now, videoGenId);
        } else throw e;
      }
      if (row.storyboard_id) {
        try {
          db.prepare('UPDATE storyboards SET video_url = ?, local_path = ?, updated_at = ? WHERE id = ?')
            .run(polledVideo.video_url, localPath, now, row.storyboard_id);
        } catch (_) {}
      }
      if (row.task_id) {
        const taskService = require('./taskService');
        taskService.updateTaskResult(db, row.task_id, { video_generation_id: videoGenId, video_url: polledVideo.video_url, status: 'completed' });
      }
      log.info('[resumeVideo] 恢复成功', { videoGenId, video_url: polledVideo.video_url, local_path: localPath });
    } else {
      setVideoGenFailed(db, videoGenId, polledVideo.error, now);
      if (row.task_id) {
        const taskService = require('./taskService');
        taskService.updateTaskError(db, row.task_id, polledVideo.error);
      }
      log.error('[resumeVideo] 恢复失败', { videoGenId, error: polledVideo.error });
    }
  } catch (err) {
    const now = new Date().toISOString();
    setVideoGenFailed(db, videoGenId, '恢复轮询异常: ' + err.message, now);
    log.error('[resumeVideo] 异常', { videoGenId, error: err.message });
  }
}

module.exports = {
  list,
  getById,
  deleteById,
  processVideoGeneration,
  resolveStoryboardVideoReferences,
  resumeVideoPolling,
};
