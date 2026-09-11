-- Wan2.2 蒸馏4步 I2V ComfyUI 视频生成配置（替换Q4 GGUF）
-- 方案A: FP8_scaled 14B 两段管线 (HIGH + LOW noise, 4步) - 主力
-- 方案B: 5B TI2V 蒸馏版 (WanVideoWrapper节点, 轻量, 对话/特写场景)
-- 方案C: 5B Ovi 可控版 (WanVideoWrapper节点, 960x960, 物体运动控制)

-- 1. 添加 FP8_scaled 14B 蒸馏版配置（主力）
INSERT INTO ai_service_configs
    (name, provider, service_type, api_protocol, base_url, api_key,
     model, default_model, endpoint, query_endpoint,
     is_default, is_active, settings, created_at, updated_at)
SELECT
    'ComfyUI-Wan2.2-Distill-I2V', 'comfyui', 'video', 'comfyui',
    'http://127.0.0.1:8188', '',
    '["wan22-distill-fp8"]', 'wan22-distill-fp8',
    '/prompt', '/history/{prompt_id}',
    1, 1,
    '{"workflow_file":"wan22_distill_i2v.json","steps":4,"cfg":5.0,"timeout":600,"poll_interval":3}',
    datetime('now'), datetime('now')
WHERE NOT EXISTS (
    SELECT 1 FROM ai_service_configs
    WHERE name = 'ComfyUI-Wan2.2-Distill-I2V'
);

-- 2. 添加 5B TI2V 蒸馏版配置（轻量备选）
INSERT INTO ai_service_configs
    (name, provider, service_type, api_protocol, base_url, api_key,
     model, default_model, endpoint, query_endpoint,
     is_default, is_active, settings, created_at, updated_at)
SELECT
    'ComfyUI-Wan2.2-5B-TI2V', 'comfyui', 'video', 'comfyui',
    'http://127.0.0.1:8188', '',
    '["wan22-5b-distill"]', 'wan22-5b-distill',
    '/prompt', '/history/{prompt_id}',
    0, 1,
    '{"workflow_file":"wan22_5b_distill_i2v.json","steps":4,"cfg":5.0,"timeout":600,"poll_interval":3}',
    datetime('now'), datetime('now')
WHERE NOT EXISTS (
    SELECT 1 FROM ai_service_configs
    WHERE name = 'ComfyUI-Wan2.2-5B-TI2V'
);

-- 3. 添加 5B Ovi 可控版配置（物体运动控制）
INSERT INTO ai_service_configs
    (name, provider, service_type, api_protocol, base_url, api_key,
     model, default_model, endpoint, query_endpoint,
     is_default, is_active, settings, created_at, updated_at)
SELECT
    'ComfyUI-Wan2.2-5B-Ovi', 'comfyui', 'video', 'comfyui',
    'http://127.0.0.1:8188', '',
    '["wan22-5b-ovi"]', 'wan22-5b-ovi',
    '/prompt', '/history/{prompt_id}',
    0, 1,
    '{"workflow_file":"wan22_5b_ovi_i2v.json","steps":4,"cfg":5.0,"timeout":600,"poll_interval":3}',
    datetime('now'), datetime('now')
WHERE NOT EXISTS (
    SELECT 1 FROM ai_service_configs
    WHERE name = 'ComfyUI-Wan2.2-5B-Ovi'
);

-- 4. 将旧的Q4 GGUF配置设为非默认（保留不删）
UPDATE ai_service_configs
SET is_default = 0, updated_at = datetime('now')
WHERE service_type = 'video' AND provider = 'comfyui'
  AND name != 'ComfyUI-Wan2.2-Distill-I2V';

-- 查看结果
SELECT id, name, provider, is_default, is_active, settings
FROM ai_service_configs
WHERE service_type = 'video';
