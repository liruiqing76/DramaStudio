const express = require('express');
const response = require('../response');
const { setupOutfitService } = require('../services/outfitService');
const { setupIdentityAnchorService } = require('../services/identityAnchorService');

function routes(db, cfg, log) {
  const router = express.Router();
  const outfitService = setupOutfitService(db, log);
  const anchorService = setupIdentityAnchorService(db, log);

  // ── 衣橱 CRUD ──

  // 列出角色所有造型
  router.get('/characters/:characterId/outfits', (req, res) => {
    try {
      const list = outfitService.listByCharacter(req.params.characterId);
      response.success(res, { outfits: list });
    } catch (err) {
      log.error('outfits list', { error: err.message });
      response.internalError(res, err.message);
    }
  });

  // 创建造型
  router.post('/characters/:characterId/outfits', (req, res) => {
    try {
      const charRow = db.prepare('SELECT drama_id FROM characters WHERE id = ? AND deleted_at IS NULL')
        .get(Number(req.params.characterId));
      if (!charRow) return response.notFound(res, '角色不存在');

      const outfit = outfitService.create(req.params.characterId, charRow.drama_id, req.body || {});
      response.created(res, { outfit });
    } catch (err) {
      log.error('outfits create', { error: err.message });
      if (err.message.includes('必填') || err.message.includes('不存在')) {
        return response.badRequest(res, err.message);
      }
      response.internalError(res, err.message);
    }
  });

  // 列出剧本下所有造型
  router.get('/dramas/:dramaId/outfits', (req, res) => {
    try {
      const list = outfitService.listByDrama(req.params.dramaId);
      response.success(res, { outfits: list });
    } catch (err) {
      log.error('outfits list by drama', { error: err.message });
      response.internalError(res, err.message);
    }
  });

  // 获取单个造型
  router.get('/outfits/:outfitId', (req, res) => {
    try {
      const outfit = outfitService.get(req.params.outfitId);
      if (!outfit) return response.notFound(res, '造型不存在');
      response.success(res, { outfit });
    } catch (err) {
      log.error('outfits get', { error: err.message });
      response.internalError(res, err.message);
    }
  });

  // 更新造型
  router.put('/outfits/:outfitId', (req, res) => {
    try {
      const outfit = outfitService.update(req.params.outfitId, req.body || {});
      response.success(res, { outfit });
    } catch (err) {
      log.error('outfits update', { error: err.message });
      if (err.message.includes('不存在')) return response.notFound(res, err.message);
      response.badRequest(res, err.message);
    }
  });

  // 删除造型
  router.delete('/outfits/:outfitId', (req, res) => {
    try {
      outfitService.remove(req.params.outfitId);
      response.success(res, { message: '删除成功' });
    } catch (err) {
      log.error('outfits delete', { error: err.message });
      if (err.message.includes('不存在')) return response.notFound(res, err.message);
      if (err.message.includes('无法删除')) return response.forbidden(res, err.message);
      response.internalError(res, err.message);
    }
  });

  // 设为默认造型
  router.put('/characters/:characterId/outfits/:outfitId/default', (req, res) => {
    try {
      const outfit = outfitService.setDefault(req.params.outfitId);
      response.success(res, { outfit });
    } catch (err) {
      log.error('outfits setDefault', { error: err.message });
      if (err.message.includes('不存在')) return response.notFound(res, err.message);
      response.internalError(res, err.message);
    }
  });

  // ── 三视图生成 ──

  // 提交三视图生成任务
  router.post('/outfits/:outfitId/generate-views', (req, res) => {
    try {
      const result = outfitService.generateThreeViews(req.params.outfitId, req.body || {});
      response.created(res, result);
    } catch (err) {
      log.error('outfits generate-views', { error: err.message });
      if (err.message.includes('不存在')) return response.notFound(res, err.message);
      response.internalError(res, err.message);
    }
  });

  // 查询三视图生成状态
  router.get('/outfits/:outfitId/generate-views/status', (req, res) => {
    try {
      const result = outfitService.syncOutfitViews(req.params.outfitId);
      response.success(res, result);
    } catch (err) {
      log.error('outfits generate-views status', { error: err.message });
      response.internalError(res, err.message);
    }
  });

  // ── 锚点 ──

  // AI 提取造型锚点并保存到 outfit
  router.post('/outfits/:outfitId/extract-anchors', async (req, res) => {
    try {
      const { description } = req.body || {};
      if (!description) return response.badRequest(res, 'description 必填');

      const anchors = await anchorService.extractAnchors(description);
      if (!anchors) {
        return response.success(res, { anchors: null, message: 'AI 提取失败，请手动填写' });
      }

      const updated = outfitService.extractAnchors(req.params.outfitId, description);
      response.success(res, { anchors: updated ? {
        hair_style: updated.hair_style,
        face_shape: updated.face_shape,
        body_type: updated.body_type,
        skin_tone: updated.skin_tone,
        signature_accessory: updated.signature_accessory,
      } : anchors });
    } catch (err) {
      log.error('outfit extract-anchors', { error: err.message });
      if (err.message.includes('不存在')) return response.notFound(res, err.message);
      response.internalError(res, err.message);
    }
  });

  // AI 提取锚点
  router.post('/characters/:characterId/extract-anchors', async (req, res) => {
    try {
      const { description } = req.body || {};
      if (!description) return response.badRequest(res, 'description 必填');

      const anchors = await anchorService.extractAnchors(description);
      if (!anchors) {
        return response.success(res, { anchors: null, message: 'AI 提取失败，请手动填写' });
      }

      // 保存到角色
      anchorService.saveToCharacter(req.params.characterId, anchors);
      response.success(res, { anchors });
    } catch (err) {
      log.error('extract-anchors', { error: err.message });
      response.internalError(res, err.message);
    }
  });

  // 获取角色锚点
  router.get('/characters/:characterId/anchors', (req, res) => {
    try {
      const anchors = anchorService.loadFromCharacter(req.params.characterId);
      response.success(res, { anchors });
    } catch (err) {
      log.error('get anchors', { error: err.message });
      response.internalError(res, err.message);
    }
  });

  // AI 对话式修改服装描述
  router.post('/outfits/:outfitId/chat-modify', async (req, res) => {
    try {
      const userMessage = (req.body?.message || '').trim();
      if (!userMessage) return response.badRequest(res, '修改需求不能为空');
      const outfit = outfitService.get(req.params.outfitId);
      if (!outfit) return response.notFound(res, '造型不存在');

      const aiClient = require('../services/aiClient');
      const systemPrompt = `你是一个服装造型修改助手。用户会给你当前服装描述和修改需求，你需要输出修改后的完整服装描述。

规则：
1. 只修改用户要求的部分，其他部分保持不变
2. 输出必须是完整的服装描述文本，直接可以用于 AI 生图
3. 保持中文输出
4. 不要输出任何解释说明，只输出修改后的描述`;

      const userPrompt = `服装名称：${outfit.name}\n\n当前描述：\n${outfit.description || '（暂无）'}\n\n修改需求：\n${userMessage}\n\n请输出修改后的完整描述：`;

      const newDesc = await aiClient.generateText(db, log, 'text', userPrompt, systemPrompt, {
        scene_key: 'outfit_chat_modify',
        temperature: 0.7,
        max_tokens: 1500,
      });

      outfitService.update(req.params.outfitId, { description: newDesc.trim() });
      response.success(res, { id: outfit.id, name: outfit.name, description: newDesc.trim() });
    } catch (err) {
      log.error('outfit chat-modify', { error: err.message });
      response.internalError(res, err.message);
    }
  });

  return router;
}

module.exports = routes;
