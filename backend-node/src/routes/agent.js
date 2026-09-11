// AI Agent 工作流路由
const response = require('../response');
const { AgentScheduler } = require('../services/agentScheduler');

function routes(db, cfg, log) {
  const scheduler = new AgentScheduler(db, log, cfg, require('../services/serviceRegistry'));

  return {
    /** 启动 pipeline */
    startPipeline: async (req, res) => {
      try {
        const { type = 'full-production' } = req.body || {};
        const result = await scheduler.startPipeline(Number(req.params.id), type);
        response.created(res, result);
      } catch (err) {
        log.error('pipeline start', { error: err.message });
        if (err.message.includes('未知')) return response.badRequest(res, err.message);
        response.internalError(res, err.message);
      }
    },

    /** 查询状态 */
    getStatus: (req, res) => {
      try {
        const pipelineId = Number(req.params.pid);
        const status = scheduler.getStatus(pipelineId);
        if (!status) return response.notFound(res, 'pipeline 不存在');
        response.success(res, status);
      } catch (err) {
        log.error('pipeline status', { error: err.message });
        response.internalError(res, err.message);
      }
    },

    /** 暂停 */
    pausePipeline: (req, res) => {
      try {
        const result = scheduler.pausePipeline(Number(req.params.pid));
        response.success(res, result);
      } catch (err) {
        log.error('pipeline pause', { error: err.message });
        response.internalError(res, err.message);
      }
    },

    /** 恢复 */
    resumePipeline: (req, res) => {
      try {
        const result = scheduler.resumePipeline(Number(req.params.pid));
        response.success(res, result);
      } catch (err) {
        log.error('pipeline resume', { error: err.message });
        response.internalError(res, err.message);
      }
    },

    /** 重试步骤 */
    retryStep: async (req, res) => {
      try {
        const result = await scheduler.retryStep(Number(req.params.pid), Number(req.params.sid));
        response.success(res, result);
      } catch (err) {
        log.error('pipeline retry step', { error: err.message });
        if (err.message.includes('不存在')) return response.notFound(res, err.message);
        response.internalError(res, err.message);
      }
    },

    /** 跳过步骤 */
    skipStep: (req, res) => {
      try {
        const result = scheduler.skipStep(Number(req.params.pid), Number(req.params.sid));
        response.success(res, result);
      } catch (err) {
        log.error('pipeline skip step', { error: err.message });
        if (err.message.includes('不存在')) return response.notFound(res, err.message);
        response.internalError(res, err.message);
      }
    },

    /** 列出剧本的所有 pipeline */
    listPipelines: (req, res) => {
      try {
        const list = scheduler.listByDrama(Number(req.params.id));
        response.success(res, { pipelines: list });
      } catch (err) {
        log.error('pipeline list', { error: err.message });
        response.internalError(res, err.message);
      }
    },
  };
}

module.exports = routes;