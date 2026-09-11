/**
 * rateLimitRetry 单元测试：429 退避重试、Retry-After 优先、非 429 直通、超限认输。
 */
const { test } = require('node:test');
const assert = require('node:assert');
const { withRateLimitRetry, parseRetryAfter, isRateLimited } = require('../src/utils/rateLimitRetry');

test('parseRetryAfter：数字秒与 HTTP-date', () => {
  assert.strictEqual(parseRetryAfter('30'), 30000);
  assert.strictEqual(parseRetryAfter('120'), 120000); // 上限 120s
  assert.strictEqual(parseRetryAfter(null), null);
  assert.strictEqual(parseRetryAfter(''), null);
  const d = new Date(Date.now() + 5000).toUTCString();
  const got = parseRetryAfter(d);
  assert.ok(got > 0 && got <= 120000, `HTTP-date 应解析出等待时间: ${got}`);
});

test('isRateLimited：429 必真；401 仅当含限流字样', () => {
  assert.ok(isRateLimited(429, {}));
  assert.ok(isRateLimited(429, { text: 'whatever' }));
  assert.ok(!isRateLimited(200, {}));
  assert.ok(!isRateLimited(500, {}));
  assert.ok(isRateLimited(401, { raw: 'rate limit exceeded' }));
  assert.ok(isRateLimited(401, { text: 'Too Many Requests' }));
  assert.ok(!isRateLimited(401, { raw: 'invalid api key' }));
});

test('withRateLimitRetry：429 后重试成功', async () => {
  let calls = 0;
  const r = await withRateLimitRetry(async () => {
    calls += 1;
    if (calls < 3) return { status: 429, text: 'rate limited' };
    return { status: 200, text: 'ok' };
  }, { maxRetries: 3, baseDelayMs: 1 });
  assert.strictEqual(r.status, 200);
  assert.strictEqual(calls, 3);
});

test('withRateLimitRetry：Retry-After 头优先', async () => {
  let calls = 0;
  let waited = 0;
  const r = await withRateLimitRetry(async () => {
    calls += 1;
    if (calls < 2) return { status: 429, headers: { 'retry-after': '1' }, text: 'slow down' };
    return { status: 200, text: 'ok' };
  }, {
    maxRetries: 3, baseDelayMs: 10000, // baseDelay 大，如未走 Retry-After 必然超时很久
    onRetry: ({ waitMs }) => { waited = waitMs; },
  });
  assert.strictEqual(r.status, 200);
  assert.strictEqual(calls, 2);
  assert.ok(waited < 3000, `应走 Retry-After(≈1s+抖动)，实际等待 ${waited}ms`);
});

test('withRateLimitRetry：非 429 失败直通不重试', async () => {
  let calls = 0;
  const r = await withRateLimitRetry(async () => {
    calls += 1;
    return { status: 500, text: 'server error' };
  }, { maxRetries: 3, baseDelayMs: 1 });
  assert.strictEqual(r.status, 500);
  assert.strictEqual(calls, 1);
});

test('withRateLimitRetry：一直 429 到超限认输，返回最后一次 429', async () => {
  let calls = 0;
  const r = await withRateLimitRetry(async () => {
    calls += 1;
    return { status: 429, text: 'still limited' };
  }, { maxRetries: 3, baseDelayMs: 1 });
  assert.strictEqual(r.status, 429);
  assert.strictEqual(calls, 4); // 初始 + 3 次重试
});