/**
 * 成本追踪中间件
 *
 * 提供：
 *   1. recordCost() — 在任何 AI 调用完成后记录费用
 *   2. estimateCost() — 调用前预估费用
 *   3. getEpisodeCost() — 获取单集总成本
 *   4. getDramaCost() — 获取整剧总成本
 *   5. costSummary() — 获取成本汇总
 *
 * 数据写入 cost_records 表（迁移 23_add_cost_records.sql）。
 */
const { v4: uuidv4 } = require('uuid');

// ── 价格表（可后续移到 config/aiProviders.js） ──────────────────────
// 单位：USD per call（固定）或 USD per token（带 perToken 标记）
const PRICE_TABLE = {
  // ── 图片生成 ──
  image: {
    wan:         { fixed: 0.02,  currency: 'USD' },  // ~¥0.14/张
    kling:      { fixed: 0.03,  currency: 'USD' },  // ~¥0.21/张
    jimeng:     { fixed: 0.015, currency: 'USD' },  // ~¥0.10/张
    default:    { fixed: 0.02,  currency: 'USD' },
  },
  // ── 视频生成 ──
  video: {
    wan_480p:   { fixed: 0.0035, currency: 'USD', perSecond: 0.0035 },  // ~¥0.025/秒
    wan_720p:   { fixed: 0.007,  currency: 'USD', perSecond: 0.007  },  // ~¥0.05/秒
    kling:      { fixed: 0.05,   currency: 'USD' },  // ~¥0.35/段
    ltx:        { fixed: 0.02,   currency: 'USD' },
    default:    { fixed: 0.05,   currency: 'USD' },
  },
  // ── TTS ──
  tts: {
    minimax:    { perChar: 0.0001, currency: 'USD' },  // ~¥0.0007/字
    default:    { perChar: 0.0001, currency: 'USD' },
  },
  // ── 文本/LLM ──
  text: {
    default:    { perKToken: 0.001, currency: 'USD' },  // ~¥0.007/千token
  },
};

// USD → CNY 汇率（可从配置覆盖）
let USD_TO_CNY_RATE = 7.15;

// ── 工具函数 ──────────────────────────────────────────

function getRate() {
  return USD_TO_CNY_RATE;
}

function setRate(rate) {
  if (typeof rate === 'number' && rate > 0) {
    USD_TO_CNY_RATE = rate;
  }
}

/**
 * 预估单次调用成本
 * @param {string} serviceType - 'image' | 'video' | 'tts' | 'text'
 * @param {string} provider    - 'wan' | 'kling' | 'minimax' ...
 * @param {object} [metrics]   - { duration, chars, tokens, resolution }
 * @returns {{ costUsd: number, costCny: number, currency: string }}
 */
function estimateCost(serviceType, provider, metrics = {}) {
  const category = PRICE_TABLE[serviceType] || PRICE_TABLE.text;
  const pricing = category[provider] || category.default || { fixed: 0.02, currency: 'USD' };

  let costUsd = pricing.fixed || 0;

  // 按秒计费（视频）
  if (pricing.perSecond && metrics.duration) {
    costUsd = pricing.perSecond * metrics.duration;
  }

  // 按字计费（TTS）
  if (pricing.perChar && metrics.chars) {
    costUsd = pricing.perChar * metrics.chars;
  }

  // 按 token 计费（LLM）
  if (pricing.perKToken && metrics.tokens) {
    costUsd = (pricing.perKToken * metrics.tokens) / 1000;
  }

  const costCny = costUsd * USD_TO_CNY_RATE;
  return { costUsd: Math.round(costUsd * 10000) / 10000, costCny: Math.round(costCny * 10000) / 10000, currency: pricing.currency || 'USD' };
}

// ── DB 操作 ──────────────────────────────────────────

/**
 * 记录一次 AI 调用的成本
 * @param {object} db        - better-sqlite3 实例
 * @param {object} params
 * @param {number} [params.drama_id]
 * @param {number} [params.episode_id]
 * @param {number} [params.storyboard_id]
 * @param {string} params.service_type
 * @param {string} params.provider
 * @param {string} [params.model]
 * @param {number} [params.prompt_tokens]
 * @param {number} [params.completion_tokens]
 * @param {number} [params.total_tokens]
 * @param {number} params.cost_usd
 * @param {number} params.cost_cny
 * @returns {number} - 新插入的记录 ID
 */
function recordCost(db, {
  drama_id = null,
  episode_id = null,
  storyboard_id = null,
  service_type,
  provider,
  model = null,
  prompt_tokens = 0,
  completion_tokens = 0,
  total_tokens = 0,
  cost_usd = 0,
  cost_cny = 0,
}) {
  const stmt = db.prepare(`
    INSERT INTO cost_records
      (drama_id, episode_id, storyboard_id, service_type, provider, model,
       prompt_tokens, completion_tokens, total_tokens, cost_usd, cost_cny)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const info = stmt.run(
    drama_id, episode_id, storyboard_id,
    service_type, provider, model,
    prompt_tokens, completion_tokens, total_tokens,
    cost_usd, cost_cny
  );
  return info.lastInsertRowid;
}

/**
 * 自动估算并记录成本（一步到位）
 * @param {object} db
 * @param {object} params - { service_type, provider, model, drama_id, episode_id, storyboard_id, metrics }
 */
function recordAuto(db, {
  service_type, provider, model = null,
  drama_id = null, episode_id = null, storyboard_id = null,
  metrics = {},
  prompt_tokens = 0, completion_tokens = 0, total_tokens = 0,
}) {
  const { costUsd, costCny } = estimateCost(service_type, provider, metrics);
  return recordCost(db, {
    drama_id, episode_id, storyboard_id,
    service_type, provider, model,
    prompt_tokens, completion_tokens,
    total_tokens: total_tokens || (prompt_tokens + completion_tokens),
    cost_usd: costUsd, cost_cny: costCny,
  });
}

// ── 查询 ──────────────────────────────────────────

/**
 * 获取单集总成本
 */
function getEpisodeCost(db, episodeId) {
  const row = db.prepare(`
    SELECT
      COALESCE(SUM(cost_usd), 0) AS total_usd,
      COALESCE(SUM(cost_cny), 0) AS total_cny,
      COUNT(*) AS call_count,
      GROUP_CONCAT(DISTINCT provider) AS providers
    FROM cost_records
    WHERE episode_id = ?
  `).get(episodeId);
  return row;
}

/**
 * 获取整剧总成本
 */
function getDramaCost(db, dramaId) {
  const row = db.prepare(`
    SELECT
      COALESCE(SUM(cost_usd), 0) AS total_usd,
      COALESCE(SUM(cost_cny), 0) AS total_cny,
      COUNT(*) AS call_count,
      COUNT(DISTINCT episode_id) AS episode_count
    FROM cost_records
    WHERE drama_id = ?
  `).get(dramaId);
  return row;
}

/**
 * 按服务类型/厂商汇总
 */
function getCostSummary(db, dramaId = null) {
  const where = dramaId ? 'WHERE drama_id = ?' : '';
  const params = dramaId ? [dramaId] : [];
  const rows = db.prepare(`
    SELECT
      service_type,
      provider,
      COUNT(*) AS call_count,
      COALESCE(SUM(cost_usd), 0) AS total_usd,
      COALESCE(SUM(cost_cny), 0) AS total_cny
    FROM cost_records
    ${where}
    GROUP BY service_type, provider
    ORDER BY total_cny DESC
  `).all(...params);
  return rows;
}

/**
 * 获取最近 N 条成本记录
 */
function getRecentCosts(db, limit = 50) {
  return db.prepare(`
    SELECT * FROM cost_records
    ORDER BY created_at DESC
    LIMIT ?
  `).all(limit);
}

module.exports = {
  PRICE_TABLE,
  estimateCost,
  recordCost,
  recordAuto,
  getEpisodeCost,
  getDramaCost,
  getCostSummary,
  getRecentCosts,
  getRate,
  setRate,
};
