/**
 * VLM 质检服务 — 移植自 VideoClaw 的 VLM 闭环质检机制
 *
 * 核心能力：
 * 1. evaluateStoryboardFrame()  — 用 VLM 评估单帧分镜图是否合格（hard_failures + soft_issues 双层评分）
 * 2. regenerateUntilAcceptable() — 闭循环：生成 → VLM 评估 → 不合格则带 suggestion 重生成，最多 N 次
 * 3. checkEpisodeContinuity()    — 用 staging_continuity prompt 检查整集站位一致性，patches 自动回写
 *
 * 安全护栏：
 * - enabled 默认 false，显式开启才生效
 * - max_iterations=2 硬上限，防死循环烧钱
 * - 跳过四宫格/九宫格，仅对单帧分镜生效
 * - VLM 调用失败时不重生成，记 warn 直接放行（跟 Step3.5 snapshot 异步降级一致）
 */

const path = require('path');
const fs = require('fs');
const promptI18n = require('./promptI18n');
const aiClient = require('./aiClient');

// ── 默认配置 ──
const DEFAULTS = {
  enabled: false,          // 质检总开关，默认关
  maxIterations: 2,        // 最大重生成次数（不含首次），硬上限
  scoreThreshold: 7,       // 合格分数线（满分10）
  skipFrameTypes: ['quad_grid', 'nine_grid'], // 跳过这些帧类型
};

/**
 * 从 config.yaml 读取 VLM 质检配置
 * 支持两种位置：cfg.vlm_quality（顶层）或 cfg.ai.vlm_quality（更符合现有 ai 块结构）
 */
function getVlmConfig(cfg) {
  const vlmCfg = (cfg && (cfg.vlm_quality || (cfg.ai && cfg.ai.vlm_quality))) || {};
  return {
    ...DEFAULTS,
    ...vlmCfg,
  };
}

/**
 * 清理 LLM 返回的 JSON（去 markdown 代码块包裹）
 */
function cleanJsonResponse(text) {
  if (!text) return null;
  let cleaned = text.trim();
  // 去 ```json ... ``` 或 ``` ... ``` 包裹
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  // 有时 LLM 会在 JSON 前后加解释文字，尝试提取第一个 { ... } 块
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  }
  try {
    return JSON.parse(cleaned);
  } catch (_) {
    return null;
  }
}

/**
 * 构建分镜上下文（从 db 查询分镜+角色+场景信息）
 * 全程 try/catch 降级，任何查询失败返回 null
 */
function buildStoryboardContext(db, storyboardId) {
  try {
    const sb = db.prepare(
      'SELECT id, episode_id, scene_id, storyboard_number, title, description, action, dialogue, result, atmosphere, image_prompt, polished_prompt, location, time, shot_type FROM storyboards WHERE id = ? AND deleted_at IS NULL'
    ).get(Number(storyboardId));
    if (!sb) return null;

    // 查角色列表
    let charList = [];
    try { charList = JSON.parse(sb.characters || '[]'); } catch (_) { charList = []; }
    const charIds = charList.map(c => Number(typeof c === 'object' && c != null ? c.id : c)).filter(Boolean);
    let charDescs = [];
    if (charIds.length) {
      const placeholders = charIds.map(() => '?').join(',');
      const chars = db.prepare(`SELECT name, description FROM characters WHERE id IN (${placeholders}) AND deleted_at IS NULL`).all(...charIds);
      charDescs = chars.map(c => `${c.name}: ${c.description || ''}`);
    }

    // 查场景
    let sceneDesc = '';
    if (sb.scene_id) {
      const scene = db.prepare('SELECT location, time, description, prompt FROM scenes WHERE id = ? AND deleted_at IS NULL').get(Number(sb.scene_id));
      if (scene) {
        sceneDesc = [scene.location, scene.time, scene.description, scene.prompt].filter(Boolean).join('，');
      }
    }

    return {
      storyboard: sb,
      characterDescription: charDescs.join('\n') || '(无角色信息)',
      settingDescription: sceneDesc || '(无场景信息)',
      plot: [sb.action, sb.dialogue, sb.result].filter(Boolean).join('\n') || sb.description || '(无剧情信息)',
      visualPrompt: sb.polished_prompt || sb.image_prompt || '',
    };
  } catch (err) {
    return null;
  }
}

/**
 * Step 1: 用 VLM 评估单帧分镜图是否合格
 *
 * @param {object} db
 * @param {object} log
 * @param {string} localAbsPath - 图片本地绝对路径
 * @param {object} context - { plot, visualPrompt, characterDescription, settingDescription }
 * @param {object} opts - { cfg, serviceType, model }
 * @returns {Promise<object|null>} - { score, hard_failures, soft_issues, is_acceptable, suggestion, suggested_prompt } 或 null（失败）
 */
async function evaluateStoryboardFrame(db, log, localAbsPath, context, opts = {}) {
  const cfg = opts.cfg || {};
  const serviceType = opts.serviceType || 'text';
  const preferredModel = opts.model;

  // 检查图片存在
  if (!fs.existsSync(localAbsPath)) {
    log.warn('[VLM质检] 图片不存在，跳过', { path: localAbsPath });
    return null;
  }

  // 填充 prompt 模板
  const template = promptI18n.getVlmFrameEvalPrompt();
  const systemPrompt = template
    .replace('{plot}', context.plot || '')
    .replace('{visual_prompt}', context.visualPrompt || '')
    .replace('{character_description}', context.characterDescription || '')
    .replace('{setting_description}', context.settingDescription || '');

  const userPrompt = '请评估这张分镜参考图。';

  try {
    const result = await aiClient.generateTextWithVision(
      db, log, serviceType, userPrompt, systemPrompt,
      { localAbsPath },
      { model: preferredModel, temperature: 0.1, max_tokens: 800 }
    );

    if (!result || !result.trim()) {
      log.warn('[VLM质检] VLM 返回空', { path: localAbsPath });
      return null;
    }

    const parsed = cleanJsonResponse(result);
    if (!parsed) {
      log.warn('[VLM质检] JSON 解析失败', { raw_preview: result.slice(0, 200) });
      return null;
    }

    log.info('[VLM质检] 评估完成', {
      path: localAbsPath,
      score: parsed.score,
      is_acceptable: parsed.is_acceptable,
      hard_failures_count: (parsed.hard_failures || []).length,
      soft_issues_count: (parsed.soft_issues || []).length,
    });

    return parsed;
  } catch (err) {
    log.warn('[VLM质检] 评估异常', { error: err.message, path: localAbsPath });
    return null;
  }
}

/**
 * 从 image_generations 记录构建图片本地绝对路径
 */
function getImageAbsPath(cfg, localPath) {
  if (!localPath) return null;
  const storagePath = path.isAbsolute(cfg.storage?.local_path)
    ? cfg.storage.local_path
    : path.join(process.cwd(), cfg.storage?.local_path || './data/storage');
  return path.join(storagePath, localPath);
}

/**
 * Step 2: 闭循环 — 生成 → VLM 评估 → 不合格则重生成，最多 maxIterations 次
 *
 * 在 imageService.processImageGeneration 的 Step 5 保存完成后调用
 * 如果质检通过：不做任何事（原图保留）
 * 如果质检不通过且有 suggested_prompt：通过 regenerateFn 回调重新生成图片，再评估
 * 所有版本（含评分）记录到 image_generations.vlm_versions JSON 字段
 *
 * @param {object} db
 * @param {object} log
 * @param {number} imageGenId - image_generations.id
 * @param {object} opts - { cfg, maxIterations, scoreThreshold, model, regenerateFn }
 *   regenerateFn: async (suggestedPrompt) => { localPath: string, absPath: string } | null
 *   如果不传 regenerateFn，则只评估+记录，不自动重生成（安全模式）
 * @returns {Promise<object>} - { evaluated, accepted, iterations, final_score, regenerated }
 */
async function regenerateUntilAcceptable(db, log, imageGenId, opts = {}) {
  const cfg = opts.cfg || {};
  const vlmCfg = { ...DEFAULTS, ...getVlmConfig(cfg), ...opts };
  const regenerateFn = opts.regenerateFn || null;
  const result = {
    evaluated: false,
    accepted: true,
    iterations: 0,
    final_score: null,
    regenerated: false,
  };

  if (!vlmCfg.enabled) return result;

  // 查 image_generation 记录
  const row = db.prepare('SELECT * FROM image_generations WHERE id = ? AND deleted_at IS NULL').get(Number(imageGenId));
  if (!row) {
    log.warn('[VLM质检] image_generation 不存在', { id: imageGenId });
    return result;
  }

  // 跳过四宫格/九宫格
  if (row.frame_type && vlmCfg.skipFrameTypes.includes(String(row.frame_type).toLowerCase())) {
    log.info('[VLM质检] 跳过多宫格类型', { id: imageGenId, frame_type: row.frame_type });
    return result;
  }

  // 查分镜上下文
  if (!row.storyboard_id) {
    log.info('[VLM质检] 无 storyboard_id，跳过', { id: imageGenId });
    return result;
  }
  const ctx = buildStoryboardContext(db, row.storyboard_id);
  if (!ctx) {
    log.warn('[VLM质检] 分镜上下文查询失败', { id: imageGenId, storyboard_id: row.storyboard_id });
    return result;
  }

  // 构建图片路径
  const absPath = getImageAbsPath(cfg, row.local_path);
  if (!absPath || !fs.existsSync(absPath)) {
    log.warn('[VLM质检] 图片文件不存在，跳过', { id: imageGenId, local_path: row.local_path });
    return result;
  }

  // 初始化版本记录
  let versions = [];
  try { versions = JSON.parse(row.vlm_versions || '[]'); } catch (_) { versions = []; }

  // 迭代评估
  let currentAbsPath = absPath;
  let currentLocalPath = row.local_path;
  let currentPrompt = row.prompt;

  for (let i = 0; i <= vlmCfg.maxIterations; i++) {
    result.iterations = i;
    result.evaluated = true;

    const evalResult = await evaluateStoryboardFrame(db, log, currentAbsPath, {
      plot: ctx.plot,
      visualPrompt: ctx.visualPrompt,
      characterDescription: ctx.characterDescription,
      settingDescription: ctx.settingDescription,
    }, { cfg, model: opts.model });

    if (!evalResult) {
      // VLM 调用失败，降级放行
      log.warn('[VLM质检] VLM 调用失败，降级放行', { id: imageGenId, iteration: i });
      return result;
    }

    // 记录版本
    versions.push({
      iteration: i,
      score: evalResult.score,
      is_acceptable: evalResult.is_acceptable,
      hard_failures: evalResult.hard_failures || [],
      soft_issues: evalResult.soft_issues || [],
      suggestion: evalResult.suggestion || '',
      local_path: currentLocalPath,
      prompt: (currentPrompt || '').slice(0, 200),
    });

    result.final_score = evalResult.score;

    if (evalResult.is_acceptable || (evalResult.score || 0) >= vlmCfg.scoreThreshold) {
      // 合格！
      result.accepted = true;
      log.info('[VLM质检] ✓ 合格', { id: imageGenId, score: evalResult.score, iteration: i });
      db.prepare('UPDATE image_generations SET vlm_versions = ?, updated_at = ? WHERE id = ?')
        .run(JSON.stringify(versions), new Date().toISOString(), Number(imageGenId));
      return result;
    }

    // 不合格
    result.accepted = false;
    log.info('[VLM质检] ✗ 不合格', { id: imageGenId, score: evalResult.score, iteration: i, issues: evalResult.issues });

    // 如果还有重试机会，且有 suggested_prompt，且有 regenerateFn
    if (i < vlmCfg.maxIterations && evalResult.suggested_prompt && evalResult.suggested_prompt.trim().length > 10) {
      if (!regenerateFn) {
        // 无重生成回调，只记录建议，不自动重生成（安全模式）
        log.info('[VLM质检] 无 regenerateFn，仅记录建议（安全模式）', { id: imageGenId, iteration: i });
        result.suggested_prompt = evalResult.suggested_prompt;
        db.prepare('UPDATE image_generations SET vlm_versions = ?, updated_at = ? WHERE id = ?')
          .run(JSON.stringify(versions), new Date().toISOString(), Number(imageGenId));
        return result;
      }

      // 用 suggested_prompt 通过回调重生成
      log.info('[VLM质检] 使用优化 prompt 重生成', { id: imageGenId, iteration: i + 1, prompt_preview: evalResult.suggested_prompt.slice(0, 100) });
      try {
        const regenResult = await regenerateFn(evalResult.suggested_prompt.trim());
        if (regenResult && regenResult.localPath && regenResult.absPath) {
          currentLocalPath = regenResult.localPath;
          currentAbsPath = regenResult.absPath;
          currentPrompt = evalResult.suggested_prompt.trim();
          result.regenerated = true;
          log.info('[VLM质检] 重生成完成，进入下一轮评估', { id: imageGenId, new_path: regenResult.localPath });
          // 继续循环，进入下一轮评估
        } else {
          log.warn('[VLM质检] 重生成回调返回空，终止循环', { id: imageGenId });
          db.prepare('UPDATE image_generations SET vlm_versions = ?, updated_at = ? WHERE id = ?')
            .run(JSON.stringify(versions), new Date().toISOString(), Number(imageGenId));
          return result;
        }
      } catch (regenErr) {
        log.warn('[VLM质检] 重生成失败，保留当前版本', { id: imageGenId, error: regenErr.message });
        db.prepare('UPDATE image_generations SET vlm_versions = ?, updated_at = ? WHERE id = ?')
          .run(JSON.stringify(versions), new Date().toISOString(), Number(imageGenId));
        return result;
      }
    } else {
      // 没有建议或已达上限
      log.info('[VLM质检] 达到上限或无优化建议，保留当前版本', { id: imageGenId, iteration: i });
      db.prepare('UPDATE image_generations SET vlm_versions = ?, updated_at = ? WHERE id = ?')
        .run(JSON.stringify(versions), new Date().toISOString(), Number(imageGenId));
      return result;
    }
  }

  return result;
}

/**
 * Step 3: 检查一集内站位连续性，输出 patches
 *
 * 从数据库读取一集所有分镜，构建 segments JSON，调 LLM 检查站位连续性
 * 返回 patches 数组（含 segment_number, shot_number, content）
 *
 * @param {object} db
 * @param {object} log
 * @param {number} episodeId
 * @param {object} opts - { cfg, model }
 * @returns {Promise<object>} - { issues, patches, applied }
 */
async function checkEpisodeContinuity(db, log, episodeId, opts = {}) {
  const cfg = opts.cfg || {};
  const serviceType = 'text';
  const preferredModel = opts.model;

  // 查集信息
  const ep = db.prepare('SELECT id, drama_id, episode_number, title FROM episodes WHERE id = ? AND deleted_at IS NULL').get(Number(episodeId));
  if (!ep) {
    log.warn('[站位检查] 剧集不存在', { episode_id: episodeId });
    return { issues: [], patches: [], applied: 0 };
  }

  // 查所有分镜
  const storyboards = db.prepare(
    'SELECT id, storyboard_number, title, description, action, dialogue, result, location, time, shot_type FROM storyboards WHERE episode_id = ? AND deleted_at IS NULL ORDER BY storyboard_number ASC'
  ).all(Number(episodeId));

  if (!storyboards.length) {
    log.info('[站位检查] 无分镜，跳过', { episode_id: episodeId });
    return { issues: [], patches: [], applied: 0 };
  }

  // 构建 segments JSON
  const segments = storyboards.map((sb, idx) => ({
    segment_number: idx + 1,
    location: sb.location || '',
    scene_context: sb.description || '',
    characters: [], // 可后续扩展
    shots: [{
      shot_number: 1,
      shot_type: sb.shot_type || '',
      content: [sb.action, sb.dialogue, sb.result].filter(Boolean).join(' ') || sb.description || '',
    }],
  }));

  // 填充 prompt
  const template = promptI18n.getStagingContinuityPrompt();
  const systemPrompt = template
    .replace('{episode_number}', String(ep.episode_number || ''))
    .replace('{episode_title}', ep.title || '')
    .replace('{retry_feedback}', '')
    .replace('{segments}', JSON.stringify(segments, null, 2));

  try {
    const result = await aiClient.generateText(db, log, serviceType, '请检查站位连续性。', systemPrompt, {
      model: preferredModel,
      temperature: 0.1,
      max_tokens: 2000,
    });

    if (!result || !result.trim()) {
      log.warn('[站位检查] LLM 返回空', { episode_id: episodeId });
      return { issues: [], patches: [], applied: 0 };
    }

    const parsed = cleanJsonResponse(result);
    if (!parsed) {
      log.warn('[站位检查] JSON 解析失败', { raw_preview: result.slice(0, 200) });
      return { issues: [], patches: [], applied: 0 };
    }

    const issues = parsed.issues || [];
    const patches = parsed.patches || [];

    // 应用 patches：把修正后的 content 写回分镜
    let applied = 0;
    for (const patch of patches) {
      const segNum = Number(patch.segment_number);
      const shotNum = Number(patch.shot_number);
      const content = String(patch.content || '').trim();
      if (!content) continue;

      // segment_number 从 1 开始，对应 storyboards 数组
      const sb = storyboards[segNum - 1];
      if (!sb) {
        log.warn('[站位检查] patch 引用未知分镜', { segment_number: segNum });
        continue;
      }

      // 更新分镜的 action 字段（或 description）
      try {
        db.prepare('UPDATE storyboards SET action = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL')
          .run(content, new Date().toISOString(), sb.id);
        applied++;
        log.info('[站位检查] 已修正分镜', { storyboard_id: sb.id, segment: segNum });
      } catch (e) {
        log.warn('[站位检查] 修正失败', { storyboard_id: sb.id, error: e.message });
      }
    }

    log.info('[站位检查] 完成', { episode_id: episodeId, issues_count: issues.length, patches_count: patches.length, applied });
    return { issues, patches, applied };
  } catch (err) {
    log.warn('[站位检查] 异常', { error: err.message, episode_id: episodeId });
    return { issues: [], patches: [], applied: 0 };
  }
}

module.exports = {
  getVlmConfig,
  evaluateStoryboardFrame,
  regenerateUntilAcceptable,
  checkEpisodeContinuity,
  buildStoryboardContext,
  cleanJsonResponse,
};
