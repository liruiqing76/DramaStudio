-- FLUX.1 GGUF 图片生成 ComfyUI 配置
INSERT INTO ai_service_configs 
    (name, provider, service_type, api_protocol, base_url, api_key, 
     model, default_model, endpoint, query_endpoint, 
     is_default, is_active, settings, created_at, updated_at)
SELECT 
    'ComfyUI-FLUX.1-GGUF', 'comfyui', 'image', 'comfyui',
    'http://127.0.0.1:8188', '',
    '["flux1-gguf"]', 'flux1-gguf',
    '/prompt', '/history/{prompt_id}',
    1, 1,
    '{"workflow_file":"flux2_gguf_t2i.json","steps":20,"cfg":7.0,"timeout":600,"poll_interval":5}',
    datetime('now'), datetime('now')
WHERE NOT EXISTS (
    SELECT 1 FROM ai_service_configs 
    WHERE service_type = 'image' AND provider = 'comfyui'
);

SELECT id, name, provider, base_url, is_default, settings 
FROM ai_service_configs 
WHERE service_type = 'image';
