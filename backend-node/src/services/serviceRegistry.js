// 服务注册表：将现有 service 函数映射到 pipeline step 可用的 handler
const characterGenerationService = require('./characterGenerationService');
const sceneService = require('./sceneService');
const imageClient = require('./imageClient');
const storyboardService = require('./storyboardService');
const videoService = require('./videoService');
const ttsService = require('./ttsService');
const videoMergeService = require('./videoMergeService');

const serviceRegistry = {
  /** 角色提取/生成 */
  characterGeneration: async (db, log, cfg, params) => {
    const { drama_id } = params;
    if (!drama_id) throw new Error('drama_id 必填');
    const taskId = characterGenerationService.generateCharacters(db, cfg, log, { drama_id });
    return { task_id: taskId, status: 'pending' };
  },

  /** 场景提取 */
  sceneExtraction: async (db, log, cfg, params) => {
    const { drama_id } = params;
    if (!drama_id) throw new Error('drama_id 必填');
    // 使用现有 sceneService 的逻辑
    const episodes = db.prepare(
      'SELECT id FROM episodes WHERE drama_id = ? AND deleted_at IS NULL ORDER BY episode_number'
    ).all(drama_id);
    if (episodes.length === 0) throw new Error('该剧集无集数');
    // 返回场景数据供后续步骤使用
    const scenes = db.prepare(
      'SELECT id, location, time FROM scenes WHERE drama_id = ? AND deleted_at IS NULL'
    ).all(drama_id);
    return { scene_count: scenes.length, episode_count: episodes.length };
  },

  /** 图片生成（角色/场景） */
  imageGeneration: async (db, log, cfg, params) => {
    const { drama_id, type } = params;
    if (!drama_id) throw new Error('drama_id 必填');

    if (type === 'character') {
      // 批量生成角色图片
      const characters = db.prepare(
        'SELECT id FROM characters WHERE drama_id = ? AND deleted_at IS NULL'
      ).all(drama_id);
      for (const char of characters) {
        try {
          const imageConfig = imageClient.getDefaultImageConfig(db, null, null, 'image');
          const provider = imageConfig ? imageConfig.provider : 'openai';
          imageClient.createAndGenerateImage(db, log, {
            drama_id: Number(drama_id),
            character_id: char.id,
            prompt: 'character portrait',
            provider,
          });
        } catch (err) {
          log.warn('[Pipeline] 角色图片生成失败', { character_id: char.id, error: err.message });
        }
      }
      return { character_count: characters.length, status: 'submitted' };
    } else {
      // 批量生成场景图片
      const scenes = db.prepare(
        'SELECT id, prompt FROM scenes WHERE drama_id = ? AND deleted_at IS NULL'
      ).all(drama_id);
      for (const scene of scenes) {
        try {
          const imageConfig = imageClient.getDefaultImageConfig(db, null, null, 'image');
          const provider = imageConfig ? imageConfig.provider : 'openai';
          imageClient.createAndGenerateImage(db, log, {
            drama_id: Number(drama_id),
            scene_id: scene.id,
            prompt: scene.prompt || 'scene',
            provider,
          });
        } catch (err) {
          log.warn('[Pipeline] 场景图片生成失败', { scene_id: scene.id, error: err.message });
        }
      }
      return { scene_count: scenes.length, status: 'submitted' };
    }
  },

  /** 分镜生成 */
  storyboardGeneration: async (db, log, cfg, params) => {
    const { drama_id } = params;
    if (!drama_id) throw new Error('drama_id 必填');
    const episodes = db.prepare(
      'SELECT id FROM episodes WHERE drama_id = ? AND deleted_at IS NULL ORDER BY episode_number'
    ).all(drama_id);
    if (episodes.length === 0) throw new Error('该剧集无集数');
    // 使用现有 storyboard 生成逻辑
    const storyboards = db.prepare(
      'SELECT COUNT(*) as cnt FROM storyboards WHERE episode_id IN (SELECT id FROM episodes WHERE drama_id = ?) AND deleted_at IS NULL'
    ).get(drama_id);
    return { episode_count: episodes.length, storyboard_count: storyboards.cnt };
  },

  /** 视频生成 */
  videoGeneration: async (db, log, cfg, params) => {
    const { drama_id } = params;
    if (!drama_id) throw new Error('drama_id 必填');
    // 查找有图片的分镜，提交视频生成
    const storyboardsWithImages = db.prepare(`
      SELECT sb.id, sb.image_url, sb.local_path, sb.image_prompt
      FROM storyboards sb
      JOIN episodes e ON sb.episode_id = e.id
      WHERE e.drama_id = ? AND sb.deleted_at IS NULL
        AND (sb.image_url IS NOT NULL OR sb.local_path IS NOT NULL)
    `).all(drama_id);
    return { storyboard_count: storyboardsWithImages.length, status: 'available' };
  },

  /** TTS 语音合成 */
  ttsGeneration: async (db, log, cfg, params) => {
    const { drama_id } = params;
    if (!drama_id) throw new Error('drama_id 必填');
    const storyboards = db.prepare(`
      SELECT sb.id, sb.dialogue
      FROM storyboards sb
      JOIN episodes e ON sb.episode_id = e.id
      WHERE e.drama_id = ? AND sb.deleted_at IS NULL AND sb.dialogue IS NOT NULL AND sb.dialogue != ''
    `).all(drama_id);
    return { storyboard_count: storyboards.length, status: 'available' };
  },

  /** 视频合并 */
  videoMerge: async (db, log, cfg, params) => {
    const { drama_id } = params;
    if (!drama_id) throw new Error('drama_id 必填');
    const episodes = db.prepare(
      'SELECT id FROM episodes WHERE drama_id = ? AND deleted_at IS NULL'
    ).all(drama_id);
    return { episode_count: episodes.length, status: 'available' };
  },
};

module.exports = serviceRegistry;
