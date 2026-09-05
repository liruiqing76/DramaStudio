// 唇形同步服务
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const https = require('https');
const http = require('http');

/**
 * 创建唇形同步任务
 * @param {object} db - database instance
 * @param {number} videoGenerationId - 视频生成ID
 * @param {string} audioPath - 音频文件路径（相对于storage根目录）
 * @param {number} dramaId - 剧本ID
 * @returns {object} 创建的唇形同步任务记录
 */
function createLipsync(db, videoGenerationId, audioPath, dramaId) {
  // 验证视频生成是否存在
  const videoGen = db.prepare('SELECT id FROM video_generations WHERE id = ?').get(videoGenerationId);
  if (!videoGen) {
    throw new Error('视频生成不存在');
  }

  // 验证剧本是否存在（可选，但有助于数据一致性）
  if (dramaId) {
    const drama = db.prepare('SELECT id FROM dramas WHERE id = ?').get(dramaId);
    if (!drama) {
      throw new Error('剧本不存在');
    }
  }

  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO video_lipsyncs 
    (video_generation_id, drama_id, audio_path, status, output_video_path, error_msg, created_at, completed_at)
    VALUES (?, ?, ?, 'pending', ?, ?, ?, ?)
  `).run(
    videoGenerationId,
    dramaId || null,
    audioPath,
    null, // output_video_path
    null, // error_msg
    now,
    null // completed_at
  );

  const lipsyncId = db.prepare('SELECT last_insert_rowid() as id').get().id;
  return getLipsync(db, lipsyncId);
}

/**
 * 查询唇形同步状态
 * @param {object} db - database instance
 * @param {number} lipsyncId - 唇形同步ID
 * @returns {object} 唇形同步记录
 */
function getLipsync(db, lipsyncId) {
  const lipsync = db.prepare(`
    SELECT * FROM video_lipsyncs 
    WHERE id = ?
  `).get(lipsyncId);
  
  if (!lipsync) {
    throw new Error('唇形同步任务不存在');
  }
  
  return lipsync;
}

/**
 * 列出视频的所有唇形同步任务
 * @param {object} db - database instance
 * @param {number} videoGenerationId - 视频生成ID
 * @returns {array} 唇形同步任务列表
 */
function listLipsyncsByVideo(db, videoGenerationId) {
  // 验证视频生成是否存在
  const videoGen = db.prepare('SELECT id FROM video_generations WHERE id = ?').get(videoGenerationId);
  if (!videoGen) {
    throw new Error('视频生成不存在');
  }

  return db.prepare(`
    SELECT * FROM video_lipsyncs 
    WHERE video_generation_id = ?
    ORDER BY created_at DESC
  `).all(videoGenerationId);
}

/**
 * 检查 ComfyUI 是否可用
 * @param {string} comfyuiBaseUrl - ComfyUI 基础 URL
 * @returns {Promise<boolean>} 是否可用
 */
function checkComfyUIAvailable(comfyuiBaseUrl) {
  const url = comfyuiBaseUrl.endsWith('/') ? comfyuiBaseUrl.slice(0, -1) : comfyuiBaseUrl;
  const systemStatsUrl = `${url}/system_stats`;
  
  return new Promise((resolve) => {
    const parsed = new URL(systemStatsUrl);
    const mod = parsed.protocol === 'https:' ? https : http;
    
    const req = mod.get(parsed, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        // 如果能够连接并返回任何状态码（即使不是200），则认为服务可用
        // 这里我们特别检查是否是连接成功（不包括连接拒绝或超时）
        resolve(res.statusCode !== undefined && res.statusCode < 500);
      });
    });
    
    req.on('error', () => {
      resolve(false);
    });
    
    req.setTimeout(5000, () => {
      req.destroy();
      resolve(false);
    });
    
    req.end();
  });
}

/**
 * 处理唇形同步任务（调用 ComfyUI Wav2Lip workflow）
 * @param {object} db - database instance
 * @param {object} log - 日志对象
 * @param {number} lipsyncId - 唇形同步ID
 * @returns {Promise<void>}
 */
async function processLipsync(db, log, lipsyncId) {
  // 获取唇形同步任务
  const lipsync = getLipsync(db, lipsyncId);
  
  if (lipsync.status !== 'pending') {
    // 如果不是待处理状态，直接返回
    return;
  }
  
  // 更新状态为处理中
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE video_lipsyncs 
    SET status = 'processing', updated_at = ?
    WHERE id = ?
  `).run(now, lipsyncId);
  
  try {
    // 加载配置以获取 ComfyUI 基础 URL
    const loadConfig = require('../config').loadConfig;
    const cfg = loadConfig();
    
    // 从配置中获取 ComfyUI 基础 URL，默认为 http://127.0.0.1:8188
    const comfyuiBaseUrl = cfg.comfyui?.base_url || 'http://127.0.0.1:8188';
    
    // 检查 ComfyUI 是否可用
    const isAvailable = await checkComfyUIAvailable(comfyuiBaseUrl);
    if (!isAvailable) {
      throw new Error('ComfyUI 服务不可用');
    }
    
    // TODO: 实际调用 ComfyUI Wav2Lip workflow
    // 这里需要：
    // 1. 准备工作流JSON（包含音频路径和视频路径的占位符）
    // 2. 通过HTTP POST提交工作流到ComfyUI
    // 3. 轮询执行结果
    // 4. 获取生成的视频路径
    // 由于这是一个复杂的过程，并且需要具体的工作流文件，
    // 这里我们实现一个桩函数，在实际使用时需要替换为真实的ComfyUI调用
    
    // 为了演示，我们模拟成功完成
    // 在实际项目中，这里应该是真实的ComfyUI API调用
    
    // 模拟处理时间（实际应用中删除）
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 生成输出路径（相对于storage根目录）
    const storagePath = (() => {
      const raw = cfg.storage?.local_path || './data/storage';
      return path.isAbsolute(raw) ? raw : path.join(process.cwd(), raw);
    })();
    const outputDir = path.join(storagePath, 'lipsync_output');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    const outputFilename = `lipsync_${lipsyncId}_${randomUUID().slice(0, 8)}.mp4`;
    const outputPath = path.join('lipsync_output', outputFilename); // 相对于storage根目录的路径
    const absoluteOutputPath = path.join(outputDir, outputFilename);
    
    // 这里应该实际生成视频文件，但目前我们创建一个空文件来演示
    fs.writeFileSync(absoluteOutputPath, ''); // 实际应用中替换为真实视频数据
    
    // 更新任务状态为完成
    const completedAt = new Date().toISOString();
    db.prepare(`
      UPDATE video_lipsyncs 
      SET status = 'completed', output_video_path = ?, completed_at = ?
      WHERE id = ?
    `).run(outputPath, completedAt, lipsyncId);
    
    log.info('[Lipsync处理完成]', { lipsyncId, outputPath });
  } catch (error) {
    // 更新任务状态为失败
    const now = new Date().toISOString();
    const errorMsg = error.message || '未知错误';
    db.prepare(`
      UPDATE video_lipsyncs 
      SET status = 'failed', error_msg = ?, updated_at = ?
      WHERE id = ?
    `).run(errorMsg, now, lipsyncId);
    
    log.error('[Lipsync处理失败]', { lipsyncId, error: error.message });
    throw error;
  }
}

module.exports = {
  createLipsync,
  getLipsync,
  listLipsyncsByVideo,
  processLipsync,
  checkComfyUIAvailable
};