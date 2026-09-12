
const taskService = require('./taskService');
const aiClient = require('./aiClient');
const promptI18n = require('./promptI18n');
const { safeParseAIJSON, extractFirstArray } = require('../utils/safeJson');
const characterLibraryService = require('./characterLibraryService');
const { mergeCfgStyleWithDrama } = require('../utils/dramaStyleMerge');

/**
 * 从角色外貌描述中提炼 6层视觉锚点，写入 characters.identity_anchors
 * 异步后台执行，不阻塞角色生成主流程
 */
async function enrichIdentityAnchors(db, log, characterId, appearance) {
  if (!appearance || !String(appearance).trim()) return;
  try {
    const systemPrompt = promptI18n.getIdentityAnchorsPrompt();
    const userPrompt = `Character appearance description:\n${appearance}`;
    const raw = await aiClient.generateText(db, log, 'text', userPrompt, systemPrompt, {
      scene_key: 'identity_anchors',
      max_tokens: 800,
      temperature: 0.1,
    });
    const anchors = safeParseAIJSON(raw, log);
    if (!anchors || typeof anchors !== 'object') return;
    const colorPalette = anchors.color_anchors ? JSON.stringify(Object.values(anchors.color_anchors)) : null;
    db.prepare(
      'UPDATE characters SET identity_anchors = ?, color_palette = ?, updated_at = ? WHERE id = ?'
    ).run(JSON.stringify(anchors), colorPalette, new Date().toISOString(), characterId);
    log.info('[锚点] identity_anchors 提炼完成', { character_id: characterId });
  } catch (err) {
    log.warn('[锚点] identity_anchors 提炼失败', { character_id: characterId, error: err.message });
  }
}

async function processCharacterGeneration(db, cfg, log, taskID, req) {
  taskService.updateTaskStatus(db, taskID, 'processing', 0, '正在生成角色...');
  let outlineText = req.outline || '';

  // 读取剧的 style 和 metadata.aspect_ratio，覆盖全局 cfg
  let effectiveCfg = cfg;
  const dramaRow = db.prepare('SELECT id, title, description, genre, style, metadata FROM dramas WHERE id = ? AND deleted_at IS NULL').get(Number(req.drama_id));
  if (!dramaRow) {
    taskService.updateTaskStatus(db, taskID, 'failed', 0, '剧本信息不存在');
    return;
  }
  try {
    let next = { ...cfg, style: { ...(cfg?.style || {}) } };
    if (dramaRow.metadata) {
      const meta = typeof dramaRow.metadata === 'string' ? JSON.parse(dramaRow.metadata) : dramaRow.metadata;
      if (meta && meta.aspect_ratio) {
        next.style.default_image_ratio = meta.aspect_ratio;
      }
    }
    effectiveCfg = mergeCfgStyleWithDrama(next, dramaRow);
  } catch (_) {}

  if (!outlineText) {
    outlineText = promptI18n.formatUserPrompt(
      effectiveCfg,
      'drama_info_template',
      dramaRow.title || '',
      dramaRow.description || '',
      dramaRow.genre || ''
    );
  }
  const userPrompt = promptI18n.formatUserPrompt(effectiveCfg, 'character_request', outlineText);
  const systemPrompt = promptI18n.getCharacterExtractionPrompt(effectiveCfg);
  const temperature = req.temperature != null ? req.temperature : 0.7;

  // 固定 6000 tokens：足够约 10-12 个角色（每角色约 400-500 tokens）
  // repairTruncatedJsonArray 兜底处理极端截断情况
  const maxTokensForChars = 6000;

  let text;
  try {
    text = await aiClient.generateText(db, log, 'text', userPrompt, systemPrompt, {
      scene_key: 'role_extraction',
      model: req.model || undefined,
      temperature,
      max_tokens: maxTokensForChars,
    });
  } catch (err) {
    log.error('Character generation AI failed', { error: err.message, task_id: taskID });
    taskService.updateTaskStatus(db, taskID, 'failed', 0, 'AI生成失败: ' + err.message);
    return;
  }

  console.log('[角色生成] AI 原始返回：\n' + text);

  let result;
  try {
    const parsed = safeParseAIJSON(text, log);
    result = extractFirstArray(parsed) || [];
  } catch (err) {
    log.error('Character generation parse failed', { error: err.message, task_id: taskID });
    console.error('[角色生成] JSON解析失败，原始内容：\n' + text);
    taskService.updateTaskStatus(db, taskID, 'failed', 0, '解析AI返回结果失败');
    return;
  }

  const dramaId = Number(req.drama_id);
  const now = new Date().toISOString();

  // 再次「从剧本提取角色」时先清空本集已关联角色，避免与旧数据累加；仅软删除不再被任何分集引用的角色行
  if (req.episode_id) {
    const episodeId = Number(req.episode_id);
    const linkedRows = db.prepare('SELECT character_id FROM episode_characters WHERE episode_id = ?').all(episodeId);
    for (const row of linkedRows) {
      const cid = Number(row.character_id);
      const other = db
        .prepare('SELECT COUNT(*) AS n FROM episode_characters WHERE character_id = ? AND episode_id != ?')
        .get(cid, episodeId);
      if (other && other.n === 0) {
        db.prepare('UPDATE characters SET deleted_at = ? WHERE id = ? AND drama_id = ? AND deleted_at IS NULL').run(
          now,
          cid,
          dramaId
        );
      }
    }
    db.prepare('DELETE FROM episode_characters WHERE episode_id = ?').run(episodeId);
  }

  const characters = [];

  for (const char of result) {
    const name = (char.name || '').trim();
    if (!name) continue;
    const existing = db.prepare('SELECT id, name FROM characters WHERE drama_id = ? AND name = ? AND deleted_at IS NULL').get(dramaId, name);
    if (existing) {
      characters.push({
        id: existing.id,
        drama_id: dramaId,
        name: existing.name,
        role: null,
        description: null,
        personality: null,
        appearance: null,
        voice_style: null,
      });
      continue;
    }
    const info = db.prepare(
      `INSERT INTO characters (drama_id, name, role, description, personality, appearance, voice_style, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`
    ).run(
      dramaId,
      name,
      char.role ?? null,
      char.description ?? null,
      char.personality ?? null,
      char.appearance ?? null,
      char.voice_style ?? null,
      now,
      now
    );
    const newCharId = info.lastInsertRowid;
    // 异步后台提炼视觉锚点 + 预生成图片提示词，不阻塞主流程
    if (char.appearance) {
      setImmediate(() => {
        enrichIdentityAnchors(db, log, newCharId, char.appearance).catch(() => {});
        characterLibraryService.generateCharacterPromptOnly(db, log, effectiveCfg, newCharId, undefined, undefined).catch((err) => {
          log.warn('[提取角色] 预生成polished_prompt失败', { character_id: newCharId, error: err.message });
        });
      });
    }
    characters.push({
      id: newCharId,
      drama_id: dramaId,
      name,
      role: char.role ?? null,
      description: char.description ?? null,
      personality: char.personality ?? null,
      appearance: char.appearance ?? null,
      voice_style: char.voice_style ?? null,
    });
  }

  if (req.episode_id && characters.length > 0) {
    const episodeId = Number(req.episode_id);
    for (const c of characters) {
      try {
        db.prepare('INSERT OR IGNORE INTO episode_characters (episode_id, character_id) VALUES (?, ?)').run(episodeId, c.id);
      } catch (_) {}
    }
  }

  taskService.updateTaskResult(db, taskID, { characters, count: characters.length });
  log.info('Character generation completed', { task_id: taskID, drama_id: req.drama_id, character_count: characters.length });
}

function generateCharacters(db, cfg, log, req) {
  const dramaId = String(req.drama_id || '');
  if (!dramaId) throw new Error('drama_id 必填');
  const task = taskService.createTask(db, log, 'character_generation', dramaId);
  setImmediate(() => {
    processCharacterGeneration(db, cfg, log, task.id, {
      drama_id: req.drama_id,
      episode_id: req.episode_id,
      outline: req.outline,
      temperature: req.temperature,
      model: req.model,
    }).catch((err) => {
      log.error('processCharacterGeneration fatal', { error: err.message, task_id: task.id });
    });
  });
  return task.id;
}

/**
 * 从剧本中单独重新提取某个角色的 appearance/description
 * 只更新该角色，不影响其他角色
 */
async function reextractSingleCharacter(db, cfg, log, characterId) {
  const charRow = db.prepare(
    'SELECT id, drama_id, name FROM characters WHERE id = ? AND deleted_at IS NULL'
  ).get(Number(characterId));
  if (!charRow) return { ok: false, error: '角色不存在' };

  const dramaRow = db.prepare(
    'SELECT id, title, description, genre, style, metadata FROM dramas WHERE id = ? AND deleted_at IS NULL'
  ).get(charRow.drama_id);
  if (!dramaRow) return { ok: false, error: '剧本不存在' };

  let effectiveCfg = cfg;
  try {
    let next = { ...cfg, style: { ...(cfg?.style || {}) } };
    if (dramaRow.metadata) {
      const meta = typeof dramaRow.metadata === 'string' ? JSON.parse(dramaRow.metadata) : dramaRow.metadata;
      if (meta && meta.aspect_ratio) {
        next.style.default_image_ratio = meta.aspect_ratio;
      }
    }
    effectiveCfg = mergeCfgStyleWithDrama(next, dramaRow);
  } catch (_) {}

  const systemPrompt = promptI18n.getCharacterExtractionPrompt(effectiveCfg);
  const dramaInfo = promptI18n.formatUserPrompt(
    effectiveCfg,
    'drama_info_template',
    dramaRow.title || '',
    dramaRow.description || '',
    dramaRow.genre || ''
  );
  const userPrompt = `${dramaInfo}\n\n【特别注意】请只重新提取角色「${charRow.name}」的设定，忽略其他角色。只返回包含该角色的 JSON 数组（数组中只有 1 个元素）。`;

  let text;
  try {
    text = await aiClient.generateText(db, log, 'text', userPrompt, systemPrompt, {
      scene_key: 'role_extraction',
      temperature: 0.7,
      max_tokens: 2000,
    });
  } catch (err) {
    return { ok: false, error: 'AI 生成失败: ' + err.message };
  }

  let parsed;
  try {
    const raw = safeParseAIJSON(text, log);
    const arr = extractFirstArray(raw) || [];
    parsed = arr.find((c) => (c.name || '').trim() === charRow.name) || arr[0];
  } catch (err) {
    return { ok: false, error: '解析 AI 返回结果失败' };
  }
  if (!parsed) return { ok: false, error: 'AI 未返回角色「' + charRow.name + '」的信息' };

  const now = new Date().toISOString();
  db.prepare(
    'UPDATE characters SET appearance = ?, description = ?, role = ?, updated_at = ? WHERE id = ?'
  ).run(
    parsed.appearance ?? null,
    parsed.description ?? null,
    parsed.role ?? null,
    now,
    charRow.id
  );

  if (parsed.appearance) {
    try {
      await characterLibraryService.generateCharacterPromptOnly(db, log, effectiveCfg, charRow.id, undefined, undefined);
    } catch (err) {
      log.warn('[单独重新提取] 预生成polished_prompt失败', { character_id: charRow.id, error: err.message });
    }
    setImmediate(() => {
      enrichIdentityAnchors(db, log, charRow.id, parsed.appearance).catch(() => {});
    });
  }

  const updatedChar = db.prepare('SELECT polished_prompt FROM characters WHERE id = ?').get(charRow.id);
  log.info('[单独重新提取] 完成', { character_id: charRow.id, name: charRow.name });
  return {
    ok: true,
    character: {
      id: charRow.id,
      name: charRow.name,
      appearance: parsed.appearance ?? null,
      description: parsed.description ?? null,
      role: parsed.role ?? null,
      polished_prompt: updatedChar?.polished_prompt ?? null,
    },
  };
}

/**
 * AI 对话式修改角色 appearance
 * 用户输入修改需求，AI 根据当前 appearance 生成修改后的 appearance
 */
async function chatModifyCharacter(db, cfg, log, characterId, userMessage) {
  const charRow = db.prepare(
    'SELECT id, drama_id, name, appearance, description FROM characters WHERE id = ? AND deleted_at IS NULL'
  ).get(Number(characterId));
  if (!charRow) return { ok: false, error: '角色不存在' };

  const dramaRow = db.prepare('SELECT id, style, metadata FROM dramas WHERE id = ? AND deleted_at IS NULL').get(charRow.drama_id);
  let effectiveCfg = cfg;
  try {
    effectiveCfg = mergeCfgStyleWithDrama({ ...cfg, style: { ...(cfg?.style || {}) } }, dramaRow || {});
  } catch (_) {}

  const systemPrompt = `你是一个角色外貌修改助手。用户会给你当前角色的外貌描述和修改需求，你需要输出修改后的完整外貌描述。

规则：
1. 保持 7 维度结构：基础信息（性别/年龄/身高/体型）、骨相/脸型、五官、辨识标记、发型、肤色与肤质、标志性服装
2. 只修改用户要求的部分，其他部分保持不变
3. 输出必须是完整的外貌描述文本（不是 JSON），直接可以用于 AI 生图
4. 保持中文输出
5. 不要输出任何解释说明，只输出修改后的外貌描述`;

  const userPrompt = `角色名称：${charRow.name}

当前外貌描述：
${charRow.appearance || '（暂无）'}

修改需求：
${userMessage}

请输出修改后的完整外貌描述：`;

  let newAppearance;
  try {
    newAppearance = await aiClient.generateText(db, log, 'text', userPrompt, systemPrompt, {
      scene_key: 'character_chat_modify',
      temperature: 0.7,
      max_tokens: 2000,
    });
    newAppearance = newAppearance.trim();
  } catch (err) {
    return { ok: false, error: 'AI 修改失败: ' + err.message };
  }

  const now = new Date().toISOString();
  db.prepare('UPDATE characters SET appearance = ?, updated_at = ? WHERE id = ?').run(newAppearance, now, charRow.id);

  try {
    await characterLibraryService.generateCharacterPromptOnly(db, log, effectiveCfg, charRow.id, undefined, undefined);
  } catch (err) {
    log.warn('[AI修改] 预生成polished_prompt失败', { character_id: charRow.id, error: err.message });
  }

  const updatedChar = db.prepare('SELECT polished_prompt FROM characters WHERE id = ?').get(charRow.id);
  log.info('[AI修改] 完成', { character_id: charRow.id, name: charRow.name });
  return {
    ok: true,
    character: {
      id: charRow.id,
      name: charRow.name,
      appearance: newAppearance,
      polished_prompt: updatedChar?.polished_prompt ?? null,
    },
  };
}

module.exports = {
  generateCharacters,
  enrichIdentityAnchors,
  reextractSingleCharacter,
  chatModifyCharacter,
};
