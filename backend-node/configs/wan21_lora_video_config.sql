-- Wan2.1 14B I2V + LightX2V 4-step LoRA 720P ComfyUI 视频生成配置
-- 基于已调试的 wan21_fp8_lightx2v_720p.json 工作流
-- 4步LoRA蒸馏，相比标准20步快5倍，适合短剧批量视频生成
--
-- 模型文件要求（ComfyUI端）：
--   扩散模型: Wan2_1-I2V-14B-720P_fp8_e4m3fn.safetensors (16G)
--   T5编码器: umt5-xxl-enc-bf16.safetensors (11G)
--   VAE:      Wan2_1_VAE_bf16.safetensors (243M)
--   CLIP:     clip_vision_h.safetensors (1.2G)
--   LoRA:     wan2.1_i2v_lora_rank64_lightx2v_4step.safetensors

INSERT INTO ai_service_configs
    (name, provider, service_type, api_protocol, base_url, api_key,
     model, default_model, endpoint, query_endpoint,
     is_default, is_active, settings, created_at, updated_at)
SELECT
    'ComfyUI-Wan2.1-LoRA-I2V-720P', 'comfyui', 'video', 'comfyui',
    'http://127.0.0.1:8188', '',
    '["wan21-i2v-14b-lora"]', 'wan21-i2v-14b-lora',
    '/prompt', '/history/{prompt_id}',
    1, 1,
    '{"workflow_file":"wan21_fp8_lightx2v_720p.json","steps":4,"cfg":1.0,"fps":16,"default_duration":2.5,"timeout":600,"poll_interval":10}',
    datetime('now'), datetime('now')
WHERE NOT EXISTS (
    SELECT 1 FROM ai_service_configs
    WHERE name = 'ComfyUI-Wan2.1-LoRA-I2V-720P'
);

-- 将其他comfyui video配置设为非默认（WAN 2.1 LoRA作为主力）
UPDATE ai_service_configs
SET is_default = 0, updated_at = datetime('now')
WHERE service_type = 'video' AND provider = 'comfyui'
  AND name != 'ComfyUI-Wan2.1-LoRA-I2V-720P';

-- 查看结果
SELECT id, name, provider, is_default, is_active, settings
FROM ai_service_configs
WHERE service_type = 'video';
