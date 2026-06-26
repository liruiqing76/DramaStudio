#!/bin/bash
# Delete the WRONG file (5B masquerading as 14B)
rm -f /root/autodl-tmp/comfyui_models/diffusion_models/wan_fp8_scaled/I2V/wan2.1_i2v_480p_720p_14B_fp8_e4m3fn.safetensors
echo "DELETED wrong file"

# Enable academic accelerator
source /etc/network_turbo

# Download REAL 14B I2V fp8 from Kijai on hf-mirror
cd /root/autodl-tmp/comfyui_models/diffusion_models/wan_fp8_scaled/I2V

echo "Downloading Wan2_1-I2V-14B-720P_fp8_e4m3fn.safetensors..."
wget -c -O Wan2_1-I2V-14B-720P_fp8_e4m3fn.safetensors \
  "https://hf-mirror.com/Kijai/WanVideo_comfy/resolve/main/Wan2_1-I2V-14B-720P_fp8_e4m3fn.safetensors"

echo "DONE"
ls -lh *.safetensors
