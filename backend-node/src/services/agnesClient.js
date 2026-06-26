/**
 * Agnes AI Client for LocalMiniDrama
 * 图片 + 视频生成 API 适配器（新加坡 Sapiens AI）
 * 
 * 实测通过：
 * - 图片: POST /v1/images/generations (model=agnes-image-2.1-flash)
 * - 视频: POST /v1/video/generations (model=agnes-video-v2.0) 异步轮询
 * - 图生图: 同一接口 + image 参数 (base64) 支持人物一致性
 * 
 * 注意事项：
 * - rate limit 很严，连续请求会临时 401，间隔 10 秒 + 恢复
 * - 视频生成约 15 分钟完成
 * - 目前免费额度可用
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const base64 = require('base64-js');

const API_BASE = 'https://apihub.agnes-ai.com/v1';

/**
 * 通用 HTTP POST（带超时）
 * @param {string} url 
 * @param {object} headers 
 * @param {object} body 
 * @param {number} timeoutMs 
 */
function postJSON(url, headers, body, timeoutMs = 120000) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const mod = parsed.protocol === 'https:' ? https : http;
    const bodyStr = JSON.stringify(body);
    const reqHeaders = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(bodyStr),
      ...headers,
    };

    const req = mod.request({
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: 'POST',
      headers: reqHeaders,
    }, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf-8');
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return reject(new Error(`HTTP ${res.statusCode}: ${raw.slice(0, 500)}`));
        }
        try {
          resolve(JSON.parse(raw));
        } catch (e) {
          reject(new Error(`Invalid JSON response: ${e.message}`));
        }
      });
      res.on('error', reject);
    });

    const timer = setTimeout(() => {
      req.destroy();
      reject(new Error(`Request timeout after ${timeoutMs}ms`));
    }, timeoutMs);

    req.on('error', e => { clearTimeout(timer); reject(e); });
    req.on('close', () => clearTimeout(timer));
    req.write(bodyStr);
    req.end();
  });
}

/**
 * 文件转 base64
 */
async function fileToBase64(filePath) {
  const buffer = fs.readFileSync(filePath);
  return buffer.toString('base64');
}

/**
 * 图片生成（Text2Image / Image2Image）
 * @param {object} options 
 * @param {string} options.api_key - Agnes API key
 * @param {string} options.prompt - 提示词
 * @param {string} [options.negative_prompt] - 负面提示词
 * @param {number} [options.width=1024] - 宽度
 * @param {number} [options.height=576] - 高度
 * @param {string} [options.image_path] - 参考图路径（图生图用）
 * @param {number} [options.num_images=1] - 生成数量
 * @param {string} [options.model='agnes-image-2.1-flash'] - 模型名
 */
async function generateImage(options) {
  const {
    api_key,
    prompt,
    negative_prompt = '',
    width = 1024,
    height = 576,
    image_path = null,
    num_images = 1,
    model = 'agnes-image-2.1-flash',
  } = options;

  if (!api_key) {
    throw new Error('AGNES_API_KEY not set');
  }

  const url = `${API_BASE}/images/generations`;
  
  const body = {
    model,
    prompt,
    n: num_images,
    size: `${width}x${height}`,
    response_format: 'url', // 或 'b64_json'
  };

  if (negative_prompt) {
    body.negative_prompt = negative_prompt;
  }

  // 图生图：参考图转 base64
  if (image_path && fs.existsSync(image_path)) {
    try {
      const img_b64 = await fileToBase64(image_path);
      body.image = img_b64;
    } catch (e) {
      throw new Error(`Failed to encode reference image: ${e.message}`);
    }
  }

  const headers = {
    'Authorization': `Bearer ${api_key}`,
    'Content-Type': 'application/json',
  };

  const result = await postJSON(url, headers, body, 120000);

  // 解析结果
  const urls = [];
  const b64s = [];

  const data = result.data || [];
  for (const item of data) {
    if (item.url) {
      urls.push(item.url);
    }
    if (item.b64_json) {
      b64s.push(item.b64_json);
    }
  }

  return {
    urls,
    b64_json: b64s,
    provider: 'agnes',
    model,
  };
}

/**
 * 视频生成状态查询
 * @param {string} api_key 
 * @param {string} task_id 
 */
async function getVideoStatus(api_key, task_id) {
  const url = `${API_BASE}/video/generations/${task_id}`;
  
  const headers = {
    'Authorization': `Bearer ${api_key}`,
    'Content-Type': 'application/json',
  };

  return postJSON(url, headers, {}, 30000);
}

/**
 * 视频生成（异步）
 * @param {object} options 
 * @param {string} options.api_key 
 * @param {string} options.prompt 
 * @param {string} [options.image_path] - 首帧图片路径
 * @param {string} [options.model='agnes-video-v2.0'] 
 * @param {number} [options.poll_interval_ms=10000] - 轮询间隔
 * @param {number} [options.max_poll_count=90] - 最大轮询次数（~15 分钟）
 */
async function generateVideo(options) {
  const {
    api_key,
    prompt,
    image_path = null,
    model = 'agnes-video-v2.0',
    poll_interval_ms = 10000,
    max_poll_count = 90,
  } = options;

  if (!api_key) {
    throw new Error('AGNES_API_KEY not set');
  }

  // Step 1: Submit async request
  const submitUrl = `${API_BASE}/video/generations`;
  
  const body = {
    model,
    prompt,
  };

  if (image_path && fs.existsSync(image_path)) {
    try {
      const img_b64 = await fileToBase64(image_path);
      body.image = img_b64;
    } catch (e) {
      throw new Error(`Failed to encode reference image: ${e.message}`);
    }
  }

  const headers = {
    'Authorization': `Bearer ${api_key}`,
    'Content-Type': 'application/json',
  };

  const submitResult = await postJSON(submitUrl, headers, body, 30000);
  
  const task_id = submitResult.task_id || submitResult.id;
  if (!task_id) {
    throw new Error(`Video submit failed: ${JSON.stringify(submitResult)}`);
  }

  // Step 2: Poll for result
  console.log(`[Agnes Video] Task submitted: ${task_id}, polling...`);
  
  for (let i = 0; i < max_poll_count; i++) {
    await new Promise(r => setTimeout(r, poll_interval_ms));
    
    try {
      const status = await getVideoStatus(api_key, task_id);
      
      // 解析嵌套结构
      const outer_data = status.data || {};
      const inner_data = typeof outer_data === 'object' ? (outer_data.data || {}) : {};
      
      const status_value = inner_data.status || outer_data.status || status.status || '';
      const progress = inner_data.progress || outer_data.progress || 0;
      
      console.log(`[Agnes Video] Poll ${i+1}/${max_poll_count}: status=${status_value} progress=${progress}%`);
      
      if (['completed', 'SUCCESS', 'SUCCEEDED'].includes(status_value.toUpperCase())) {
        // 视频 URL 在 remixed_from_video_id 字段
        const video_url = inner_data.remixed_from_video_id || 
                         inner_data.video_url || 
                         outer_data.result_url || 
                         outer_data.video_url || '';
        
        const duration = parseFloat(inner_data.seconds || '5.0');
        
        console.log(`[Agnes Video] Completed! URL: ${video_url}, Duration: ${duration}s`);
        
        return {
          video_url,
          duration,
          task_id,
          provider: 'agnes',
          model,
        };
      } else if (['failed', 'FAILED', 'error'].includes(status_value.toLowerCase())) {
        const fail_reason = outer_data.fail_reason || inner_data.error || '';
        throw new Error(`Video generation failed: ${fail_reason}`);
      }
      
    } catch (e) {
      // Rate limit 临时 401，继续轮询
      console.warn(`[Agnes Video] Poll error (will retry): ${e.message}`);
      continue;
    }
  }

  throw new Error(`Video generation timeout after ${max_poll_count * poll_interval_ms / 1000}s`);
}

/**
 * 检查是否可用
 */
function isAvailable() {
  return !!process.env.AGNES_API_KEY;
}

module.exports = {
  generateImage,
  generateVideo,
  getVideoStatus,
  isAvailable,
  API_BASE,
};
