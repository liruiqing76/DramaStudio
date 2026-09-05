/**
 * vlmQualityService 单元测试
 * 不依赖真实网络，只测纯逻辑：
 * - cleanJsonResponse 解析各种 LLM 输出格式
 * - promptI18n 新 prompt 导出完整
 * - buildStoryboardContext 空库降级
 */
const assert = require('assert');
const path = require('path');
const vlmService = require(path.join(__dirname, '..', 'src', 'services', 'vlmQualityService'));
const promptI18n = require(path.join(__dirname, '..', 'src', 'services', 'promptI18n'));

let passed = 0, failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log('  ✓', name);
  } catch (e) {
    failed++;
    console.error('  ✗', name, '\n    ', e.message);
  }
}

console.log('=== 1. cleanJsonResponse ===');

test('解析纯 JSON', () => {
  const r = vlmService.cleanJsonResponse('{"score":8,"is_acceptable":true}');
  assert.strictEqual(r.score, 8);
  assert.strictEqual(r.is_acceptable, true);
});

test('解析 markdown 代码块包裹', () => {
  const r = vlmService.cleanJsonResponse('```json\n{"score":7,"is_acceptable":true}\n```');
  assert.strictEqual(r.score, 7);
  assert.strictEqual(r.is_acceptable, true);
});

test('解析前后带解释文字', () => {
  const r = vlmService.cleanJsonResponse('好的，评估结果如下：\n{"score":6,"is_acceptable":false}\n希望对你有帮助');
  assert.strictEqual(r.score, 6);
  assert.strictEqual(r.is_acceptable, false);
});

test('空输入返回 null', () => {
  assert.strictEqual(vlmService.cleanJsonResponse(''), null);
  assert.strictEqual(vlmService.cleanJsonResponse(null), null);
});

test('非法 JSON 返回 null', () => {
  assert.strictEqual(vlmService.cleanJsonResponse('not json at all'), null);
});

console.log('=== 2. promptI18n 新 prompt ===');

test('getVlmFrameEvalPrompt 已导出', () => {
  assert.strictEqual(typeof promptI18n.getVlmFrameEvalPrompt, 'function');
  const p = promptI18n.getVlmFrameEvalPrompt();
  assert.ok(p.includes('hard_failures'), '应包含 hard_failures 硬性失败项');
  assert.ok(p.includes('is_acceptable'), '应包含 is_acceptable');
  assert.ok(p.includes('suggested_prompt'), '应包含 suggested_prompt 优化提示词');
});

test('getVlmSelectBestPrompt 已导出', () => {
  assert.strictEqual(typeof promptI18n.getVlmSelectBestPrompt, 'function');
  const p = promptI18n.getVlmSelectBestPrompt();
  assert.ok(p.includes('best_index'), '应包含 best_index');
  assert.ok(p.includes('images_list'), '应包含图片列表占位');
});

test('getStagingContinuityPrompt 已导出', () => {
  assert.strictEqual(typeof promptI18n.getStagingContinuityPrompt, 'function');
  const p = promptI18n.getStagingContinuityPrompt();
  assert.ok(p.includes('patches'), '应包含 patches');
  assert.ok(p.includes('{segments}'), '应包含 segments 占位');
});

test('原有 getContinuitySnapshotPrompt 未破坏', () => {
  assert.strictEqual(typeof promptI18n.getContinuitySnapshotPrompt, 'function');
});

console.log('=== 3. getVlmConfig 默认值 ===');

test('默认 enabled=false', () => {
  const cfg = vlmService.getVlmConfig({});
  assert.strictEqual(cfg.enabled, false);
  assert.strictEqual(cfg.maxIterations, 2);
  assert.strictEqual(cfg.scoreThreshold, 7);
});

test('可覆盖配置', () => {
  const cfg = vlmService.getVlmConfig({ vlm_quality: { enabled: true, maxIterations: 3 } });
  assert.strictEqual(cfg.enabled, true);
  assert.strictEqual(cfg.maxIterations, 3);
});

test('支持 ai.vlm_quality 子块配置', () => {
  const cfg = vlmService.getVlmConfig({ ai: { vlm_quality: { enabled: true } } });
  assert.strictEqual(cfg.enabled, true);
});

test('顶层优先于 ai 子块', () => {
  const cfg = vlmService.getVlmConfig({ vlm_quality: { enabled: true, scoreThreshold: 6 }, ai: { vlm_quality: { scoreThreshold: 9 } } });
  assert.strictEqual(cfg.enabled, true);
  assert.strictEqual(cfg.scoreThreshold, 6);
});

console.log('=== 4. buildStoryboardContext 空库降级 ===');

test('mock db 无数据返回 null 不抛错', () => {
  // 用抛错模拟空库查询
  const mockDb = {
    prepare: () => ({
      get: () => { throw new Error('no such table'); },
      all: () => { throw new Error('no such table'); },
    }),
  };
  const log = { warn: () => {}, info: () => {} };
  try {
    const ctx = vlmService.buildStoryboardContext(mockDb, 1);
    assert.strictEqual(ctx, null, '空库查询失败应返回 null');
  } catch (e) {
    assert.fail('buildStoryboardContext 空库时不应抛错: ' + e.message);
  }
});

console.log('=== 5. regenerateUntilAcceptable 安全模式 ===');

test('enabled=false 时不评估早退', async () => {
  const mockDb = { prepare: () => ({ get: () => null, run: () => ({}) }) };
  const log = { warn: () => {}, info: () => {}, error: () => {} };
  const r = await vlmService.regenerateUntilAcceptable(mockDb, log, 1, { cfg: { vlm_quality: { enabled: false } } });
  assert.strictEqual(r.evaluated, false);
  assert.strictEqual(r.accepted, true);
});

test('无 regenerateFn 时只记录建议不重生成（安全模式）', async () => {
  // mock db + aiClient 被 stub 会走真实调用，这里只测无 regenerateFn 分支
  const log = { warn: () => {}, info: () => {}, error: () => {} };
  // 直接测 regenerateUntilAcceptable 会调 evaluateStoryboardFrame（真实 VLM API）
  // 为不依赖网络，这里只验证"enabled=true 但图片不存在"时早退降级
  const mockDb = {
    prepare: () => ({
      get: () => ({ id: 1, frame_type: 'first', storyboard_id: 5, local_path: null, prompt: 'x' }),
      run: () => ({}),
      all: () => [],
    }),
  };
  const r = await vlmService.regenerateUntilAcceptable(mockDb, log, 1, { cfg: { vlm_quality: { enabled: true } } });
  assert.strictEqual(r.accepted, true, '图片不存在应降级放行');
  assert.strictEqual(r.evaluated, false);
});

console.log('\n===== 结果 =====');
console.log(`通过: ${passed}, 失败: ${failed}`);
if (failed > 0) process.exit(1);
console.log('全部通过 ✅');