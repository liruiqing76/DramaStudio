#!/bin/bash
# Create symlink for the new model file
ln -sf /root/autodl-tmp/comfyui_models/diffusion_models/wan_fp8_scaled/I2V/Wan2_1-I2V-14B-720P_fp8_e4m3fn.safetensors /root/autodl-tmp/ComfyUI/models/diffusion_models/Wan2_1-I2V-14B-720P_fp8_e4m3fn.safetensors
ls -lh /root/autodl-tmp/ComfyUI/models/diffusion_models/Wan2_1-I2V-14B-720P_fp8_e4m3fn.safetensors

# Also verify model structure
/root/autodl-tmp/miniconda3/bin/python -c "
from safetensors import safe_open
f = safe_open('/root/autodl-tmp/comfyui_models/diffusion_models/wan_fp8_scaled/I2V/Wan2_1-I2V-14B-720P_fp8_e4m3fn.safetensors', framework='pt')
t = f.get_tensor('patch_embedding.weight')
print(f'shape={t.shape} dtype={t.dtype}')
# Check total number of keys
keys = list(f.keys())
print(f'Total keys: {len(keys)}')
# Sample a few weight dtypes
for k in keys[:5]:
    dt = f.get_tensor(k).dtype
    sh = f.get_tensor(k).shape
    print(f'  {k}: dtype={dt} shape={sh}')
"
