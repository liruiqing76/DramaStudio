#!/bin/bash
# LocalMiniDrama一键启动脚本 - SSH到AutoDL服务器执行

# 1. 修复load_weights（跳过缺失的k_img）
/root/miniconda3/bin/python3 << 'PYEOF'
with open('/root/autodl-tmp/ComfyUI/custom_nodes/ComfyUI-WanVideoWrapper/nodes_model_loading.py', 'r') as f:
    content = f.read()
if 'if key not in sd:\n            continue\n        value=sd[key]' not in content:
    content = content.replace('value=sd[key]', 'if key not in sd:\n            continue\n        value=sd[key]', 1)
    print('load_weights patched')
else:
    print('load_weights already patched')
with open('/root/autodl-tmp/ComfyUI/custom_nodes/ComfyUI-WanVideoWrapper/nodes_model_loading.py', 'w') as f:
    f.write(content)
PYEOF

# 2. 修复Wan22ImageToVideoLatent（48->36通道+2x下采样）
/root/miniconda3/bin/python3 << 'PYEOF'
import re
with open('/root/autodl-tmp/ComfyUI/comfy_extras/nodes_wan.py', 'r') as f:
    content = f.read()
content = re.sub(r'torch\.zeros\(\[1,\s*48,', 'torch.zeros([1, 36,', content)
if 'avg_pool2d' not in content:
    old = 'latent[:, :, :latent_temp.shape[-3]] *= 0.0'
    new = """# 2x spatial downsample for I2V (VAE 8x vs latent 16x)
            if latent_temp.dim() == 5:
                B, C, T, H, W = latent_temp.shape
                latent_temp = latent_temp.reshape(B * C * T, 1, H, W)
                latent_temp = torch.nn.functional.avg_pool2d(latent_temp, kernel_size=2, stride=2)
                latent_temp = latent_temp.reshape(B, C, T, H // 2, W // 2)
            elif latent_temp.dim() == 4:
                latent_temp = torch.nn.functional.avg_pool2d(latent_temp, kernel_size=2, stride=2)
            latent[:, :, :latent_temp.shape[-3]] *= 0.0"""
    content = content.replace(old, new)
    print('Wan22ImageToVideoLatent patched')
else:
    print('Wan22ImageToVideoLatent already patched')
with open('/root/autodl-tmp/ComfyUI/comfy_extras/nodes_wan.py', 'w') as f:
    f.write(content)
PYEOF

# 3. 下载Wan2.1 I2V GGUF模型（如果不存在）
if [ ! -f "/root/autodl-tmp/comfyui_models/diffusion_models/Wan2.1-I2V-14B-720P-Q4_K_M.gguf" ]; then
    echo "Downloading Wan2.1 I2V 14B GGUF..."
    pip install huggingface_hub -q
    /root/miniconda3/bin/python3 -c "
from huggingface_hub import hf_hub_download
import os
path = hf_hub_download(repo_id='city96/Wan2.1-I2V-14B-720P-gguf', filename='Wan2.1-I2V-14B-720P-Q4_K_M.gguf', local_dir='/root/autodl-tmp/comfyui_models/diffusion_models/', local_dir_use_symlinks=False)
print(f'Downloaded: {path} ({os.path.getsize(path)/1e9:.2f}GB)')
"
else
    echo "Wan2.1 GGUF model already exists"
fi

# 4. 检查14B蒸馏模型是否存在
for f in /root/autodl-tmp/comfyui_models/diffusion_models/wan_fp8_scaled/I2V/Wan2_2-I2V-A14B-HIGH_fp8_e4m3fn_scaled_KJ.safetensors; do
    if [ -f "$f" ]; then echo "14B distill HIGH exists"; else echo "14B distill HIGH MISSING"; fi
done
for f in /root/autodl-tmp/comfyui_models/diffusion_models/wan_fp8_scaled/I2V/Wan2_2-I2V-A14B-LOW_fp8_e4m3fn_scaled_KJ.safetensors; do
    if [ -f "$f" ]; then echo "14B distill LOW exists"; else echo "14B distill LOW MISSING"; fi
done

echo "SETUP COMPLETE - run ComfyUI manually: cd /root/autodl-tmp/ComfyUI && /root/miniconda3/bin/python3 main.py --listen 0.0.0.0 --port 8188"
