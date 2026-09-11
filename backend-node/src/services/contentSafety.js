/**
 * 内容安全审核服务
 *
 * 功能：
 * 1. 提示词安全检查 — 在发送给 AI 前检测敏感内容
 * 2. 提示词净化 — 替换敏感词、移除 IP 名、拆解双关词
 * 3. 审核错误识别 — 判断 AI 返回的错误是否为内容审核失败
 *
 * 参考：short-drama-ai-skills/SD2审核筛查/ 的 9 大类敏感检测 + IP 规避 + 双关词拆解
 */

const SENSITIVE_KEYWORDS = [
  'nsfw', 'nudity', 'naked', 'nude', 'porn', 'erotic', 'hentai',
  '色情', '裸体', '裸露', '淫秽', '黄色',
  'violence', 'gore', 'blood', 'massacre', 'beheading',
  '暴力', '血腥', '屠杀', '斩首', '虐杀',
  'terrorist', 'terrorism', 'bomb', 'explosion',
  '恐怖', '炸弹', '爆炸', '极端',
  'child abuse', 'minor', 'underage',
  '未成年', '儿童', '少年',
  'drug', 'heroin', 'cocaine', 'meth',
  '毒品', '吸毒', '贩毒',
  'gambling', 'casino',
  '赌博', '赌场',
  'self-harm', 'suicide',
  '自残', '自杀',
];

const IP_REPLACEMENTS = [
  [/\b草薙京\b/g, '红发格斗家'],
  [/\b春丽\b/g, '旗袍女格斗家'],
  [/\b钢铁侠\b/g, '红色机甲英雄'],
  [/\b蜘蛛侠\b/g, '紧身衣英雄'],
  [/\b蝙蝠侠\b/g, '黑色斗篷英雄'],
  [/\b超人\b/g, '蓝色披风英雄'],
  [/\b黑豹\b/g, '黑色豹子'],
  [/\b毒液\b/g, '黑色粘液生物'],
  [/\b金刚\b/g, '巨型猩猩'],
  [/\b钢铁侠\b/g, '红色机甲英雄'],
  [/\b美国队长\b/g, '盾牌英雄'],
  [/\b雷神\b/g, '锤神'],
  [/\b灭霸\b/g, '紫色下巴反派'],
  [/\b小丑\b/g, '涂面反派'],
  [/\b哈利波特\b/g, '魔法少年'],
  [/\b伏地魔\b/g, '无鼻黑袍法师'],
];

const AMBIGUOUS_WORD_REPLACEMENTS = [
  [/废弃仓库里/g, '废弃仓库内'],
  [/库里/g, '库内'],
];

const MODERATION_ERROR_KEYWORDS = [
  'moderation', 'sensitive', 'violation', 'blocked', 'banned',
  'content_filter', 'content policy', 'risk control',
  'content_violation', 'moderation_blocked',
  '审核', '违规', '敏感', '禁止', '不合规',
  '内容审核', '内容违规', '未通过审核',
  'real person', '真人', '人脸',
];

function checkPromptSafety(prompt) {
  if (!prompt) return { safe: true, warnings: [], suggestions: [] };
  const text = String(prompt).toLowerCase();
  const warnings = [];
  const suggestions = [];

  for (const kw of SENSITIVE_KEYWORDS) {
    if (text.includes(kw.toLowerCase())) {
      warnings.push(kw);
      suggestions.push(`建议移除或替换敏感词: "${kw}"`);
    }
  }

  for (const [re, replacement] of IP_REPLACEMENTS) {
    if (re.test(prompt)) {
      warnings.push(`IP名称: ${re.source}`);
      suggestions.push(`建议替换IP名称为通用描述: "${replacement}"`);
    }
  }

  return {
    safe: warnings.length === 0,
    warnings,
    suggestions,
  };
}

function sanitizePrompt(prompt) {
  if (!prompt) return prompt;
  let result = String(prompt);

  for (const [re, replacement] of IP_REPLACEMENTS) {
    result = result.replace(re, replacement);
  }

  for (const [re, replacement] of AMBIGUOUS_WORD_REPLACEMENTS) {
    result = result.replace(re, replacement);
  }

  return result;
}

function isContentModerationError(error) {
  if (!error) return false;
  const msg = String(
    typeof error === 'string' ? error :
    error.message || error.error || error.msg || JSON.stringify(error)
  ).toLowerCase();

  for (const kw of MODERATION_ERROR_KEYWORDS) {
    if (msg.includes(kw.toLowerCase())) return true;
  }

  const status = error.status || error.statusCode || error.code;
  if (status === 403 || status === 451) return true;

  return false;
}

function getModerationHint() {
  return '内容可能触发审核，建议：1) 修改提示词中的敏感内容 2) 尝试更换 AI 模型 3) 使用更通用的描述';
}

module.exports = {
  SENSITIVE_KEYWORDS,
  MODERATION_ERROR_KEYWORDS,
  checkPromptSafety,
  sanitizePrompt,
  isContentModerationError,
  getModerationHint,
};