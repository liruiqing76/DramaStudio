#!/bin/bash
# Download Wan2_1_VAE_bf16.safetensors from hf-mirror
source /etc/network_turbo
cd /root/autodl-tmp/comfyui_models/vae/
wget -c -O Wan2_1_VAE_bf16.safetensors "https://hf-mirror.com/Kijai/WanVideo_comfy/resolve/main/Wan2_1_VAE_bf16.safetensors"
ls -lh Wan2_1_VAE_bf16.safetensors

# Create symlink
ln -sf /root/autodl-tmp/comfyui_models/vae/Wan2_1_VAE_bf16.safetensors /root/autodl-tmp/ComfyUI/models/vae/Wan2_1_VAE_bf16.safetensors
echo "VAE symlink created"
