-- FLUX.2 GGUF 图片生成 ComfyUI 配置
-- 请使用SQLite工具执行此SQL

-- 1. 检查现有图片配置
SELECT id, name, provider, base_url, api_protocol, is_default 
FROM ai_service_configs 
WHERE service_type = 'image';

-- 2. 插入 FLUX.2 图片生成配置
INSERT INTO ai_service_configs 
    (name, provider, service_type, api_protocol, base_url, api_key, 
     model, default_model, endpoint, query_endpoint, 
     is_default, is_active, settings, created_at, updated_at)
SELECT 
    'ComfyUI-FLUX.2-GGUF', 'comfyui', 'image', 'comfyui',
    'http://127.0.0.1:8188', '',
    '["flux2-gguf"]', 'flux2-gguf',
    '/prompt', '/history/{prompt_id}',
    1, 1,
    '{"workflow_file":"flux2_gguf_t2i.json","timeout":300,"poll_interval":3}',
    datetime('now'), datetime('now')
WHERE NOT EXISTS (
    SELECT 1 FROM ai_service_configs 
    WHERE service_type = 'image' AND provider = 'comfyui'
);

-- 3. 查看最终配置
SELECT id, name, provider, base_url, api_protocol, is_default, settings 
FROM ai_service_configs 
WHERE service_type = 'image';
