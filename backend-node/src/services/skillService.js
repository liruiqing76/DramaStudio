/**
 * Skill 文件化服务：把默认提示词抽成 skills/*.md 文件，作为提示词默认值的单一来源。
 *
 * 文件格式：
 *   ---
 *   key: storyboard_system
 *   label: 分镜拆解提示词
 *   description: 控制 AI 如何将剧本拆分成分镜头方案（输出格式要求已锁定）
 *   ---
 *   <default_body 多行正文>
 *
 *   <!-- @locked -->
 *   <locked_suffix 多行正文，可选，无则 locked_suffix 为 null>
 */
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const SKILLS_DIR = path.join(__dirname, '..', '..', 'skills');

function parseFrontmatter(content) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(content);
  if (!m) return { meta: {}, body: content };
  let meta = {};
  try {
    meta = yaml.load(m[1]) || {};
  } catch (e) {
    meta = {};
  }
  return { meta, body: content.slice(m[0].length) };
}

function parseSkillFile(filePath) {
  // 归一化换行（CRLF -> LF），保证跨平台解析结果一致
  const raw = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const { meta, body } = parseFrontmatter(raw);
  const parts = body.split(/<!--\s*@locked\s*-->/);
  const default_body = (parts[0] || '').trim();
  // locked_suffix 保留前导换行（与旧硬编码 return '\n...' 一致），仅去除末尾空白
  const locked_suffix = parts.length > 1 ? parts.slice(1).join('').replace(/\s+$/, '') : null;
  return {
    key: (meta.key || '').toString(),
    label: meta.label || meta.key || path.basename(filePath, '.md'),
    description: meta.description || '',
    default_body,
    locked_suffix: locked_suffix || null,
  };
}

function listSkills() {
  if (!fs.existsSync(SKILLS_DIR)) return [];
  return fs
    .readdirSync(SKILLS_DIR)
    .filter((f) => f.endsWith('.md'))
    .map((f) => {
      try {
        return parseSkillFile(path.join(SKILLS_DIR, f));
      } catch (e) {
        return null;
      }
    })
    .filter(Boolean)
    .sort((a, b) => (a.key || '').localeCompare(b.key || ''));
}

function getSkill(key) {
  return listSkills().find((s) => s.key === key) || null;
}

function getDefaultBody(key) {
  const s = getSkill(key);
  return s ? s.default_body : '';
}

function getLockedSuffix(key) {
  const s = getSkill(key);
  return s ? s.locked_suffix : null;
}

module.exports = { SKILLS_DIR, listSkills, getSkill, getDefaultBody, getLockedSuffix };