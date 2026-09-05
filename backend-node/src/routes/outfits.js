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

  return router;
}

module.exports = routes;
