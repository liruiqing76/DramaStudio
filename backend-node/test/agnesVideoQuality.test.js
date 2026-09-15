const { test } = require('node:test');
const assert = require('node:assert');
const { adaptPromptForAgnes, mapResolutionToAgnesSize } = require('../src/services/videoClient');
const { agnesReferencePriority } = require('../src/services/videoService');

const noopLog = { info() {}, warn() {} };

// 真实线上样本（video_generations id=168，2026-09-13 发送给 Agnes 的原文，609 字）
const REAL_PROMPT_168 =
  '场景：公司开放办公区，深夜。镜头标题：贴上标签。动作：陈默的旧版深蓝工牌被一张写有"资源池"的标签死死贴住，工牌边缘翘起。。结果：工牌被彻底覆盖，标识着其身份的降级与边缘化。。景别：特写。镜头角度：特写·俯拍·正面（close-up shot (face/bust framing), subject fills most of frame, shallow depth of field, background softly blurred, high-angle bird\'s eye view, camera above looking down, background shows floor/ground with downward perspective distortion, shooting from the front）。运镜：缓慢推镜push。氛围：冷白光，封印，沉重。情绪：沉重。情绪强度：1。配乐：无背景音乐。音效：不干胶标签撕拉声、"啪"的贴紧声、沉闷音色。时长：5秒。风格：photorealistic, ultra-detailed, 8k uhd, sharp focus, natural lighting, real skin texture, hyperrealism, professional photography, RAW photo。=VideoRatio: 16:9';

test('adaptPromptForAgnes: 剥离 =VideoRatio 模板残留', () => {
  const out = adaptPromptForAgnes('场景：街头。动作：主角奔跑。=VideoRatio: 16:9', 'text', noopLog);
  assert.ok(!/=?VideoRatio/i.test(out), '不应出现 =VideoRatio 标记');
  assert.ok(out.includes('主角奔跑'));
});

test('adaptPromptForAgnes: 整体删除 配乐/音效/情绪强度/时长/镜头标题 垃圾子句', () => {
  const out = adaptPromptForAgnes(REAL_PROMPT_168, 'keyframe', noopLog);
  assert.ok(!out.includes('配乐'), '配乐子句应被删除');
  assert.ok(!out.includes('音效'), '音效子句应被删除');
  assert.ok(!out.includes('情绪强度'), '情绪强度子句应被删除');
  assert.ok(!out.includes('时长'), '时长子句应被删除');
  assert.ok(!out.includes('贴上标签'), '镜头标题内容应被删除');
});

test('adaptPromptForAgnes: 保留 动作/结果/运镜/场景 核心内容', () => {
  const out = adaptPromptForAgnes(REAL_PROMPT_168, 'keyframe', noopLog);
  assert.ok(out.includes('公司开放办公区'), '场景内容应保留');
  assert.ok(out.includes('工牌边缘翘起'), '动作内容应保留');
  assert.ok(out.includes('工牌被彻底覆盖'), '结果内容应保留');
  assert.ok(out.includes('缓慢推镜push'), '运镜内容应保留');
  // 英文摄影括注应被剥离
  assert.ok(!out.includes('shallow depth of field'), '英文摄影括注应被剥离');
});

test('adaptPromptForAgnes: 真实样本清洗为完整有效内容（历史 300 字硬切回归）', () => {
  // 历史缺陷：609 字样本在 keyframe 模式被 300 字硬截断，动作/结果描述丢一半。
  // 修复后垃圾子句先删净，剩余全部为有效内容（101 字），任何一句都不被硬切。
  const out = adaptPromptForAgnes(REAL_PROMPT_168, 'keyframe', noopLog);
  assert.strictEqual(
    out,
    '公司开放办公区，深夜。陈默的旧版深蓝工牌被一张写有"资源池"的标签死死贴住，工牌边缘翘起。工牌被彻底覆盖，标识着其身份的降级与边缘化。特写。特写·俯拍·正面 。缓慢推镜push。冷白光，封印，沉重。沉重'
  );
});

test('adaptPromptForAgnes: keyframe 模式剥离风格标签堆（风格由首帧承载）', () => {
  const out = adaptPromptForAgnes('动作：主角转身。风格：photorealistic, ultra-detailed, 8k uhd, sharp focus', 'keyframe', noopLog);
  assert.ok(!out.includes('photorealistic'), 'keyframe 模式应剥离风格标签堆');
});

test('adaptPromptForAgnes: reference/text 模式保留风格词', () => {
  const out = adaptPromptForAgnes('场景：街头。动作：主角转身。风格：photorealistic, ultra-detailed, 8k uhd', 'reference', noopLog);
  assert.ok(out.includes('photorealistic'), 'reference 模式应保留风格词');
});

test('adaptPromptForAgnes: 超长提示词按子句丢弃低价值描述，保住动作', () => {
  const longPrompt =
    '场景：城市夜景，霓虹灯闪烁，车流在街道上穿梭，远处高楼灯光星星点点，雨后的路面反射着光影，行人三三两两撑伞走过，街角咖啡店暖黄的灯光透过玻璃窗洒出来，广告牌在楼顶缓慢旋转，地铁站入口的灯光把积水照得发亮，报刊亭的卷帘门半开着，里面透出昏黄的灯泡光，天桥上有人驻足拍照，桥下的隧道车灯连成光带，广场的喷泉在夜色中静静喷涌，几只流浪猫蹲在垃圾桶边觅食，一切笼罩在潮湿的深蓝色调里。' +
    '动作：主角从出租车上跳下来，捏着那张写着地址的纸条，快步穿过斑马线，在人群里侧身挤过，最后停在写字楼旋转门前，抬头看了一眼顶层还亮着的办公室窗户，深吸一口气推门而入，没有回头。' +
    '结果：门在身后缓缓合上，电梯指示灯亮起，主角按下楼层按钮，电梯门关上的一瞬间，走廊尽头传来一声若有若无的叹息，灯光忽明忽暗。' +
    '运镜：跟镜tracking。' +
    '景别：中景。' +
    '氛围：紧张，压抑，冷色调。' +
    '情绪：不安。' +
    '风格：photorealistic, ultra-detailed, 8k uhd, sharp focus, natural lighting, real skin texture, hyperrealism, professional photography, RAW photo';
  const out = adaptPromptForAgnes(longPrompt, 'reference', noopLog);
  assert.ok(out.length <= 500, `超限提示词应裁剪到 500 字内，实际 ${out.length}`);
  assert.ok(out.includes('快步穿过斑马线'), '高价值动作子句应被保留');
  assert.ok(out.includes('推门而入'), '动作子句应整句保留，不被硬切');
  assert.ok(!out.includes('不安'), '低价值的情绪/氛围子句应被优先丢弃');
});

test('mapResolutionToAgnesSize: 常见档位映射', () => {
  assert.strictEqual(mapResolutionToAgnesSize('480p'), '480P');
  assert.strictEqual(mapResolutionToAgnesSize('540p'), '540P');
  assert.strictEqual(mapResolutionToAgnesSize('720p'), '720P');
  assert.strictEqual(mapResolutionToAgnesSize('1080p'), '1080P');
  assert.strictEqual(mapResolutionToAgnesSize('2k'), '1440P');
  assert.strictEqual(mapResolutionToAgnesSize('4k'), '2160P');
});

test('mapResolutionToAgnesSize: 缺失/非法值回退 720P', () => {
  assert.strictEqual(mapResolutionToAgnesSize(undefined), '720P');
  assert.strictEqual(mapResolutionToAgnesSize(null), '720P');
  assert.strictEqual(mapResolutionToAgnesSize(''), '720P');
  assert.strictEqual(mapResolutionToAgnesSize('garbage'), '720P');
  assert.strictEqual(mapResolutionToAgnesSize('999p'), '720P');
});

test('agnesReferencePriority: 显式首/尾帧（含 image_url）优先 keyframe', () => {
  assert.strictEqual(agnesReferencePriority({ first_frame_url: 'http://x/f.png' }), true);
  assert.strictEqual(agnesReferencePriority({ last_frame_url: 'http://x/l.png' }), true);
  assert.strictEqual(agnesReferencePriority({ image_url: 'http://x/i.png' }), true);
  assert.strictEqual(agnesReferencePriority({ first_frame_url: 'a', last_frame_url: 'b' }), true);
  assert.strictEqual(agnesReferencePriority({}), false);
  assert.strictEqual(agnesReferencePriority(null), false);
});

test('agnesReferencePriority: 前端经典模式误塞 reference_image_urls 不会抢占 keyframe', () => {
  // 历史 bug：首尾帧图片被塞进 reference_image_urls，但行内首尾帧字段为空 → 应仍走 reference
  assert.strictEqual(agnesReferencePriority({ reference_image_urls: '["http://x/f.png","http://x/l.png"]' }), false);
  // 正常前端同时传了 first_frame_url → keyframe 优先，误塞数据被忽略
  assert.strictEqual(
    agnesReferencePriority({ first_frame_url: 'http://x/f.png', reference_image_urls: '["http://x/f.png"]' }),
    true
  );
});