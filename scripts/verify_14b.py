#!/usr/bin/env python3
from safetensors import safe_open
f = safe_open("/root/autodl-tmp/comfyui_models/diffusion_models/wan_fp8_scaled/I2V/Wan2_1-I2V-14B-720P_fp8_e4m3fn.safetensors", framework="pt")
t = f.get_tensor("patch_embedding.weight")
print(f"shape={t.shape} dtype={t.dtype} in_channels={t.shape[1]}")
scale_keys = [k for k in f.keys() if "scale_weight" in k or "weight_scale" in k]
print(f"scale_keys={len(scale_keys)}")
