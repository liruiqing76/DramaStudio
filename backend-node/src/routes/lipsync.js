// 唇形同步路由
const response = require('../response');
const lipsyncService = require('../services/lipsyncService');

function routes(db, cfg, log) {
  return {
    // 请求唇形同步
    createLipsync: async (req, res) => {
      try {
        const videoGenerationId = Number(req.params.id);
        const { audio_path, drama_id } = req.body || {};
        
        // 参数验证
        if (!videoGenerationId || isNaN(videoGenerationId)) {
          return response.badRequest(res, '无效的视频生成ID');
        }
        
        if (!audio_path || typeof audio_path !== 'string') {
          return response.badRequest(res, '音频路径是必需的');
        }
        
        // 检查 ComfyUI 是否可用
        const loadConfig = require('../config').loadConfig;
        const cfg = loadConfig();
        const comfyuiBaseUrl = cfg.comfyui?.base_url || 'http://127.0.0.1:8188';
        
        const isAvailable = await lipsyncService.checkComfyUIAvailable(comfyuiBaseUrl);
        if (!isAvailable) {
          return response.error(res, 503, 'SERVICE_UNAVAILABLE', 'ComfyUI 服务不可用');
        }
        
        const lipsync = lipsyncService.createLipsync(
          db,
          videoGenerationId,
          audio_path,
          drama_id ? Number(drama_id) : null
        );
        
        // 异步处理唇形同步（不等待完成）
        setImmediate(() => {
          lipsyncService.processLipsync(db, log, lipsync.id).catch(err => {
            if (err.message === 'ComfyUI 服务不可用') {
              log.warn('lipsync processing skipped - ComfyUI unavailable', { 
                lipsyncId: lipsync.id 
              });
            } else {
              log.error('lipsync processing failed', { 
                lipsyncId: lipsync.id, 
                error: err.message 
              });
            }
          });
        });
        
        response.created(res, lipsync);
      } catch (err) {
        log.error('lipsync createLipsync', { error: err.message });
        if (err.message === '视频生成不存在' || 
            err.message === '剧本不存在') {
          return response.notFound(res, err.message);
        }
        response.badRequest(res, err.message);
      }
    },
    
    // 列出视频的所有唇形同步任务
    listLipsyncs: async (req, res) => {
      try {
        const videoGenerationId = Number(req.params.id);
        
        if (!videoGenerationId || isNaN(videoGenerationId)) {
          return response.badRequest(res, '无效的视频生成ID');
        }
        
        const lipsyncs = lipsyncService.listLipsyncsByVideo(db, videoGenerationId);
        response.success(res, lipsyncs);
      } catch (err) {
        log.error('lipsync listLipsyncs', { error: err.message });
        if (err.message === '视频生成不存在') {
          return response.notFound(res, err.message);
        }
        response.internalError(res, err.message);
      }
    },
    
    // 查询唇形同步状态/结果
    getLipsync: async (req, res) => {
      try {
        const lipsyncId = Number(req.params.lid);
        
        if (!lipsyncId || isNaN(lipsyncId)) {
          return response.badRequest(res, '无效的唇形同步ID');
        }
        
        const lipsync = lipsyncService.getLipsync(db, lipsyncId);
        response.success(res, lipsync);
      } catch (err) {
        log.error('lipsync getLipsync', { error: err.message });
        if (err.message === '唇形同步任务不存在') {
          return response.notFound(res, err.message);
        }
        response.badRequest(res, err.message);
      }
    }
  };
}

module.exports = routes;