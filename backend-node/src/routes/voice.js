// 角色音色路由
const response = require('../response');
const voiceService = require('../services/voiceService');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { loadConfig } = require('../config');

function getStoragePath(cfg) {
  const raw = cfg?.storage?.local_path || './data/storage';
  return path.isAbsolute(raw) ? raw : path.join(process.cwd(), raw);
}

function routes(db, cfg, log) {
  return {
    // 配置角色音色
    createVoice: async (req, res) => {
      try {
        const characterId = Number(req.params.id);
        const data = req.body || {};
        
        // 基础验证
        if (!characterId || isNaN(characterId)) {
          return response.badRequest(res, '无效的角色ID');
        }
        
        const voice = voiceService.createVoice(db, characterId, data);
        response.created(res, voice);
      } catch (err) {
        log.error('voice createVoice', { error: err.message });
        if (err.message === '角色不存在') {
          return response.notFound(res, err.message);
        }
        response.badRequest(res, err.message);
      }
    },
    
    // 列出角色所有音色
    listVoices: async (req, res) => {
      try {
        const characterId = Number(req.params.id);
        
        if (!characterId || isNaN(characterId)) {
          return response.badRequest(res, '无效的角色ID');
        }
        
        const voices = voiceService.listVoicesByCharacter(db, characterId);
        response.success(res, voices);
      } catch (err) {
        log.error('voice listVoices', { error: err.message });
        if (err.message === '角色不存在') {
          return response.notFound(res, err.message);
        }
        response.internalError(res, err.message);
      }
    },
    
    // 获取单个音色
    getVoice: (req, res) => {
      try {
        const voiceId = Number(req.params.voiceId);
        
        if (!voiceId || isNaN(voiceId)) {
          return response.badRequest(res, '无效的音色ID');
        }
        
        const voice = voiceService.getVoice(db, voiceId);
        response.success(res, voice);
      } catch (err) {
        log.error('voice getVoice', { error: err.message });
        if (err.message === '音色不存在') {
          return response.notFound(res, err.message);
        }
        response.badRequest(res, err.message);
      }
    },
    
    // 更新音色
    updateVoice: async (req, res) => {
      try {
        const voiceId = Number(req.params.voiceId);
        const data = req.body || {};
        
        if (!voiceId || isNaN(voiceId)) {
          return response.badRequest(res, '无效的音色ID');
        }
        
        const voice = voiceService.updateVoice(db, voiceId, data);
        response.success(res, voice);
      } catch (err) {
        log.error('voice updateVoice', { error: err.message });
        if (err.message === '音色不存在') {
          return response.notFound(res, err.message);
        }
        response.badRequest(res, err.message);
      }
    },
    
    // 删除音色
    deleteVoice: async (req, res) => {
      try {
        const voiceId = Number(req.params.voiceId);
        
        if (!voiceId || isNaN(voiceId)) {
          return response.badRequest(res, '无效的音色ID');
        }
        
        const success = voiceService.deleteVoice(db, voiceId);
        if (!success) {
          return response.notFound(res, '音色不存在');
        }
        
        response.success(res, { message: '音色删除成功' });
      } catch (err) {
        log.error('voice deleteVoice', { error: err.message });
        response.internalError(res, err.message);
      }
    },
    
    // 音色克隆 (上传音频 → MiniMax 克隆)
    cloneVoice: async (req, res) => {
      try {
        const characterId = Number(req.params.id);
        if (!characterId || isNaN(characterId)) {
          return response.badRequest(res, '无效的角色ID');
        }
        
        // 检查角色是否存在
        const char = db.prepare('SELECT id FROM characters WHERE id = ?').get(characterId);
        if (!char) {
          return response.notFound(res, '角色不存在');
        }
        
        // TODO: 实现音色克隆逻辑
        // 这里需要：
        // 1. 接收上传的音频文件
        // 2. 调用 MiniMax 音色克隆 API
        // 3. 保存克隆的 voice_id 到角色音色配置
        // 由于音色克隆需要特定的 API 和处理流程，
        // 这里我们返回一个提示 indicating this feature needs implementation
        
        // 暂时返回需要实现的提示
        response.badRequest(res, '音色克隆功能尚未实现，请使用其他方式配置音色');
      } catch (err) {
        log.error('voice cloneVoice', { error: err.message });
        response.internalError(res, err.message);
      }
    },
    
    // 生成 5 秒试用音频
    previewVoice: async (req, res) => {
      try {
        const voiceId = Number(req.params.id);
        
        if (!voiceId || isNaN(voiceId)) {
          return response.badRequest(res, '无效的音色ID');
        }
        
        const result = await voiceService.previewVoice(db, voiceId);
        response.success(res, result);
      } catch (err) {
        log.error('voice previewVoice', { error: err.message });
        if (err.message === '音色不存在') {
          return response.notFound(res, err.message);
        }
        if (err.message.includes('未配置 TTS 模型')) {
          return response.badRequest(res, err.message);
        }
        response.internalError(res, err.message);
      }
    }
  };
}

module.exports = routes;