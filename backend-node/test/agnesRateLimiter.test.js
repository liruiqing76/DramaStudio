/**
 * Agnes 官方 RPM 限制器 + 图片 size 归一化 单元测试。
 *
 * 依据官方文档：
 *   https://www.agnes-ai.cn/zh-Hans/docs/tokenplan
 *   https://www.agnes-ai.cn/zh-Hans/docs/agnes-image-21-flash
 *
 * 用 Node 内置测试运行器：
 *   node --test test/agnesRateLimiter.test.js
 */

const test = require('node:test');
const assert = require('node:assert');

const {
  getAgnesRpm,
  getMinIntervalMs,
  normalizeSizeTier,
  resolvePlan,
  acquireAgnesSlot,
  applyAgnesCooldown,
  getAgnesRateStats,
  _resetAgnesRateLimiter,
} = require('../src/utils/agnesRateLimiter');

test('官方 RPM 表：TokenPlan 档全部数值正确', () => {
  // 文本
  assert.strictEqual(getAgnesRpm('text', null, 'tokenplan'), 1000);
  // 图片（按分辨率档位）
  assert.strictEqual(getAgnesRpm('image', '1K', 'tokenplan'), 100);
  assert.strictEqual(getAgnesRpm('image', '2K', 'tokenplan'), 80);
  assert.strictEqual(getAgnesRpm('image', '3K', 'tokenplan'), 1);
  assert.strictEqual(getAgnesRpm('image', '4K', 'tokenplan'), 1);
  // 视频
  assert.strictEqual(getAgnesRpm('video', null, 'tokenplan'), 5);
});

test('官方 RPM 表：default 档全部数值正确', () => {
  assert.strictEqual(getAgnesRpm('text', null, 'default'), 20);
  assert.strictEqual(getAgnesRpm('image', '1K', 'default'), 20);
  assert.strictEqual(getAgnesRpm('image', '2K', 'default'), 10);
  assert.strictEqual(getAgnesRpm('image', '3K', 'default'), 1);
  assert.strictEqual(getAgnesRpm('image', '4K', 'default'), 1);
  assert.strictEqual(getAgnesRpm('video', null, 'default'), 1);
});

test('官方 RPM 表：enterprise 档全部数值正确', () => {
  assert.strictEqual(getAgnesRpm('text', null, 'enterprise'), 40);
  assert.strictEqual(getAgnesRpm('image', '1K', 'enterprise'), 40);
  assert.strictEqual(getAgnesRpm('image', '2K', 'enterprise'), 20);
  assert.strictEqual(getAgnesRpm('image', '3K', 'enterprise'), 1);
  assert.strictEqual(getAgnesRpm('image', '4K', 'enterprise'), 1);
  assert.strictEqual(getAgnesRpm('video', null, 'enterprise'), 2);
});

test('未指定 plan 时默认取 TokenPlan', () => {
  assert.strictEqual(resolvePlan(null), 'tokenplan');
  assert.strictEqual(resolvePlan(''), 'tokenplan');
  assert.strictEqual(resolvePlan('tokenplan'), 'tokenplan');
  assert.strictEqual(resolvePlan('free'), 'default');
});

test('分辨率档位归一化：档位字符串、像素、视频命名', () => {
  // 已是档位
  assert.strictEqual(normalizeSizeTier('1K'), '1K');
  assert.strictEqual(normalizeSizeTier('4k'), '4K');
  // 视频命名（按显示器分辨率语义映射档位，宁严勿松）
  assert.strictEqual(normalizeSizeTier('720P'), '1K');
  assert.strictEqual(normalizeSizeTier('1080P'), '2K');
  assert.strictEqual(normalizeSizeTier('1440P'), '2K');
  assert.strictEqual(normalizeSizeTier('2160P'), '4K');
  // 精确像素（按官方档位最长边，边界取中点）
  assert.strictEqual(normalizeSizeTier('1024x1024'), '1K');   // 1K(1:1)
  assert.strictEqual(normalizeSizeTier('1312x736'), '1K');    // 1K(16:9)
  assert.strictEqual(normalizeSizeTier('2048x2048'), '2K');   // 2K(1:1)
  assert.strictEqual(normalizeSizeTier('2560x1440'), '2K');
  assert.strictEqual(normalizeSizeTier('1792x1024'), '2K');   // 介于 1K/2K 之间，归 2K
  assert.strictEqual(normalizeSizeTier('2624x1472'), '2K');   // 2K(16:9)
  assert.strictEqual(normalizeSizeTier('3072x3072'), '3K');   // 3K(1:1)
  assert.strictEqual(normalizeSizeTier('3936x2208'), '3K');   // 3K(16:9)
  assert.strictEqual(normalizeSizeTier('4096x4096'), '4K');   // 4K(1:1)
  assert.strictEqual(normalizeSizeTier('5248x2944'), '4K');   // 4K(16:9)
  // 未知一律按最保守的 4K
  assert.strictEqual(normalizeSizeTier('garbage'), '4K');
});

test('最小间隔与官方 RPM 一致（含 5% 安全边际）', () => {
  // 视频 TokenPlan 5 RPM → 12s
  assert.strictEqual(getMinIntervalMs('video', null, 'tokenplan'), 12600);
  // 图片 1K TokenPlan 100 RPM → 630ms
  assert.strictEqual(getMinIntervalMs('image', '1K', 'tokenplan'), 630);
  // 图片 2K TokenPlan 80 RPM → 787.5 → 788ms
  assert.strictEqual(getMinIntervalMs('image', '2K', 'tokenplan'), 788);
  // 图片 4K（default 1 RPM）→ 60s
  assert.strictEqual(getMinIntervalMs('image', '4K', 'default'), 63000);
});

test('并发请求会被串行排队，总耗时反映官方 RPM 间隔', async () => {
  _resetAgnesRateLimiter();
  const start = Date.now();
  // 3 个视频任务：TokenPlan 5 RPM → 间隔 12.6s，首次立即放行
  // 为避免测试过慢，这里用 4K 图片档做等价验证会太慢，改用 mock：直接测 2 次高 RPM
  await Promise.all([
    acquireAgnesSlot({ kind: 'text', plan: 'tokenplan' }),
    acquireAgnesSlot({ kind: 'text', plan: 'tokenplan' }),
  ]);
  const elapsed = Date.now() - start;
  // 1000 RPM → 63ms 间隔；两次之间至少要等一次 ~63ms
  assert.ok(elapsed >= 50, `两次放行应至少间隔 ~63ms，实际 ${elapsed}ms`);
  const stats = getAgnesRateStats();
  assert.strictEqual(stats.released, 2);
  assert.ok(stats.waitedMs > 0, '应有排队等待时间');
});

test('429 冷却会让后续请求一起退让', async () => {
  _resetAgnesRateLimiter();
  const cooldownMs = applyAgnesCooldown(1, {});
  assert.ok(cooldownMs >= 5000, `首次冷响应 >=5s，实际 ${cooldownMs}`);
  const stats1 = getAgnesRateStats();
  assert.ok(stats1.cooldownRemainingMs > 0, '冷却剩余时间应大于 0');
  assert.strictEqual(stats1.cooldowns, 1);

  // 连续第 3 次应更久（指数退避）
  const cooldownMs3 = applyAgnesCooldown(3, {});
  assert.ok(cooldownMs3 > cooldownMs, `指数退避应增长：${cooldownMs} -> ${cooldownMs3}`);
  // 上限 60s
  const cooldownMs99 = applyAgnesCooldown(99, {});
  assert.ok(cooldownMs99 <= 60000, `冷却上限 60s，实际 ${cooldownMs99}`);
});

test('限制池是全局共享的（多密钥不叠加 RPM）', async () => {
  _resetAgnesRateLimiter();
  // 模拟"同一类型密钥共享限制池"：即便传不同 tag/plan，也走同一条全局队列
  const start = Date.now();
  await Promise.all([
    acquireAgnesSlot({ kind: 'image', size: '2K', plan: 'tokenplan', tag: 'key-A' }),
    acquireAgnesSlot({ kind: 'image', size: '2K', plan: 'tokenplan', tag: 'key-B' }),
    acquireAgnesSlot({ kind: 'image', size: '2K', plan: 'tokenplan', tag: 'key-C' }),
  ]);
  const elapsed = Date.now() - start;
  // 2K 档 80 RPM → 788ms 间隔，3 个请求至少经历 2 次间隔
  assert.ok(elapsed >= 1400, `3 个请求应排队 >=1.4s，实际 ${elapsed}ms`);
});
