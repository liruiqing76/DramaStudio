const { test } = require('node:test');
const assert = require('node:assert');
const { buildQueryUrl } = require('../src/services/videoClient');

test('buildQueryUrl: Agnes config.model 为数组时不报错', () => {
  const config = {
    provider: 'Agnes',
    base_url: 'https://api.agnes-ai.cn/v1',
    model: ['agnes-video-2.5-flash'],  // DB 里存的是数组
  };
  const url = buildQueryUrl(config, 'task_abc123');
  assert.ok(url.includes('video_id=task_abc123'), 'URL 应包含 video_id');
  assert.ok(url.includes('model_name=agnes-video-2.5-flash'), 'URL 应包含 model_name');
});

test('buildQueryUrl: Agnes config.model 为字符串也兼容', () => {
  const config = {
    provider: 'Agnes',
    base_url: 'https://api.agnes-ai.cn/v1',
    model: 'agnes-video-2.5-flash',
  };
  const url = buildQueryUrl(config, 'task_abc456');
  assert.ok(url.includes('model_name=agnes-video-2.5-flash'));
});

test('buildQueryUrl: Agnes config.model 为 null 用默认值', () => {
  const config = {
    provider: 'Agnes',
    base_url: 'https://api.agnes-ai.cn/v1',
    model: null,
  };
  const url = buildQueryUrl(config, 'task_abc789');
  assert.ok(url.includes('model_name=agnes-video-2.5-flash'));
});
