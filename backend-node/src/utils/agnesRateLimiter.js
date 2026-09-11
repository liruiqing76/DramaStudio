/**
 * Agnes AI 请求节流器（严格按官方 Token Plan 文档实现）。
 *
 * 官方文档：https://www.agnes-ai.cn/zh-Hans/docs/tokenplan
 * 生效日期 2026-06-22，视频 RPM 更新于 2026-06-28。
 *
 * ── 官方 RPM 表（摘录）────────────────────────────────────────────────
 * 文本模型
 *   default     允许 30  / 实际 20
 *   enterprise  允许 60  / 实际 40
 *   TokenPlan   允许 1000 / 实际 1000
 *
 * 图片模型（按输出分辨率档位区分）
 *   default     1K: 30/20   2K: 20/10   3K: 2/1   4K: 1/1
 *   enterprise  1K: 60/40   2K: 40/20   3K: 2/1   4K: 2/1
 *   TokenPlan   1K: 120/100 2K: 120/80  3K: 2/1   4K: 2/1
 *
 * 视频模型
 *   default     允许 2 / 实际 1
 *   enterprise  允许 2 / 实际 2
 *   TokenPlan   允许 6 / 实际 5
 *
 * ── 关键约束（官方）──────────────────────────────────────────────────
 * 1. RPM 与「订阅配额」同时生效（文本按次数 / 图片按张数 / 视频按秒数）。
 * 2. 限制按 **密钥类型** 共享，而不是按单个密钥 —— 创建多个同类型密钥
 *    不会增加总 RPM。因此本模块用「单一全局令牌桶」模拟同一限制池，
 *    所有同类请求串行排队，绝不并发抢跑。
 * 3. 官方建议：收到 429 时「使用指数退避并降低轮询频率」。
 * 4. 官方轮询建议：视频任务每 1–2 秒查询一次。
 *
 * 设计要点：
 * - 主动限速（proactive throttle）优先于被动重试：按 RPM 精确算出最小间隔，
 *   排队放行，从源头避免 429，而不是撞了 429 再退避。
 * - "实际 RPM" 是官方给出的稳态吞吐，用它算间隔最贴近真实配额。
 * - 429 后全局冷却（cool-down），让整个进程一起退让，而非各请求各自重试。
 */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 官方 RPM 表：plan -> 类别 -> 分辨率档 -> { allowed, actual } */
const RPM_TABLE = {
  default: {
    text: { _: { allowed: 30, actual: 20 } },
    image: {
      '1K': { allowed: 30, actual: 20 },
      '2K': { allowed: 20, actual: 10 },
      '3K': { allowed: 2, actual: 1 },
      '4K': { allowed: 1, actual: 1 },
    },
    video: { _: { allowed: 2, actual: 1 } },
  },
  enterprise: {
    text: { _: { allowed: 60, actual: 40 } },
    image: {
      '1K': { allowed: 60, actual: 40 },
      '2K': { allowed: 40, actual: 20 },
      '3K': { allowed: 2, actual: 1 },
      '4K': { allowed: 2, actual: 1 },
    },
    video: { _: { allowed: 2, actual: 2 } },
  },
  tokenplan: {
    text: { _: { allowed: 1000, actual: 1000 } },
    image: {
      '1K': { allowed: 120, actual: 100 },
      '2K': { allowed: 120, actual: 80 },
      '3K': { allowed: 2, actual: 1 },
      '4K': { allowed: 2, actual: 1 },
    },
    video: { _: { allowed: 6, actual: 5 } },
  },
};

const DEFAULT_PLAN = 'tokenplan';

/** 归一化分辨率档位：1K/2K/3K/4K；未知一律按最低档 4K 处理（最保守） */
function normalizeSizeTier(size) {
  const s = String(size || '').trim().toUpperCase();
  if (s === '1K' || s === '2K' || s === '3K' || s === '4K') return s;
  // 视频命名（720P/1080P/1440P/2160P）：按显示器分辨率语义直接映射档位，
  // 不套用像素中点边界（否则 1440 会因 <=1968 被误判为 1K）。
  if (/^\d{3,4}P$/.test(s)) {
    const p = parseInt(s, 10);
    if (p >= 2000) return '4K';   // 2160P / 4K
    if (p >= 1400) return '2K';   // 1440P / 2K
    if (p >= 1000) return '2K';   // 1080P 归 2K（保守：宁严勿松）
    return '1K';                  // 720P
  }
  // 精确像素写法（如 2560x1440）按官方档位定义的最长边归位。
  // 官方各档 1:1 最长边：1K=1024、2K=2048、3K=3072、4K=4096；16:9：1312/2624/3936/5248。
  // 边界取「本档最大值」，即 <= 该档最长边即归入该档，保证官方尺寸精确落档。
  const m = s.match(/^(\d+)\s*[X*]\s*(\d+)$/);
  if (m) {
    const longEdge = Math.max(parseInt(m[1], 10), parseInt(m[2], 10));
    if (longEdge <= 1312) return '1K';
    if (longEdge <= 2624) return '2K';
    if (longEdge <= 3936) return '3K';
    return '4K';
  }
  return '4K';
}

function resolvePlan(plan) {
  const p = String(plan || '').toLowerCase();
  if (p === 'default' || p === 'free') return 'default';
  if (p === 'enterprise') return 'enterprise';
  if (p === 'tokenplan' || p === 'token_plan' || p === 'pro') return 'tokenplan';
  return DEFAULT_PLAN;
}

/**
 * 取官方「实际 RPM」。actual 是稳态吞吐，用它算间隔最贴近真实配额。
 * @param {'text'|'image'|'video'} kind
 * @param {string} [size] - 图片分辨率档位（仅 kind='image' 需要）
 * @param {string} [plan] - default | enterprise | tokenplan
 */
function getAgnesRpm(kind, size, plan) {
  const table = RPM_TABLE[resolvePlan(plan)];
  const bucket = table[kind] || table.text;
  const tier = kind === 'image' ? normalizeSizeTier(size) : '_';
  const row = bucket[tier] || bucket[Object.keys(bucket)[0]] || { allowed: 1, actual: 1 };
  return row.actual;
}

/** 最小请求间隔（毫秒）。留 5% 安全边际，避免刚好踩线。 */
function getMinIntervalMs(kind, size, plan) {
  const rpm = Math.max(1, getAgnesRpm(kind, size, plan));
  return Math.ceil((60000 / rpm) * 1.05);
}

/**
 * 单一全局队列（模拟"同类型密钥共享同一限制池"）。
 * 用一条 Promise 链保证任意时刻只有一个请求在「放行窗口」内，
 * 从而在客户端侧就收敛到官方 RPM 以内。
 */
let _chain = Promise.resolve();
/** 全局冷却截止时间戳（收到 429 后设置，所有后续请求都要等它过去） */
let _cooldownUntil = 0;
/** 上一次放行时间 */
let _lastReleaseAt = 0;
/** 统计（便于日志诊断） */
const _stats = { queued: 0, released: 0, waitedMs: 0, cooldowns: 0 };

/**
 * 排队等待一个"放行许可"。
 * @param {object} opts
 * @param {'text'|'image'|'video'} opts.kind
 * @param {string} [opts.size] 图片分辨率档位
 * @param {string} [opts.plan] 订阅档位
 * @param {object} [opts.log]
 * @param {string} [opts.tag]
 * @returns {Promise<void>} 拿到许可后 resolve
 */
async function acquireAgnesSlot(opts = {}) {
  const { kind = 'text', size = null, plan = null, log = null, tag = 'agnes' } = opts;
  const minInterval = getMinIntervalMs(kind, size, plan);
  _stats.queued++;

  const myTurn = _chain.then(async () => {
    // 1) 先等全局冷却（429 惩罚）
    const nowCd = Date.now();
    if (_cooldownUntil > nowCd) {
      const cdWait = _cooldownUntil - nowCd;
      if (log && log.warn) {
        log.warn(`[agnes-rate] ${tag} 全局冷却中，等待 ${Math.round(cdWait / 1000)}s（官方 429 建议退避）`, {
          kind, size, plan: resolvePlan(plan),
        });
      }
      await sleep(cdWait);
    }
    // 2) 再按官方 RPM 算出的最小间隔排队
    const now = Date.now();
    const earliest = _lastReleaseAt + minInterval;
    if (earliest > now) {
      const waitMs = earliest - now;
      _stats.waitedMs += waitMs;
      if (waitMs > 1500 && log && log.info) {
        log.info(`[agnes-rate] ${tag} 按官方 RPM 排队 ${Math.round(waitMs / 1000)}s`, {
          kind,
          size,
          plan: resolvePlan(plan),
          rpm: getAgnesRpm(kind, size, plan),
        });
      }
      await sleep(waitMs);
    }
    _lastReleaseAt = Date.now();
    _stats.released++;
  });

  // 无论成败都要让链条继续，避免一次异常卡死后续所有请求
  _chain = myTurn.catch(() => {});
  return myTurn;
}

/**
 * 收到 429 时调用：设置全局冷却，让整个进程一起退让。
 * 官方建议「使用指数退避并降低轮询频率」。
 * @param {number} consecutive - 连续 429 次数（从 1 开始），用于指数退避
 * @param {object} [opts] { log, tag }
 */
function applyAgnesCooldown(consecutive = 1, opts = {}) {
  const { log = null, tag = 'agnes' } = opts;
  // 基数 5s，指数增长，上限 60s（对齐官方"降低频率"建议）
  const base = getMinIntervalMs('image', '2K', null); // ≈790ms，作为温和基数
  const ms = Math.min(60000, Math.max(5000, base * Math.pow(2, Math.max(0, consecutive - 1)) * 3));
  const until = Date.now() + ms;
  if (until > _cooldownUntil) _cooldownUntil = until;
  _stats.cooldowns++;
  if (log && log.warn) {
    log.warn(`[agnes-rate] ${tag} 收到 429，全局冷却 ${Math.round(ms / 1000)}s（连续第 ${consecutive} 次）`, {
      consecutive,
      cooldown_ms: ms,
    });
  }
  return ms;
}

function getAgnesRateStats() {
  return { ..._stats, cooldownRemainingMs: Math.max(0, _cooldownUntil - Date.now()) };
}

/** 测试辅助：重置内部状态 */
function _resetAgnesRateLimiter() {
  _chain = Promise.resolve();
  _cooldownUntil = 0;
  _lastReleaseAt = 0;
  _stats.queued = 0;
  _stats.released = 0;
  _stats.waitedMs = 0;
  _stats.cooldowns = 0;
}

module.exports = {
  RPM_TABLE,
  getAgnesRpm,
  getMinIntervalMs,
  normalizeSizeTier,
  resolvePlan,
  acquireAgnesSlot,
  applyAgnesCooldown,
  getAgnesRateStats,
  _resetAgnesRateLimiter,
};
