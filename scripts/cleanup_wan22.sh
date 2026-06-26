#!/bin/bash
# Delete wan2.2 models and duplicate GGUF files
# Total savings: ~67G

echo "=== Deleting wan2.2 GGUF in autodl-tmp root (29G) ==="
rm -f /root/autodl-tmp/Wan2.2-I2V-A14B-HighNoise-Q4_K_M.gguf
rm -f /root/autodl-tmp/Wan2.2-I2V-A14B-LowNoise-Q4_K_M.gguf
rm -f /root/autodl-tmp/wan2.2_i2v_A14b_low_noise_lightx2v_4step_720p_260412-Q4_K_M.gguf

echo "=== Deleting wan2.2 fp8 scaled I2V models (30G) ==="
rm -f /root/autodl-tmp/comfyui_models/diffusion_models/wan_fp8_scaled/I2V/Wan2_2-I2V-A14B-HIGH_fp8_e4m3fn_scaled_KJ.safetensors
rm -f /root/autodl-tmp/comfyui_models/diffusion_models/wan_fp8_scaled/I2V/Wan2_2-I2V-A14B-LOW_fp8_e4m3fn_scaled_KJ.safetensors

echo "=== Deleting wan2.2 5B TI2V (5.3G) ==="
rm -f /root/autodl-tmp/comfyui_models/diffusion_models/wan_fp8_scaled/TI2V/Wan2_2-TI2V-5B_fp8_e4m3fn_scaled_KJ_real.safetensors
rm -f /root/autodl-tmp/comfyui_models/diffusion_models/wan_fp8_scaled/TI2V/Wan2_2-TI2V-5B_fp8_e4m3fn_scaled_KJ.safetensors

echo "=== Deleting wan2.2 VAE (1.4G) ==="
rm -f /root/autodl-tmp/comfyui_models/vae/Wan2_2_VAE_bf16.safetensors
rm -f /root/autodl-tmp/ComfyUI/models/vae/Wan2_2_VAE_bf16.safetensors

echo "=== Deleting lightx2v LoRAs (1.2G) ==="
rm -f /root/autodl-tmp/comfyui_models/loras/Wan_2_2_I2V_A14B_HIGH_lightx2v_4step_lora_260412_rank_64_fp16.safetensors
rm -f /root/autodl-tmp/comfyui_models/loras/Wan_2_2_I2V_A14B_LOW_lightx2v_4step_lora_260412_rank_64_fp16.safetensors

echo "=== Cleaning broken symlinks in ComfyUI models ==="
# Remove dangling symlinks pointing to deleted files
find /root/autodl-tmp/ComfyUI/models/ -type l ! -exec test -e {} \; -print -delete 2>/dev/null
find /root/ComfyUI/models/ -type l ! -exec test -e {} \; -print -delete 2>/dev/null

echo "=== Also clean GGUF symlinks in diffusion_models/GGUF ==="
rm -f /root/autodl-tmp/comfyui_models/diffusion_models/GGUF/Wan2.2-I2V-A14B-HighNoise-Q4_K_M.gguf
rm -f /root/autodl-tmp/comfyui_models/diffusion_models/GGUF/Wan2.2-I2V-A14B-LowNoise-Q4_K_M.gguf
rm -f /root/autodl-tmp/comfyui_models/diffusion_models/GGUF/wan2.2_i2v_A14b_low_noise_lightx2v_4step_720p_260412-Q4_K_M.gguf

echo "=== Also clean /root GGUF symlinks ==="
rm -f /root/Wan2.2-I2V-A14B-HighNoise-Q4_K_M.gguf
rm -f /root/Wan2.2-I2V-A14B-LowNoise-Q4_K_M.gguf

echo "=== Disk usage after cleanup ==="
df -h /root/autodl-tmp
