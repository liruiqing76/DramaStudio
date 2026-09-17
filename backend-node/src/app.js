const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { getDb } = require('./db/index.js');
const { loadConfig } = require('./config/index.js');
const { setupRouter } = require('./routes/index.js');

// Phase 1 中间件
const { logger, requestIdMiddleware } = require('./middleware/logger');
const { authMiddleware } = require('./middleware/auth');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

function createApp() {
  const config = loadConfig();
  const db = getDb(config.database);
  const { runMigrationsAndEnsure } = require('./db/migrate.js');
  runMigrationsAndEnsure(db);

  // 启动时重置卡死的 processing 任务（node --watch 重启会导致 setImmediate 回调丢失）
  // 但 video_generations 有 remote_task_id 的任务已在远端提交，应恢复轮询而非标记 failed
  try {
    // 先捞出可恢复的视频任务（有 remote_task_id），排除出 blanket reset
    const resumableVideoIds = db.prepare(
      `SELECT id FROM video_generations WHERE status = 'processing' AND remote_task_id IS NOT NULL AND deleted_at IS NULL`
    ).all().map(r => r.id);
    if (resumableVideoIds.length > 0) {
      console.log(`[startup] ${resumableVideoIds.length} 个视频任务有 remote_task_id，将恢复轮询: [${resumableVideoIds.join(',')}]`);
    }

    const staleTables = [
      { name: 'async_tasks', errCol: 'error' },
      { name: 'image_generations', errCol: 'error_msg' },
      { name: 'video_generations', errCol: 'error_msg', excludeIds: resumableVideoIds },
      { name: 'video_merges', errCol: 'error_msg' },
    ];
    let totalReset = 0;
    for (const { name, errCol, excludeIds } of staleTables) {
      let info;
      if (excludeIds && excludeIds.length > 0) {
        const placeholders = excludeIds.map(() => '?').join(',');
        info = db.prepare(`UPDATE ${name} SET status = 'failed', ${errCol} = '后端重启时自动重置', updated_at = ? WHERE status = 'processing' AND deleted_at IS NULL AND id NOT IN (${placeholders})`).run(new Date().toISOString(), ...excludeIds);
      } else {
        info = db.prepare(`UPDATE ${name} SET status = 'failed', ${errCol} = '后端重启时自动重置', updated_at = ? WHERE status = 'processing' AND deleted_at IS NULL`).run(new Date().toISOString());
      }
      if (info.changes > 0) {
        console.log(`[startup] 重置 ${name} 中 ${info.changes} 个卡死的 processing 任务`);
        totalReset += info.changes;
      }
    }
    if (totalReset > 0) {
      console.log(`[startup] 共重置 ${totalReset} 个卡死任务`);
    }

    // 恢复轮询：对有 remote_task_id 的视频任务重新发起轮询
    if (resumableVideoIds.length > 0) {
      const { resumeVideoPolling } = require('./services/videoService');
      for (const vid of resumableVideoIds) {
        setImmediate(() => resumeVideoPolling(db, logger, vid));
      }
    }
  } catch (e) {
    console.warn('[startup] 重置卡死任务失败:', e.message);
  }

  // 厂商锁定模式：在迁移完成后同步 vendor_lock 配置
  const { applyVendorLock } = require('./services/aiConfigService');
  applyVendorLock(db, logger, config);
  const log = logger;

  const app = express();
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  app.use(
    cors({
      origin: config.server.cors_origins && config.server.cors_origins.length
        ? config.server.cors_origins
        : '*',
    })
  );

  // ── Phase 1: requestId + 请求日志 ──
  app.use(requestIdMiddleware);

  // 静态资源目录：统一转为绝对路径（打包 exe 下相对路径可能解析异常）
  const storageRoot = config.storage?.local_path
    ? (path.isAbsolute(config.storage.local_path)
        ? config.storage.local_path
        : path.join(process.cwd(), config.storage.local_path))
    : path.join(process.cwd(), 'data', 'storage');
  try {
    if (!fs.existsSync(storageRoot)) fs.mkdirSync(storageRoot, { recursive: true });
    app.use('/static', express.static(storageRoot));
  } catch (e) {
    log.warn('Static storage mount skipped:', e.message);
  }

  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      app: config.app.name,
      version: config.app.version,
    });
  });

  // ── Phase 1: 鉴权（默认关闭，配置 auth_enabled: true 开启）──
  app.use('/api/v1', authMiddleware(config, db), setupRouter(config, db, log));

  // 前端静态资源（sxy：web/dist）；Electron 打包时可设 WEB_DIST_PATH
  const webDist = process.env.WEB_DIST_PATH || path.join(process.cwd(), '..', 'frontweb', 'dist');
  if (fs.existsSync(webDist)) {
    app.use('/assets', express.static(path.join(webDist, 'assets')));
    // 服务 dist 根目录的静态文件（如 wx.jpg、favicon.ico 等）
    app.use(express.static(webDist, { index: false }));
    app.get('/favicon.ico', (req, res) => {
      const fav = path.join(webDist, 'favicon.ico');
      if (fs.existsSync(fav)) res.sendFile(fav);
      else res.status(404).end();
    });
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) return next();
      const indexHtml = path.join(webDist, 'index.html');
      if (fs.existsSync(indexHtml)) res.sendFile(indexHtml);
      else next();
    });
  } else {
    app.get('/', (req, res) => {
      res.send(
        '<!DOCTYPE html><html><head><meta charset="utf-8"><title>DramaStudio</title></head><body>' +
          '<h1>DramaStudio API</h1><p>后端已启动。请先构建前端：</p>' +
          '<pre>cd web &amp;&amp; pnpm install &amp;&amp; pnpm build</pre>' +
          '<p>然后将 <code>web/dist</code> 放到与 backend-node 同级的 <code>web/dist</code>，或访问 <a href="/health">/health</a> 检查接口。</p></body></html>'
      );
    });
  }

  // ── Phase 1: 统一 404 + 错误处理 ──
  app.use(notFoundHandler);
  app.use(errorHandler);

  return { app, config, db };
}

module.exports = { createApp };