Write-Host "=== 下载 FLUX.2 辅助模型 ===" -ForegroundColor Cyan

sshpass -p T9Erp7FBQgdk ssh -p 23156 -o StrictHostKeyChecking=no -o UserKnownHostsFile=NUL root@connect.westb.seetacloud.com /root/miniconda3/bin/python -c "import urllib.request;urllib.request.urlretrieve('https://hf-mirror.com/comfyanonymous/flux_text_encoders/resolve/main/clip_l.safetensors','/root/autodl-tmp/comfyui_models/text_encoders/clip_l.safetensors')"

Write-Host "clip_l 完成" -ForegroundColor Green

sshpass -p T9Erp7FBQgdk ssh -p 23156 -o StrictHostKeyChecking=no -o UserKnownHostsFile=NUL root@connect.westb.seetacloud.com /root/miniconda3/bin/python -c "import urllib.request;urllib.request.urlretrieve('https://hf-mirror.com/black-forest-labs/FLUX.2-dev/resolve/main/ae.safetensors','/root/autodl-tmp/comfyui_models/vae/ae.safetensors')"

Write-Host "ae.safetensors 完成" -ForegroundColor Green

Write-Host "=== 全部完成 ===" -ForegroundColor Cyan
pause
