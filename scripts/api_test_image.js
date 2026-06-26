// 快速测试：通过项目API提交ComfyUI图片生成任务，并轮询结果
const http = require('http');

const HOST = '127.0.0.1';
const PORT = 5679;

// ---- 测试1: 文生图 (T2I) ----
function testT2I() {
  console.log('\n=== 测试1: 文生图 (T2I) ===');

  const data = JSON.stringify({
    drama_id: 1,
    provider: 'comfyui',
    prompt: 'a cute cat sitting on a windowsill, warm sunlight, cozy room, cinematic lighting, 4K, high quality',
    aspect_ratio: '16:9'
  });

  const options = {
    hostname: HOST,
    port: PORT,
    path: '/api/v1/images',
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

        if (result.id || result.data?.id) {
          const id = result.id || result.data?.id;
          const taskId = result.task_id || result.data?.task_id;
          console.log('\n✅ 图片生成任务已提交！');
          console.log('图片ID:', id);
          console.log('任务ID:', taskId);
          console.log('查询图片: GET /api/v1/images/' + id);
          if (taskId) {
            console.log('查询任务: GET /api/v1/tasks/' + taskId);
            pollTask(taskId, id);
          }
        } else {
          console.log('\n⚠️ 任务提交可能失败，检查返回数据');
        }
      } catch(e) {
        console.log('Raw:', body);
      }
    });
  });

  req.on('timeout', () => { req.destroy(); console.log('❌ 请求超时'); });
  req.on('error', (e) => console.error('❌ 错误:', e.message));
  req.write(data);
  req.end();
}

// ---- 测试2: 查询AI配置 ----
function testAiConfig() {
  console.log('\n=== 测试2: 查询AI配置 (确认comfyui图片配置存在) ===');

  const options = {
    hostname: HOST,
    port: PORT,
    path: '/api/v1/ai-configs?service_type=image',
    method: 'GET',
    timeout: 10000
  };

  const req = http.request(options, (res) => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => {
      console.log('Status:', res.statusCode);
      try {
        const result = JSON.parse(body);
        const configs = result.data || result;
        console.log('图片AI配置数量:', Array.isArray(configs) ? configs.length : '未知');
        if (Array.isArray(configs)) {
          configs.forEach(c => {
            console.log(`  - ${c.name} | provider: ${c.provider} | protocol: ${c.api_protocol} | active: ${c.is_active} | default: ${c.is_default}`);
            if (c.settings) {
              const s = JSON.parse(c.settings || '{}');
              console.log(`    workflow: ${s.workflow_file || '(默认)'}`);
              console.log(`    base_url: ${c.base_url}`);
            }
          });
        }
      } catch(e) {
        console.log('Raw:', body);
      }
    });
  });

  req.on('timeout', () => { req.destroy(); console.log('❌ 超时'); });
  req.on('error', (e) => console.error('❌ 错误:', e.message));
  req.end();
}

// ---- 测试3: 查询drama列表 (确认drama_id=1存在) ----
function testDrama() {
  console.log('\n=== 测试3: 查询drama列表 ===');

  const options = {
    hostname: HOST,
    port: PORT,
    path: '/api/v1/dramas',
    method: 'GET',
    timeout: 10000
  };

  const req = http.request(options, (res) => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => {
      console.log('Status:', res.statusCode);
      try {
        const result = JSON.parse(body);
        const dramas = result.data || result.items || result;
        if (Array.isArray(dramas)) {
          console.log('Drama数量:', dramas.length);
          dramas.forEach(d => {
            console.log(`  - ID:${d.id} | ${d.title || d.name || '(无名)'} | status: ${d.status || '?'}`);
          });
        }
      } catch(e) {
        console.log('Raw:', body);
      }
    });
  });

  req.on('timeout', () => { req.destroy(); console.log('❌ 超时'); });
  req.on('error', (e) => console.error('❌ 错误:', e.message));
  req.end();
}

// ---- 轮询任务状态 ----
function pollTask(taskId, imageId, maxAttempts = 120, interval = 3000) {
  console.log(`\n--- 轮询任务 ${taskId} (最多${maxAttempts}次, 每${interval}ms) ---`);
  let attempts = 0;

  const poll = () => {
    attempts++;
    const options = {
      hostname: HOST,
      port: PORT,
      path: '/api/v1/tasks/' + taskId,
      method: 'GET',
      timeout: 10000
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(body);
          const task = result.data || result;
          const status = task.status || 'unknown';
          console.log(`[${attempts}/${maxAttempts}] 任务状态: ${status}`);

          if (status === 'completed') {
            console.log('\n✅ 图片生成完成！');
            console.log('结果:', JSON.stringify(task.result || task, null, 2));
            // 查询图片详情
            getImageDetail(imageId);
            return;
          }
          if (status === 'failed') {
            console.log('\n❌ 图片生成失败！');
            console.log('错误:', task.error || task.result?.error || '未知');
            return;
          }
          if (attempts < maxAttempts) {
            setTimeout(poll, interval);
          } else {
            console.log('\n⚠️ 超过最大轮询次数，任务可能仍在处理');
          }
        } catch(e) {
          console.log('Raw:', body);
          if (attempts < maxAttempts) setTimeout(poll, interval);
        }
      });
    });

    req.on('timeout', () => {
      console.log(`[${attempts}] 轮询超时`);
      if (attempts < maxAttempts) setTimeout(poll, interval);
    });
    req.on('error', (e) => {
      console.error(`[${attempts}] 轮询错误:`, e.message);
      if (attempts < maxAttempts) setTimeout(poll, interval);
    });
    req.end();
  };

  setTimeout(poll, interval);
}

// ---- 查询图片详情 ----
function getImageDetail(imageId) {
  const options = {
    hostname: HOST,
    port: PORT,
    path: '/api/v1/images/' + imageId,
    method: 'GET',
    timeout: 10000
  };

  const req = http.request(options, (res) => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => {
      try {
        const result = JSON.parse(body);
        const img = result.data || result;
        console.log('\n=== 图片详情 ===');
        console.log('ID:', img.id);
        console.log('状态:', img.status);
        console.log('Prompt:', img.prompt?.slice(0, 100));
        console.log('尺寸:', img.size || img.width + 'x' + img.height);
        console.log('URL:', img.image_url || img.url || '(无)');
        console.log('本地路径:', img.local_path || '(无)');
        console.log('Provider:', img.provider);
        console.log('Model:', img.model);
      } catch(e) {
        console.log('Raw:', body);
      }
    });
  });

  req.on('error', (e) => console.error('查询图片错误:', e.message));
  req.end();
}

// ---- 主流程 ----
console.log('========================================');
console.log('  图片生成功能测试 (ComfyUI FLUX.2)');
console.log('========================================');

// 先检查前置条件，再提交任务
testAiConfig();
testDrama();

// 延迟2秒后提交图片生成任务（等前置查询完成）
setTimeout(testT2I, 2000);
