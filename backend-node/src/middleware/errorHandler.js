/**
 * 统一错误处理中间件
 *
 * 提供结构化错误响应：
 *   { success: false, error: { code, type, message, retryable, suggestion }, timestamp }
 *
 * 用法：
 *   const { errorHandler, ApiError } = require('./middleware/errorHandler');
 *   // 在路由中抛出:
 *   throw new ApiError('RATE_LIMITED', 'AI 厂商限流', { retryable: true, suggestion: '等待 60 秒后重试' });
 *   // 或直接:
 *   throw new ApiError('INSUFFICIENT_BALANCE', '账户余额不足', { retryable: false, suggestion: '请充值后重试' });
 *   // Express 自动捕获。
 */

const { isContentModerationError } = require('../services/contentSafety');

/**
 * 自定义 API 错误类
 */
class ApiError extends Error {
  /**
   * @param {string} code       - 错误代码（大写蛇形，如 RATE_LIMITED）
   * @param {string} message    - 人类可读错误描述
   * @param {object} [opts]     - { retryable, suggestion, statusCode, vendor, details }
   */
  constructor(code, message, opts = {}) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.type = codeToType(code);
    this.retryable = opts.retryable ?? false;
    this.suggestion = opts.suggestion || '';
    this.statusCode = opts.statusCode || 500;
    this.vendor = opts.vendor || null;
    this.details = opts.details || null;
  }
}

// ── 错误码 → 错误类型映射 ──
const ERROR_TYPES = {
  RATE_LIMITED:           { type: 'rate_limit',        statusCode: 429, retryable: true,  suggestion: '等待 60 秒后重试' },
  INSUFFICIENT_BALANCE:   { type: 'billing',           statusCode: 402, retryable: false, suggestion: '请充值后重试' },
  CONTENT_VIOLATION:      { type: 'content_filter',    statusCode: 400, retryable: false, suggestion: '修改提示词内容后重试' },
  AI_TIMEOUT:              { type: 'timeout',           statusCode: 504, retryable: true,  suggestion: '稍后重试或更换厂商' },
  AI_UNAVAILABLE:          { type: 'service_unavailable', statusCode: 503, retryable: true,  suggestion: '稍后重试或更换厂商' },
  INVALID_IMAGE:          { type: 'validation',        statusCode: 400, retryable: false, suggestion: '检查图片格式和大小' },
  JSON_PARSE_FAILED:       { type: 'parse_error',      statusCode: 502, retryable: true,  suggestion: '稍后重试，若反复出现请联系开发者' },
  FILE_TOO_LARGE:          { type: 'validation',       statusCode: 413, retryable: false, suggestion: '压缩后重试' },
  BAD_REQUEST:             { type: 'validation',       statusCode: 400, retryable: false, suggestion: '检查请求参数' },
  NOT_FOUND:               { type: 'not_found',        statusCode: 404, retryable: false, suggestion: '' },
  FORBIDDEN:               { type: 'auth',             statusCode: 403, retryable: false, suggestion: '检查权限' },
  INTERNAL_ERROR:          { type: 'internal',         statusCode: 500, retryable: true,  suggestion: '稍后重试' },
};

function codeToType(code) {
  return (ERROR_TYPES[code] || ERROR_TYPES.INTERNAL_ERROR).type;
}

/**
 * Express 错误处理中间件（必须放路由之后）
 */
function errorHandler(err, req, res, next) {
  // 如果是 ApiError，使用其结构化信息
  if (err instanceof ApiError) {
    const body = {
      success: false,
      error: {
        code: err.code,
        type: err.type,
        message: err.message,
        retryable: err.retryable,
        suggestion: err.suggestion,
        ...(err.vendor ? { vendor: err.vendor } : {}),
        ...(err.details ? { details: err.details } : {}),
      },
      timestamp: new Date().toISOString(),
    };
    // 如果有 requestId，附上方便排查
    if (req.reqId) body.error.reqId = req.reqId;
    return res.status(err.statusCode).json(body);
  }

  // 非 ApiError：尝试从错误消息推断类型
  const msg = (err.message || '').toLowerCase();
  let code = 'INTERNAL_ERROR';
  if (err.code === 'LIMIT_FILE_SIZE' || msg.includes('file too large')) {
    code = 'FILE_TOO_LARGE';
  } else if (msg.includes('rate limit') || msg.includes('429') || err.code === 429) {
    code = 'RATE_LIMITED';
  } else if (msg.includes('余额不足') || msg.includes('insufficient') || err.code === 402) {
    code = 'INSUFFICIENT_BALANCE';
  } else if (msg.includes('内容违规') || msg.includes('content_filter') || isContentModerationError(err)) {
    code = 'CONTENT_VIOLATION';
  } else if (msg.includes('timeout') || err.code === 'ETIMEDOUT') {
    code = 'AI_TIMEOUT';
  }

  const info = ERROR_TYPES[code] || ERROR_TYPES.INTERNAL_ERROR;
  const body = {
    success: false,
    error: {
      code,
      type: info.type,
      message: err.message || '服务器错误',
      retryable: info.retryable,
      suggestion: info.suggestion,
    },
    timestamp: new Date().toISOString(),
  };
  if (req.reqId) body.error.reqId = req.reqId;
  return res.status(info.statusCode).json(body);
}

/**
 * 404 处理（放在路由之后、errorHandler 之前）
 */
function notFoundHandler(req, res) {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        type: 'not_found',
        message: `API endpoint not found: ${req.method} ${req.path}`,
        retryable: false,
        suggestion: '检查接口路径和 HTTP 方法',
      },
      timestamp: new Date().toISOString(),
    });
  }
  res.status(404).send('Not Found');
}

module.exports = { ApiError, errorHandler, notFoundHandler, ERROR_TYPES };
