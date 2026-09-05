const response = require('../response');
const videoMergeService = require('../services/videoMergeService');

function routes(db, log) {
  return {
    list: (req, res) => {
      try {
        const query = { ...req.query };
        const items = videoMergeService.list(db, query);
        response.success(res, items);
      } catch (err) {
        log.error('video-merges list', { error: err.message });
        response.internalError(res, err.message);
      }
    },
    create: (req, res) => {
      try {
        const body = req.body || {};
        const rec = videoMergeService.create(db, log, body);
        response.success(res, { merge_id: rec.merge_id, task_id: rec.task_id, ...rec });
      } catch (err) {
        log.error('video-merges create', { error: err.message });
        response.internalError(res, err.message);
      }
    },
    get: (req, res) => {
      try {
        const item = videoMergeService.getById(db, req.params.merge_id);
        if (!item) return response.notFound(res, '记录不存在');
        response.success(res, item);
      } catch (err) {
        log.error('video-merges get', { error: err.message });
        response.internalError(res, err.message);
      }
    },
    delete: (req, res) => {
      try {
        const ok = videoMergeService.deleteById(db, log, req.params.merge_id);
        if (!ok) return response.notFound(res, '记录不存在');
        response.success(res, { message: '删除成功' });
      } catch (err) {
        log.error('video-merges delete', { error: err.message });
        response.internalError(res, err.message);
      }
    },
    // ── Week 2: 时间线编辑器 ──
    preview: async (req, res) => {
      try {
        const dramaId = req.params.id;
        const episodeId = req.query.episode_id;
        const items = await videoMergeService.previewMerge(db, log, dramaId, episodeId);
        response.success(res, { items });
      } catch (err) {
        log.error('video-merges preview', { error: err.message });
        response.internalError(res, err.message);
      }
    },
    executeTimeline: (req, res) => {
      try {
        const body = req.body || {};
        if (!body.segments || !Array.isArray(body.segments) || body.segments.length === 0) {
          // 无 segments 走老逻辑
          const rec = videoMergeService.create(db, log, body);
          return response.success(res, { merge_id: rec.merge_id, task_id: rec.task_id, ...rec });
        }
        const rec = videoMergeService.createWithTimeline(db, log, { ...body, drama_id: req.params.id });
        response.created(res, { merge_id: rec.merge_id, task_id: rec.task_id, ...rec });
      } catch (err) {
        log.error('video-merges execute-timeline', { error: err.message });
        response.internalError(res, err.message);
      }
    },
  };
}

module.exports = routes;
