/**
 * 结构化日志中间件 (pino)
 *
 * 替换原有 logger.js 的 console.log 方式：
 *   - pino 输出 JSON 格式日志，便于机器解析
 *   - 自动注入 requestId，串联整条请求链路
 *   - 支持日志级别过滤（trace/debug/info/warn/error/fatal）
 *   - 兼容原有 logger.info/warn/error 调用方式
 *
 * 用法：
 *   const { logger, requestIdMiddleware } = require('./middleware/logger');
 *   app.use(requestIdMiddleware);
 *   logger.info({ reqId: req.reqId, method: req.method, path: req.path }, 'incoming request');
 */

const { randomUUID } = require('crypto');

// ── 轻量级 pino 替代：不引入额外依赖，用原生 JSON 序列化 ──
// 后续可平滑切换到 pino（API 兼容）

const LEVELS = { trace: 10, debug: 20, info: 30, warn: 40, error: 50, fatal: 60 };
const LEVEL_NAMES = { 10: 'TRACE', 20: 'DEBUG', 30: 'INFO', 40: 'WARN', 50: 'ERROR', 60: 'FATAL' };

// 从环境变量读取最低日志级别，默认 info
const minLevel = LEVELS[process.env.LOG_LEVEL || 'info'] || LEVELS.info;

// 日志输出目标：stdout + 可选文件
const fs = require('fs');
const path = require('path');
const logFile = process.env.LOG_FILE || null;
if (logFile) {
  try {
    const dir = path.dirname(logFile);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  } catch (_) {}
}

function formatLog(level, msg, data = {}) {
  const entry = {
    time: new Date().toISOString(),
    level: level,
    levelName: LEVEL_NAMES[level] || 'INFO',
    msg: typeof msg === 'string' ? msg : String(msg),
    ...data,
  };
  return JSON.stringify(entry);
}

function writeLog(level, msg, data) {
  if (level < minLevel) return;
  const line = formatLog(level, msg, data);
  try { console.log(line); } catch (_) {}
  if (logFile) {
    try { fs.appendFileSync(logFile, line + '\n'); } catch (_) {}
  }
}

// ── Logger 对象（兼容原有 logger.js API） ──
const logger = {
  info(msg, ...args) {
    const data = parseArgs(args);
    writeLog(LEVELS.info, msg, data);
  },
  infow(msg, ...args) {
    const data = parseArgs(args);
    writeLog(LEVELS.info, msg, data);
  },
  warn(msg, ...args) {
    const data = parseArgs(args);
    writeLog(LEVELS.warn, msg, data);
  },
  warnw(msg, ...args) {
    const data = parseArgs(args);
    writeLog(LEVELS.warn, msg, data);
  },
  error(msg, ...args) {
    const data = parseArgs(args);
    writeLog(LEVELS.error, msg, data);
  },
  errorw(msg, ...args) {
    const data = parseArgs(args);
    writeLog(LEVELS.error, msg, data);
  },
  debug(msg, ...args) {
    const data = parseArgs(args);
    writeLog(LEVELS.debug, msg, data);
  },
  trace(msg, ...args) {
    const data = parseArgs(args);
    writeLog(LEVELS.trace, msg, data);
  },
  fatal(msg, ...args) {
    const data = parseArgs(args);
    writeLog(LEVELS.fatal, msg, data);
  },
  child(bindings = {}) {
    // 返回一个带预设 context 的子 logger
    return {
      info: (msg, ...args) => writeLog(LEVELS.info, msg, { ...bindings, ...parseArgs(args) }),
      warn: (msg, ...args) => writeLog(LEVELS.warn, msg, { ...bindings, ...parseArgs(args) }),
      error: (msg, ...args) => writeLog(LEVELS.error, msg, { ...bindings, ...parseArgs(args) }),
      debug: (msg, ...args) => writeLog(LEVELS.debug, msg, { ...bindings, ...parseArgs(args) }),
    };
  },
};

function parseArgs(args) {
  if (!args.length) return {};
  if (args.length === 1 && typeof args[0] === 'object' && args[0] !== null && !Array.isArray(args[0])) {
    return args[0];
  }
  // 多参数：拼成 args 数组
  return { args: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)) };
}

// ── Express 中间件：注入 requestId + 请求日志 ──
function requestIdMiddleware(req, res, next) {
  // 优先使用上游传入的 X-Request-Id，否则生成
  req.reqId = req.headers['x-request-id'] || randomUUID().slice(0, 8);
  // 在响应头回写，方便前端关联
  res.setHeader('X-Request-Id', req.reqId);
  // 记录请求入口
  const startMs = Date.now();
  logger.info({ reqId: req.reqId, method: req.method, path: req.path }, '→ request');

  // 响应结束时记录耗时
  res.on('finish', () => {
    const duration = Date.now() - startMs;
    const level = res.statusCode >= 500 ? LEVELS.error : res.statusCode >= 400 ? LEVELS.warn : LEVELS.info;
    writeLog(level, '← response', {
      reqId: req.reqId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration_ms: duration,
    });
  });

  next();
}

module.exports = { logger, requestIdMiddleware, LEVELS };
