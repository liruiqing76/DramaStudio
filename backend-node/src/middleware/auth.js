/**
 * 鉴权中间件（最小化方案）
 *
 * 目标：防止 API 被未授权调用。
 *
 * 方案：
 *   - 从 config.yaml 读取 server.auth_token；未配置时自动从
 *     global_settings 生成一个持久 token（首次启动生成，之后复用）。
 *   - 客户端请求必须带 `X-Client-Token` 头与配置一致。
 *   - /health 放行（用于探活）。
 *   - 若配置了 `server.auth_enabled: false`（默认 false，桌面端），
 *     则鉴权中间件跳过 —— 保持向后兼容，打包/发布时再开启。
 *
 * 用法（在 app.js）：
 *   const { authMiddleware } = require('./middleware/auth');
 *   app.use('/api/v1', authMiddleware(cfg, db), setupRouter(...));
 */

const crypto = require('crypto');

/**
 * 读取或创建持久 token（存 global_settings 表）
 */
function getOrCreateToken(db) {
  try {
    const row = db.prepare(`SELECT value FROM global_settings WHERE key = 'auth_token'`).get();
    if (row && row.value) return row.value;
    const token = crypto.randomBytes(24).toString('hex');
    db.prepare(`
      INSERT OR REPLACE INTO global_settings (key, value, updated_at)
      VALUES ('auth_token', ?, datetime('now', 'localtime'))
    `).run(token);
    return token;
  } catch (_) {
    // global_settings 表不存在（迁移前）时降级为内存随机 token
    return crypto.randomBytes(24).toString('hex');
  }
}

/**
 * 生成鉴权中间件
 * @param {object} cfg - 完整 config
 * @param {object} db  - better-sqlite3 实例
 */
function authMiddleware(cfg, db) {
  const enabled = cfg.server?.auth_enabled === true;
  // 允许从环境变量覆盖（打包部署时更安全，不入库）
  const envToken = process.env.LMD_AUTH_TOKEN;
  let token = envToken;

  if (!token) {
    token = cfg.server?.auth_token || getOrCreateToken(db);
  }

  return function auth(req, res, next) {
    // /health 探活放行
    if (req.path === '/health') return next();
    // 未开启鉴权直接放行（开发模式向后兼容）
    if (!enabled) return next();

    const supplied = req.headers['x-client-token'];
    if (!supplied || supplied !== token) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          type: 'auth',
          message: '未授权访问',
          retryable: false,
          suggestion: '请检查 X-Client-Token 请求头',
        },
        timestamp: new Date().toISOString(),
      });
    }
    next();
  };
}

module.exports = { authMiddleware, getOrCreateToken };