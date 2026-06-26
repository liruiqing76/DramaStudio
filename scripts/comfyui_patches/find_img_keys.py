from safetensors import safe_open
model_path = '/root/autodl-tmp/comfyui_models/diffusion_models/wan_fp8_scaled/I2V/Wan2_2-I2V-A14B-HIGH_fp8_e4m3fn_scaled_KJ.safetensors'
f = safe_open(model_path, framework='pt')
all_keys = list(f.keys())
prefixes = set(k.split('.')[0] for k in all_keys)
print(f'All key prefixes: {sorted(list(prefixes))}')

# Find any keys that could be img_emb/image embedding related
for k in all_keys:
    if 'emb' in k.lower() or 'proj' in k.lower() or 'cond' in k.lower() or 'image' in k.lower() or 'clip' in k.lower():
        print(f'  Potential: {k}')
