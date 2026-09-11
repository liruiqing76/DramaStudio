/**
 * 通用 429（限流）退避重试工具。
 *
 * 背景：Agnes / 中转站等上游 rate limit 很严，连续请求会返回 429（有时是临时 401），
 * 直接失败会打断一键成片等多步骤流程。此工具把「发起请求并拿到状态/响应」的步骤包一层：
 * 收到 429 时，优先读 Retry-After 响应头，否则按指数退避，等待后重试，超限才认输。
 *
 * 用法：
 *   const r = await withRateLimitRetry(async (attempt) => {
 *     const out = await postJSONWithTimeout(url, headers, body);
 *     return { status: out.statusCode, text: out.raw, detail: out };
 *   }, { log, tag: 'image', maxRetries: 3, baseDelayMs: 5000 });
 *   // 返回最后一次完整响应（可能仍非 2xx），由调用方继续处理
 */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * 解析 Retry-After 头：秒数（数字或 HTTP-date）。解析失败返回 null。
 */
function parseRetryAfter(headerValue) {
  if (!headerValue) return null;
  const s = String(headerValue).trim();
  const secs = Number(s);
  if (Number.isFinite(secs) && secs >= 0) return Math.min(secs, 120) * 1000;
  const parsed = Date.parse(s);
  if (!Number.isNaN(parsed)) {
    const wait = parsed - Date.now();
    if (wait > 0) return Math.min(wait, 120000);
  }
  return null;
}

/**
 * 是否 429（或 Agnes/中转站偶发的"临时 401 限流"）。
 * status 可为数字或 undefined；detail 可选，携带响应头/响应体。
 * 429 必重试；401 仅当响应体含 rate limit / rate_limit / 限流 / qps 等字样时视为限流。
 */
function isRateLimited(status, detail) {
  if (status === 429) return true;
  if (status !== 401) return false;
  try {
    const bodyText =
      (detail && (detail.raw || detail.text)) ||
      (detail && detail.body) ||
      '';
    const s = String(bodyText).toLowerCase();
    return /rate.?limit|rate_limit|限流|qps|too many (requests?|tokens)|requests? per (second|minute)|retry.?after/i.test(s);
  } catch (_) {
    return false;
  }
}

/**
 * 带退避的 429 重试。
 * @param {Function} fn - async (attempt) => 返回 { status, text?, raw?, headers?, ... }。只要返回即视为"拿到响应"（含错误码），由重试逻辑决定是否再试。
 * @param {object} opts - { log?, tag?, maxRetries=3, baseDelayMs=5000, maxDelayMs=60000, onRetry? }
 * @returns {Promise<object>} 最后一次响应对象（也可能是非 429 的失败响应，由调用方处理）
 */
async function withRateLimitRetry(fn, opts = {}) {
  const {
    log = null,
    tag = 'request',
    maxRetries = 3,
    baseDelayMs = 5000,
    maxDelayMs = 60000,
    onRetry = null,
  } = opts;

  let result;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    result = await fn(attempt);
    const status = result && result.status;
    const headers = (result && (result.headers || result.header)) || null;
    if (!isRateLimited(status, result)) {
      return result;
    }
    if (attempt >= maxRetries) break;

    // 计算等待时间：Retry-After 优先，其次指数退避
    let waitMs = 0;
    if (headers) {
      const ra = headers['retry-after'] || headers['Retry-After'];
      waitMs = parseRetryAfter(ra) || 0;
    }
    if (!waitMs) {
      const backoff = baseDelayMs * Math.pow(2, attempt);
      waitMs = Math.min(backoff, maxDelayMs);
    }
    // 额外加 0~1s 抖动，避免并行任务同时重试再次撞限流
    waitMs += Math.floor(Math.random() * 1000);

    if (log && log.warn) {
      log.warn(`[rate-limit] ${tag} 收到限流(429)，第 ${attempt + 1}/${maxRetries} 次重试，等待 ${Math.round(waitMs / 1000)}s`, {
        status, wait_ms: waitMs,
      });
    }
    if (onRetry) {
      try { onRetry({ attempt, waitMs, status }); } catch (_) {}
    }
    await sleep(waitMs);
  }
  return result;
}

module.exports = {
  withRateLimitRetry,
  parseRetryAfter,
  isRateLimited,
};