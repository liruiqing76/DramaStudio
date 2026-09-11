@echo off
chcp 65001 >nul
echo ===== 下载 FLUX.2 辅助模型 =====
echo.

sshpass -p T9Erp7FBQgdk ssh -p 23156 -o StrictHostKeyChecking=no -o UserKnownHostsFile=NUL root@connect.westb.seetacloud.com curl -sL --insecure -o /root/autodl-tmp/comfyui_models/text_encoders/clip_l.safetensors https://hf-mirror.com/comfyanonymous/flux_text_encoders/resolve/main/clip_l.safetensors

echo clip_l 下载完成

sshpass -p T9Erp7FBQgdk ssh -p 23156 -o StrictHostKeyChecking=no -o UserKnownHostsFile=NUL root@connect.westb.seetacloud.com curl -sL --insecure -o /root/autodl-tmp/comfyui_models/vae/ae.safetensors https://hf-mirror.com/black-forest-labs/FLUX.2-dev/resolve/main/ae.safetensors

echo ae.safetensors 下载完成

sshpass -p T9Erp7FBQgdk ssh -p 23156 -o StrictHostKeyChecking=no -o UserKnownHostsFile=NUL root@connect.westb.seetacloud.com "ls -lh /root/autodl-tmp/comfyui_models/text_encoders/clip_l.safetensors /root/autodl-tmp/comfyui_models/vae/ae.safetensors"

echo ===== 全部完成 =====
pause
