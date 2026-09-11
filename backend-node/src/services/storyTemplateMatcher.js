/**
 * 题材模板匹配器：根据用户输入的「梗概文本 + 风格 + 类型」自动挑选最合适的短剧题材模板。
 *
 * 设计目标：让主剧本生成流程真正消费 src/templates/*.yaml 里沉淀的
 * 角色原型 / 经典套路 / 三幕结构 / 节奏模式，而不是每次都让 AI「随意写一个剧本」。
 *
 * 匹配失败时返回 null，调用方须优雅降级为通用提示词（不得抛错中断生成）。
 */
const templateLoader = require('../templates/index');

// 每个题材模板的中文触发词。命中越多，得分越高。
const KEYWORDS = {
  'ancient-costume': ['古装', '古代', '宫斗', '武侠', '仙侠', '宫廷', '皇上', '皇帝', '公主', '王爷', '娘娘', '剑', '江湖', '朝代', '将军', '王妃'],
  campus: ['校园', '学校', '高中', '大学', '学生', '教室', '宿舍', '同桌', '校服', '青春', '毕业', '军训', '社团'],
  revenge: ['复仇', '报仇', '逆袭', '打脸', '陷害', '背叛', '隐忍', '归来', '翻盘', '复仇者', '手撕', '报复', '洗刷冤屈'],
  'romance-boss': ['霸总', '总裁', 'CEO', '豪门', '灰姑娘', '契约', '结婚', '联姻', '霸道', '董事长', '秘书', '职场恋爱'],
  'sci-fi': ['科幻', '未来', '外星', '机器人', 'AI', '星际', '太空', '基因', '克隆', '赛博', '时空机器', '末日', '异星'],
  suspense: ['悬疑', '推理', '凶案', '谋杀', '侦探', '谜题', '密室', '线索', '真相', '凶手', '警方', '案件', '犯罪'],
  'sweet-pet': ['甜宠', '宠爱', '治愈', '甜蜜', '撒糖', '青梅竹马', '宠妻', '日常恋爱', '暖心', '双向奔赴'],
  'time-travel': ['穿越', '重回', '重生', '回到过去', '穿书', '魂穿', '时光', '一场梦醒', '前世今生'],
  urban: ['都市', '职场', '创业', '北漂', '合租', '外卖', '打工', '白领', '现实', '打工人', '房贷', '公司'],
};

/**
 * 依据梗概/风格/类型匹配题材模板。
 * @param {string} premise 故事梗概
 * @param {string} style   风格（modern/ancient/fantasy/daily）
 * @param {string} type    类型（drama/comedy/adventure）
 * @returns {object|null}  匹配到的完整模板对象（含 character_archetypes 等），无匹配返回 null
 */
function matchTemplate(premise, style, type) {
  const text = String(premise || '');
  if (!text.trim()) return null;

  const scores = {};
  const keywordScores = {};
  for (const [id, words] of Object.entries(KEYWORDS)) {
    let score = 0;
    for (const w of words) {
      // 每次出现计 1 分，出现多次额外加权（上限 +2），避免长文本简单堆词刷分
      const hits = text.split(w).length - 1;
      if (hits > 0) score += 1 + Math.min(hits - 1, 2) * 0.5;
    }
    if (score > 0) {
      scores[id] = score;
      keywordScores[id] = score;
    }
  }

  // 没有任何关键词命中 → 返回 null，交给通用提示词，避免"噪声题材"误导创作
  if (Object.keys(keywordScores).length === 0) return null;

  // 风格/类型的兜底加权：仅在已有关键词命中的题材上做倾向性微调
  const s = String(style || '').toLowerCase();
  const t = String(type || '').toLowerCase();
  const bump = (id, delta) => {
    if (keywordScores[id]) scores[id] = (scores[id] || 0) + delta;
  };
  if (s === 'ancient') bump('ancient-costume', 1.5);
  if (s === 'fantasy') bump('sci-fi', 1);
  if (s === 'modern' || s === 'daily') bump('urban', 1);
  if (t === 'comedy') bump('sweet-pet', 1);

  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  if (ranked.length === 0) return null;

  const [bestId] = ranked[0];

  try {
    return templateLoader.get(bestId);
  } catch (_) {
    return null;
  }
}

/**
 * 把题材模板渲染成可注入系统提示词的参考块。
 * 模板缺失字段时逐项跳过，绝不产生 "undefined" 文本。
 * @returns {string} 空字符串表示无可用模板信息
 */
function buildTemplateGuidance(template) {
  if (!template || typeof template !== 'object') return '';
  const lines = [];
  lines.push('');
  lines.push('═══════════════════════════════════');
  lines.push(`【本剧题材参考：${template.name || template.id || '未命名题材'}】`);
  lines.push('═══════════════════════════════════');
  if (template.description) {
    lines.push(`题材定位：${template.description}`);
  }

  const arch = template.character_archetypes;
  if (arch && typeof arch === 'object') {
    const parts = [];
    if (arch.male) parts.push(`男主原型：${arch.male}`);
    if (arch.female) parts.push(`女主原型：${arch.female}`);
    if (Array.isArray(arch.support) && arch.support.length) parts.push(`配角原型：${arch.support.join('、')}`);
    if (parts.length) {
      lines.push('');
      lines.push('【角色原型（可作为人物塑造的起点，需结合梗概具体化）】');
      parts.forEach((p) => lines.push(`- ${p}`));
    }
  }

  if (Array.isArray(template.classic_tropes) && template.classic_tropes.length) {
    lines.push('');
    lines.push('【该题材的经典套路（至少使用其中 2 项，并做出新鲜化处理，避免俗套）】');
    template.classic_tropes.forEach((trope, i) => lines.push(`${i + 1}. ${trope}`));
  }

  const act = template.three_act_structure;
  if (act && typeof act === 'object') {
    const parts = [];
    if (act.act1) parts.push(`第一幕（建置）：${act.act1}`);
    if (act.act2) parts.push(`第二幕（对抗）：${act.act2}`);
    if (act.act3) parts.push(`第三幕（结局）：${act.act3}`);
    if (parts.length) {
      lines.push('');
      lines.push('【三幕结构（多集时需按此宏观走向铺陈，不得偏离）】');
      parts.forEach((p) => lines.push(`- ${p}`));
    }
  }

  lines.push('');
  lines.push('【使用要求】');
  lines.push('1. 以上题材参考为**创作骨架**，必须与用户的具体梗概融合，禁止生搬硬套或让模板喧宾夺主。');
  lines.push('2. 角色原型只是起点——必须结合梗概给出具体的姓名、身份、年龄与性格，不得直接沿用原型描述文字。');
  lines.push('3. 若用户梗概与题材倾向存在冲突，**以用户梗概为准**，题材仅作调性参考。');
  return lines.join('\n');
}

module.exports = { matchTemplate, buildTemplateGuidance, KEYWORDS };
