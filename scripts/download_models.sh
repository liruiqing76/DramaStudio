#!/bin/bash
set -e
BASE=/root/autodl-tmp/comfyui_models

echo "=== FLUX.2 模型下载 (ModelScope) ==="

echo "1/3 flux2-dev-Q4_K_M.gguf (20GB)"
/root/miniconda3/bin/python3 << 'PYEOF'
from modelscope import snapshot_download
snapshot_download('city96/FLUX.2-dev-gguf',
    allow_patterns=['flux2-dev-Q4_K_M.gguf'],
    cache_dir='/root/autodl-tmp/comfyui_models/diffusion_models/GGUF')
print('flux2 done')
PYEOF

echo "2/3 clip_l.safetensors (246MB)"
/root/miniconda3/bin/python3 << 'PYEOF'
from modelscope import snapshot_download
snapshot_download('comfyanonymous/flux_text_encoders',
    allow_patterns=['clip_l.safetensors'],
    cache_dir='/root/autodl-tmp/comfyui_models/text_encoders')
print('clip_l done')
PYEOF

echo "3/3 ae.safetensors (335MB)"
/root/miniconda3/bin/python3 << 'PYEOF'
from modelscope import snapshot_download
snapshot_download('AI-ModelScope/FLUX.1-dev',
    allow_patterns=['ae.safetensors'],
    cache_dir='/root/autodl-tmp/comfyui_models/vae')
print('ae done')
PYEOF

echo "=== 验证 ==="
find /root/autodl-tmp/comfyui_models -name "flux2-dev-Q4_K_M.gguf" -ls
find /root/autodl-tmp/comfyui_models -name "clip_l.safetensors" -ls
find /root/autodl-tmp/comfyui_models -name "ae.safetensors" -ls
echo "=== 完成 ==="
