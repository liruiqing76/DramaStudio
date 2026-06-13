-- 更新ComfyUI配置为LTX Video
-- 请使用SQLite工具执行此SQL

-- 1. 检查现有配置
SELECT id, name, provider, base_url, api_protocol, is_default 
FROM ai_service_configs 
WHERE service_type = 'video';

-- 2. 更新ComfyUI配置（如果已存在）
UPDATE ai_service_configs 
SET 
    name = 'ComfyUI-LTX-Video',
    provider = 'comfyui',
    service_type = 'video',
    api_protocol = 'comfyui',
    base_url = 'http://116.172.93.163:8188',
    api_key = '',
    model = '["ltx-video-2b", "ltx-video-13b"]',
    default_model = 'ltx-video-2b',
    endpoint = '/prompt',
    query_endpoint = '/history/{prompt_id}',
    is_default = 1,
    is_active = 1,
    settings = '{"workflow_type":"ltx-video-t2v","timeout":600,"poll_interval":5}',
    updated_at = datetime('now')
WHERE provider = 'comfyui' OR name LIKE '%ComfyUI%';

-- 如果上面没更新到任何行，则插入新配置
INSERT INTO ai_service_configs 
    (name, provider, service_type, api_protocol, base_url, api_key, 
     model, default_model, endpoint, query_endpoint, 
     is_default, is_active, settings, created_at, updated_at)
SELECT 
    'ComfyUI-LTX-Video', 'comfyui', 'video', 'comfyui',
    'http://116.172.93.163:8188', '',
    '["ltx-video-2b", "ltx-video-13b"]', 'ltx-video-2b',
    '/prompt', '/history/{prompt_id}',
    1, 1,
    '{"workflow_type":"ltx-video-t2v","timeout":600,"poll_interval":5}',
    datetime('now'), datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM ai_service_configs WHERE provider = 'comfyui');

-- 3. 禁用其他视频模型（让ComfyUI成为默认）
UPDATE ai_service_configs 
SET is_default = 0 
WHERE service_type = 'video' AND provider != 'comfyui';

-- 4. 查看最终配置
SELECT id, name, provider, base_url, api_protocol, is_default, settings 
FROM ai_service_configs 
WHERE service_type = 'video';
