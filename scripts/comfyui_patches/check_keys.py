from safetensors import safe_open
f = safe_open('/root/autodl-tmp/comfyui_models/diffusion_models/Wan2_2-I2V-A14B-HIGH_fp8_e4m3fn_scaled_KJ.safetensors', framework='pt')
all_keys = list(f.keys())
img_keys = [k for k in all_keys if 'img_emb' in k or 'image_to_cond' in k or 'clip_proj' in k]
print(f'img_emb related keys: {img_keys}')
print(f'Total keys: {len(all_keys)}')
patch_keys = [k for k in all_keys if 'patch_embedding' in k or 'patch_emb' in k]
print(f'patch_embedding keys: {patch_keys[:5]}')
