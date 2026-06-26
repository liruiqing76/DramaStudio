// 快速测试：通过项目API提交ComfyUI视频生成任务
const http = require('http');

const data = JSON.stringify({
  drama_id: 1,
  provider: 'comfyui',
  prompt: 'A beautiful sunset over the ocean, cinematic, 4K, high quality',
  aspect_ratio: '16:9'
});

const options = {
  hostname: '127.0.0.1',
  port: 5679,
  path: '/api/v1/videos',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  },
  timeout: 10000
};

const req = http.request(options, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    try {
      const result = JSON.parse(body);
      console.log('Response:', JSON.stringify(result, null, 2));
      
      if (result.id) {
        console.log('\n✅ 任务已提交！');
        console.log('查询状态: GET /api/v1/videos/' + result.id);
        console.log('或: GET /api/v1/tasks/' + result.task_id);
      }
    } catch(e) {
      console.log('Raw:', body);
    }
  });
});

req.on('timeout', () => { req.destroy(); console.log('Timeout'); });
req.on('error', (e) => console.error('Error:', e.message));
req.write(data);
req.end();
