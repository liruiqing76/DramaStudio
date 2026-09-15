const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { canonicalRefKey, refListHasCanonical, resolveImageRef, resolveAgnesImageRef } = require('../src/services/imageClient');
const { resolveImageToBuffer } = require('../src/services/videoClient');
const { sanitizeFramePrompt } = require('../src/utils/framePromptSanitize');
const { dedupePromptStyleTokens, upsertLayoutLockRef } = require('../src/services/imageService');

const noopLog = { info() {}, warn() {} };

// ── 参考图本地路径解析：/static/ 前缀必须能落到真实文件 ──────────────────────
function makeTempStorage() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'drama-storage-'));
  const rel = 'projects/0012_test/characters';
  fs.mkdirSync(path.join(dir, rel), { recursive: true });
  fs.writeFileSync(path.join(dir, rel, 'x.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  return dir;
}

test('resolveImageRef: /static/ 前缀路径可解析为 Data URI', () => {
  const dir = makeTempStorage();
  const out = resolveImageRef('/static/projects/0012_test/characters/x.png', null, dir);
  assert.ok(String(out).startsWith('data:image/png;base64,'), `应解析为 Data URI，实际 ${out}`);
});

test('resolveImageRef: 相对路径（无 /static/）同样可解析', () => {
  const dir = makeTempStorage();
  const out = resolveImageRef('projects/0012_test/characters/x.png', null, dir);
  assert.ok(String(out).startsWith('data:image/png;base64,'));
});

test('resolveAgnesImageRef: /static/ 前缀路径可解析（历史缺陷：拼出 storage/static/... 导致静默丢弃）', () => {
  const dir = makeTempStorage();
  const out = resolveAgnesImageRef('/static/projects/0012_test/characters/x.png', null, dir, noopLog);
  assert.ok(String(out).startsWith('data:image/png;base64,'), `应解析为 Data URI，实际 ${out}`);
});

test('resolveImageToBuffer（视频侧）: /static/ 前缀路径可解析为首尾帧 Buffer', () => {
  const dir = makeTempStorage();
  const out = resolveImageToBuffer('/static/projects/0012_test/characters/x.png', null, dir);
  assert.ok(out && out.buffer && out.buffer.length > 0, '应读取出 Buffer');
  assert.strictEqual(out.mime, 'image/png');
});

// ── 参考图去重 key：同一张图的两种写法必须归一 ────────────────────────────────
test('canonicalRefKey: projects/x.png 与 /static/projects/x.png 归一为同一 key', () => {
  assert.strictEqual(
    canonicalRefKey('projects/0012/images/a.png'),
    canonicalRefKey('/static/projects/0012/images/a.png')
  );
});

test('refListHasCanonical: 已存在相对路径时，/static/ 写法不再重复入列', () => {
  const list = ['projects/0012/images/a.png'];
  assert.strictEqual(refListHasCanonical(list, '/static/projects/0012/images/a.png'), true);
  assert.strictEqual(refListHasCanonical(list, 'projects/0012/images/b.png'), false);
});

// ── 「参考图中的人物形象」只对真附了图的角色使用 ──────────────────────────────
test('sanitizeFramePrompt: 有参考图的角色保留指代，悬空角色回填外貌锚点', () => {
  const prompt = '近景，陈默（参考图中的人物形象）坐在左侧，赵总（参考图中的人物形象）站在右侧。';
  const out = sanitizeFramePrompt(prompt, ['陈默', '赵总'], [], {
    ...noopLog,
    referenceBackedNames: ['陈默'], // 本次只有陈默附了参考图
    appearanceByName: { 赵总: '50岁男性，长方脸，薄唇，左腕金表' },
  });
  assert.ok(out.includes('陈默（参考图中的人物形象）'), '有参考图的角色应保留指代');
  assert.ok(!out.includes('赵总（参考图中的人物形象）'), '没有参考图的角色不得声称参考图');
  assert.ok(out.includes('赵总（50岁男性，长方脸，薄唇，左腕金表）'), '应回填外貌锚点');
});

test('sanitizeFramePrompt: 悬空且无外貌锚点时，去掉括号指代而不是留着骗模型', () => {
  const prompt = '陈默（参考图中的人物形象）与林悦（参考图中的人物形象）对视。';
  const out = sanitizeFramePrompt(prompt, ['陈默', '林悦'], [], {
    ...noopLog,
    referenceBackedNames: ['陈默'],
    appearanceByName: {},
  });
  assert.ok(out.includes('陈默（参考图中的人物形象）'));
  assert.ok(!out.includes('林悦（参考图中的人物形象）'), '无参考图无锚点时不应保留指代');
  assert.ok(out.includes('林悦'), '角色名本身应保留');
});

test('sanitizeFramePrompt: 未传参考图信息（提示词生成阶段）保持旧行为', () => {
  const prompt = '陈默（参考图中的人物形象）与林悦（参考图中的人物形象）对视。';
  const out = sanitizeFramePrompt(prompt, ['陈默', '林悦'], [], noopLog);
  assert.ok(out.includes('陈默（参考图中的人物形象）'));
  assert.ok(out.includes('林悦（参考图中的人物形象）'), '生成阶段不改变写法');
});

// ── 站位锁注入去重：同一张首帧不得占两个槽位 ──────────────────────────────────
test('upsertLayoutLockRef: 同图换个路径写法时原地提升，不新增条目', () => {
  const list = ['/static/projects/0012/images/first.png'];
  const out = upsertLayoutLockRef(list, 'projects/0012/images/first.png');
  assert.strictEqual(out.deduped, true);
  assert.strictEqual(out.refs.length, 1, '不应新增条目（历史缺陷：占掉两个参考图槽位）');
  assert.strictEqual(out.refs[0], '/static/projects/0012/images/first.png', '保留既有写法并提升到最前');
});

test('upsertLayoutLockRef: 同图从列表中部提升到最前', () => {
  const list = ['projects/x/scenes/s.png', 'projects/x/images/first.png', 'projects/x/characters/c.png'];
  const out = upsertLayoutLockRef(list, 'projects/x/images/first.png');
  assert.strictEqual(out.deduped, true);
  assert.strictEqual(out.refs.length, 3);
  assert.strictEqual(out.refs[0], 'projects/x/images/first.png', '应被提升到首位（最高权重）');
});

test('upsertLayoutLockRef: 不同图正常前插', () => {
  const list = ['projects/x/scenes/s.png'];
  const out = upsertLayoutLockRef(list, 'projects/x/images/first.png');
  assert.strictEqual(out.deduped, false);
  assert.deepStrictEqual(out.refs, ['projects/x/images/first.png', 'projects/x/scenes/s.png']);
});

// ── 画风词中英去重 ──────────────────────────────────────────────────────────
test('dedupePromptStyleTokens: 中英重复时按主语言保留一份', () => {
  const zh = '超写实摄影风格，8K超清细节，真实皮肤纹理';
  const en = 'photorealistic, ultra-detailed, 8k uhd, sharp focus';
  const prompt = `近景，主角推门而入，${zh}, ${en}`;
  const out = dedupePromptStyleTokens(prompt, zh, en, false);
  assert.strictEqual(out.changed, true);
  assert.strictEqual(out.dropped, 'en');
  assert.ok(out.prompt.includes(zh), '中文风格词应保留');
  assert.ok(!out.prompt.includes(en), '英文风格词应被去掉');
  assert.ok(out.prompt.includes('主角推门而入'), '正文不受影响');
});

test('dedupePromptStyleTokens: 英文剧集保留英文、去掉中文', () => {
  const zh = '超写实摄影风格，8K超清细节';
  const en = 'photorealistic, ultra-detailed, 8k uhd';
  const out = dedupePromptStyleTokens(`Close-up, hero enters, ${zh}, ${en}`, zh, en, true);
  assert.strictEqual(out.dropped, 'zh');
  assert.ok(out.prompt.includes(en));
  assert.ok(!out.prompt.includes(zh));
});

test('dedupePromptStyleTokens: 只有一份风格词时不做任何改动', () => {
  const zh = '超写实摄影风格，8K超清细节';
  const en = 'photorealistic, ultra-detailed';
  const prompt = `近景，主角推门而入，${zh}`;
  const out = dedupePromptStyleTokens(prompt, zh, en, false);
  assert.strictEqual(out.changed, false);
  assert.strictEqual(out.prompt, prompt);
});
