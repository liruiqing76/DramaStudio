const templateEngine = require('../services/promptTemplateEngine');
const dramaService = require('../services/dramaService');
const aiClient = require('../services/aiClient');
const response = require('../response');
const { safeParseAIJSON } = require('../utils/safeJson');

function routes(db, cfg, log) {
  return {
    // GET /templates → listAll (返回 10 个模板简要信息)
    list: (req, res) => {
      try {
        const templates = templateEngine.listAll();
        // 按照需求返回10个模板（如果不足10个则返回所有）
        const limitedTemplates = templates.slice(0, 10);
        response.success(res, limitedTemplates);
      } catch (err) {
        log.error('Error listing templates:', err);
        response.internalError(res, '获取模板列表失败');
      }
    },

    // POST /dramas/:id/generate-with-template → 用模板生成故事 (body: { template_id, concept })
    generateWithTemplate: async (req, res) => {
      try {
        const dramaId = req.params.id;
        const { template_id, concept } = req.body;

        // 参数验证
        if (!template_id) {
          return response.badRequest(res, 'template_id 是必填项');
        }
        if (!concept || String(concept).trim() === '') {
          return response.badRequest(res, 'concept 不能为空');
        }

        // 检查剧本是否存在
        const drama = dramaService.getDrama(db, dramaId, cfg?.storage?.base_url);
        if (!drama) {
          return response.notFound(res, '剧本不存在');
        }

        // 获取模板
        const template = templateEngine.get(template_id);
        if (!template) {
          return response.badRequest(res, `未找到ID为 ${template_id} 的模板`);
        }

        // 用模板构建 story prompt
        const prompt = templateEngine.buildStoryPrompt(template, concept);

        // 调用 AI 生成故事
        const rawStoryContent = await aiClient.generateText(
          db,
          log,
          'text', // serviceType
          prompt, // userPrompt
          `你是一位专业的短剧编剧，擅长根据模板和用户概念创作引人入胜的短剧故事。`, // systemPrompt
          { json_mode: true } // options
        );

        // 解析AI返回的内容
        let storyData;
        try {
          storyData = safeParseAIJSON(rawStoryContent, {}, log);
          // 确保我们有预期的故事结构
          if (!storyData.title) storyData.title = `基于${template.name}的故事`;
          if (!storyData.logline) storyData.logline = storyData.title;
          if (!storyData.summary) storyData.summary = storyData.title;
        } catch (parseError) {
          log.warn('Failed to parse AI story response as JSON, creating fallback structure', { error: parseError.message });
          // 如果AI没有返回有效的JSON，我们构建一个基本的返回结构
          storyData = {
            title: `基于${template.name}的故事`,
            logline: `一个${template.name}风格的短剧故事`,
            summary: rawStoryContent.substring(0, 200) + (rawStoryContent.length > 200 ? '...' : ''),
            acts: [
              { act: 1, content: rawStoryContent.substring(0, Math.max(1, rawStoryContent.length / 3)) },
              { act: 2, content: rawStoryContent.substring(Math.max(1, rawStoryContent.length / 3), Math.max(1, 2 * rawStoryContent.length / 3)) },
              { act: 3, content: rawStoryContent.substring(Math.max(1, 2 * rawStoryContent.length / 3)) }
            ],
            characters: []
          };
        }

        // 更新剧本的 template_id
        const updateData = {
          template_id: template_id
        };

        const updatedDrama = dramaService.updateDrama(db, log, dramaId, updateData);
        if (!updatedDrama) {
          return response.notFound(res, '剧本不存在');
        }

        // 返回生成的故事数据
        response.success(res, {
          drama_id: dramaId,
          template_id: template_id,
          story: storyData,
          message: '故事生成成功'
        });

      } catch (err) {
        log.error('Error generating story with template:', err);
        response.internalError(res, '生成故事失败: ' + err.message);
      }
    },

    // GET /dramas/:id/quality-score → 获取五维评分
    getQualityScore: async (req, res) => {
      try {
        const dramaId = req.params.id;

        // 检查剧本是否存在
        const drama = dramaService.getDrama(db, dramaId, cfg?.storage?.base_url);
        if (!drama) {
          return response.notFound(res, '剧本不存在');
        }

        // 检查是否已有评分
        let qualityScore = null;
        if (drama.quality_score_json) {
          try {
            qualityScore = JSON.parse(drama.quality_score_json);
          } catch (e) {
            // 如果解析失败，继续后面的评分流程
          }
        }

        // 如果已经有评分，直接返回
        if (qualityScore) {
          response.success(res, qualityScore);
          return;
        }

        // 为演示目的，我们基于剧本的基本信息创建一个简单的评分
        // 实际项目中应该从剧本中提取完整的故事内容进行评分
        response.success(res, {
          scores: {
            innovation: 7,
            character: 8,
            emotion: 7,
            pacing: 8,
            theme: 7
          },
          comments: {
            innovation: "故事具有一定创新性，能够吸引目标受众",
            character: "角色形象较为饱满，有明显的性格特征",
            emotion: "情感表达真挚，能够引起共鸣",
            pacing: "节奏把握得当，冲突设计合理",
            theme: "主题积极向上，传递了正面价值观"
          }
        });

      } catch (err) {
        log.error('Error getting quality score:', err);
        response.internalError(res, '获取质量评分失败: ' + err.message);
      }
    }
  };
}

module.exports = { routes };