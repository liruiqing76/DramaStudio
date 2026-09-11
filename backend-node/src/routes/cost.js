const response = require('../response');
const costTracker = require('../middleware/costTracker');

/**
 * 成本查询路由
 * - GET /cost/episode/:episode_id   单集成本
 * - GET /cost/drama/:drama_id       整剧成本
 * - GET /cost/summary               汇总（可带 ?drama_id=）
 * - GET /cost/recent                最近成本记录
 */
function costRoutes(db, log) {
  return {
    episodeCost(req, res) {
      const id = Number(req.params.episode_id);
      if (!Number.isFinite(id)) return response.badRequest(res, 'episode_id 无效');
      try {
        const data = costTracker.getEpisodeCost(db, id);
        response.success(res, data);
      } catch (err) {
        log.error('cost/episode', { error: err.message, episode_id: id });
        response.internalError(res, err.message);
      }
    },

    dramaCost(req, res) {
      const id = Number(req.params.drama_id);
      if (!Number.isFinite(id)) return response.badRequest(res, 'drama_id 无效');
      try {
        const data = costTracker.getDramaCost(db, id);
        response.success(res, data);
      } catch (err) {
        log.error('cost/drama', { error: err.message, drama_id: id });
        response.internalError(res, err.message);
      }
    },

    summary(req, res) {
      try {
        const dramaId = req.query.drama_id ? Number(req.query.drama_id) : null;
        const data = costTracker.getCostSummary(db, Number.isFinite(dramaId) ? dramaId : null);
        response.success(res, data);
      } catch (err) {
        log.error('cost/summary', { error: err.message });
        response.internalError(res, err.message);
      }
    },

    recent(req, res) {
      try {
        const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
        const data = costTracker.getRecentCosts(db, limit);
        response.success(res, data);
      } catch (err) {
        log.error('cost/recent', { error: err.message });
        response.internalError(res, err.message);
      }
    },
  };
}

module.exports = { costRoutes };