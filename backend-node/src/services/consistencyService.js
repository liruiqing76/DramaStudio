// 跨集/全剧一致性校验：只做【可检查、不中断】的静态体检，返回发现的问题清单。
// 背景：剧集按「逐集串行、角色/场景只靠存在即跳过」的方式生成，
// 容易出现角色形象漂移、同地点场景外观不一致等问题，本服务用于提前体检。
// 不修改任何数据，供 GET /dramas/:id/consistency 调用。

function trim(s) {
  return String(s || '').trim();
}

function hasAnchor(c) {
  // 六维身份锚点任一有内容即视为有稳定身份
  const a = c.identity_anchors;
  if (a) {
    try {
      const j = typeof a === 'string' ? JSON.parse(a) : a;
      if (j && typeof j === 'object' && Object.keys(j).some((k) => trim(j[k]))) return true;
    } catch (_) { /* 无法解析也按"有值"处理 */ }
  }
  return !!trim(c.appearance) || !!trim(c.ref_image) || !!trim(c.polished_prompt);
}

/**
 * 检查一个剧本的一致性，返回 findings 数组：
 * [{ severity: 'warning'|'info', code, message, count }]
 * @param {import('better-sqlite3').Database} db
 * @param {number} dramaId
 * @returns {{ ok: boolean, findings: Array<object>, counts: object }}
 */
function checkDramaConsistency(db, dramaId) {
  const findings = [];
  const counts = { characters: 0, scenes: 0, episodes: 0, storyboards: 0 };

  const eps = db.prepare(
    "SELECT id, episode_number FROM episodes WHERE drama_id = ? AND deleted_at IS NULL ORDER BY episode_number"
  ).all(dramaId);
  counts.episodes = eps.length;

  counts.storyboards = db.prepare(
    `SELECT COUNT(*) cnt FROM storyboards sb
       JOIN episodes e ON sb.episode_id = e.id
      WHERE e.drama_id = ? AND sb.deleted_at IS NULL`
  ).get(dramaId).cnt || 0;

  // ── 角色 ──
  const chars = db.prepare(
    "SELECT id, name, identity_anchors, appearance, ref_image, polished_prompt FROM characters WHERE drama_id = ? AND deleted_at IS NULL"
  ).all(dramaId);
  counts.characters = chars.length;

  const nameSeen = new Map();
  for (const c of chars) {
    const key = trim(c.name).toLowerCase();
    if (!key) {
      findings.push({ severity: 'warning', code: 'char_name_empty', message: '存在未命名的角色', count: 1 });
      continue;
    }
    if (nameSeen.has(key)) {
      // 同一剧里重名角色 → 身份极易分裂
      findings.push({
        severity: 'warning', code: 'char_dup_name',
        message: `角色名「${trim(c.name)}」出现 ${nameSeen.get(key) + 1} 次，跨集可能生成不一致形象`,
        count: 2,
      });
    }
    nameSeen.set(key, (nameSeen.get(key) || 0) + 1);
  }
  const charsNoAnchor = chars.filter((c) => !hasAnchor(c));
  if (charsNoAnchor.length) {
    findings.push({
      severity: 'warning', code: 'char_no_anchor',
      message: `${charsNoAnchor.length} 个角色缺少身份锚点/外观描述，跨集易出现形象漂移：${charsNoAnchor.map((c) => trim(c.name) || `#${c.id}`).slice(0, 5).join('、')}`,
      count: charsNoAnchor.length,
    });
  }

  // ── 场景 ──
  const scenes = db.prepare(
    "SELECT id, episode_id, location, time FROM scenes WHERE drama_id = ? AND deleted_at IS NULL"
  ).all(dramaId);
  counts.scenes = scenes.length;
  const sceneByPair = new Map();
  const noLocation = scenes.filter((s) => !trim(s.location));
  if (noLocation.length) {
    findings.push({ severity: 'info', code: 'scene_no_location', message: `${noLocation.length} 个场景缺少地点(location)`, count: noLocation.length });
  }
  for (const s of scenes) {
    const loc = trim(s.location);
    if (!loc) continue;
    const t = trim(s.time) || '(时间未定)';
    const key = loc.toLowerCase();
    const list = sceneByPair.get(key) || [];
    list.push({ id: s.id, ep: s.episode_id, time: t });
    sceneByPair.set(key, list);
  }
  for (const [loc, list] of sceneByPair.entries()) {
    if (list.length < 2) continue;
    const epsSet = new Set(list.map((x) => x.ep).filter((x) => x != null));
    // 同一地点出现在不同集：各集若独立生成场景图，外观可能不一致 → 值得提醒
    if (epsSet.size > 1) {
      findings.push({
        severity: 'info', code: 'scene_cross_episode',
        message: `地点「${loc}」跨 ${epsSet.size} 集出现 ${list.length} 次，各集若独立生成场景图，注意保持视觉一致`,
        count: list.length,
      });
    } else if (list.length > 1) {
      // 同一集内重复：可能是「同地点不同时间/光照」的合理拆分，也可能是重复建场景
      const times = new Set(list.map((x) => x.time));
      if (times.size === 1) {
        findings.push({
          severity: 'info', code: 'scene_dup_in_episode',
          message: `地点「${loc}」在同一集内重复 ${list.length} 次且时间相同，可考虑复用同一场景素材`,
          count: list.length,
        });
      }
    }
  }

  // ── 汇总 ──
  const ok = !findings.some((f) => f.severity === 'warning');
  return { ok, findings, counts };
}

module.exports = { checkDramaConsistency };