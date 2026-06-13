const Database = require('better-sqlite3');
const db = new Database('./data/drama_generator.db');
const now = new Date().toISOString();

// 1. 插入 DeepSeek 文本模型配置
db.prepare(`
  INSERT INTO ai_service_configs (service_type, provider, base_url, api_key, model, endpoint, is_default, priority, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`).run(
  'text',
  'openai',
  'https://api.deepseek.com',
  'YOUR_DEEPSEEK_API_KEY',
  JSON.stringify(['deepseek-v4-flash']),
  '/chat/completions',
  1, 100, now, now
);

console.log('✅ DeepSeek 文本模型配置已插入');
console.log('⚠️  请在AI配置页面填入你的 DeepSeek API Key');

// 2. 插入图片模型配置（通义万相 - DashScope）
db.prepare(`
  INSERT INTO ai_service_configs (service_type, provider, base_url, api_key, model, endpoint, is_default, priority, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`).run(
  'image',
  'dashscope',
  'https://dashscope.aliyuncs.com',
  'YOUR_DASHSCOPE_API_KEY',
  JSON.stringify(['wanx2.1-t2i-turbo']),
  '/api/v1/services/aigc/multimodal-generation/generation',
  1, 100, now, now
);

console.log('✅ 通义万相图片模型配置已插入');

// 3. 插入分镜图片模型配置
db.prepare(`
  INSERT INTO ai_service_configs (service_type, provider, base_url, api_key, model, endpoint, is_default, priority, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`).run(
  'storyboard_image',
  'dashscope',
  'https://dashscope.aliyuncs.com',
  'YOUR_DASHSCOPE_API_KEY',
  JSON.stringify(['wanx2.1-t2i-turbo']),
  '/api/v1/services/aigc/multimodal-generation/generation',
  1, 100, now, now
);

console.log('✅ 分镜图片模型配置已插入');

// 4. 插入视频模型配置（Wan2.2 - DashScope）
db.prepare(`
  INSERT INTO ai_service_configs (service_type, provider, base_url, api_key, model, endpoint, query_endpoint, is_default, priority, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`).run(
  'video',
  'dashscope',
  'https://dashscope.aliyuncs.com',
  'YOUR_DASHSCOPE_API_KEY',
  JSON.stringify(['wan2.2-kf2v-flash']),
  '/api/v1/services/aigc/image2video/video-synthesis',
  '/api/v1/tasks/{taskId}',
  1, 100, now, now
);

console.log('✅ Wan2.2 视频模型配置已插入');

db.close();
console.log('\n📌 配置完成！请在AI配置页面替换API Key');
