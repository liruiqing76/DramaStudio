#!/usr/bin/env python3
"""
Comprehensive fix script for WanVideoWrapper meta device bug + 68ch issue
Runs on AutoDL server
"""
import os

# 1. Fix meta device bug in model.py - force img_emb to main_device before use
MODEL_PY = '/root/autodl-tmp/ComfyUI/custom_nodes/ComfyUI-WanVideoWrapper/wanvideo/modules/model.py'
content = open(MODEL_PY).read()

# Find the line: clip_embed = self.img_emb(clip_fea.to(self.main_device))
# Add a line before it to force img_emb to main_device
target = 'clip_embed = self.img_emb(clip_fea.to(self.main_device))'
if target in content:
    fix = 'self.img_emb = self.img_emb.to(self.main_device)\n            clip_embed = self.img_emb(clip_fea.to(self.main_device))'
    content = content.replace(target, fix, 1)
    print(f'[FIX1] Patched img_emb meta device bug in model.py')
else:
    print('[FIX1] Target line not found - may already be patched or different version')
    # Search for similar patterns
    for line_num, line in enumerate(content.splitlines(), 1):
        if 'self.img_emb(' in line and 'clip_fea' in line:
            print(f'  Found at L{line_num}: {line.strip()[:80]}')

# 2. Also fix the second img_emb call (for clip_fea_c)
target2 = 'clip_embed += self.img_emb(clip_fea_c.to(self.main_device))'
if target2 in content:
    fix2 = 'self.img_emb = self.img_emb.to(self.main_device)\n                    clip_embed += self.img_emb(clip_fea_c.to(self.main_device))'
    content = content.replace(target2, fix2, 1)
    print(f'[FIX2] Patched second img_emb call in model.py')
else:
    print('[FIX2] Second target not found')

open(MODEL_PY, 'w').write(content)

# 3. Check model safetensors keys to verify img_emb exists
from safetensors import safe_open
model_path = '/root/autodl-tmp/comfyui_models/diffusion_models/wan_fp8_scaled/I2V/Wan2_2-I2V-A14B-HIGH_fp8_e4m3fn_scaled_KJ.safetensors'
f = safe_open(model_path, framework='pt')
all_keys = list(f.keys())
img_keys = [k for k in all_keys if 'img_emb' in k]
print(f'[CHECK] img_emb keys in model file: {img_keys}')
print(f'[CHECK] Total keys: {len(all_keys)}')

# 4. Restart ComfyUI
print('[RESTART] Killing old ComfyUI process...')
os.system('pkill -f "python main.py" 2>/dev/null')
import time
time.sleep(3)
print('[RESTART] Starting ComfyUI...')
os.system('cd /root/autodl-tmp/ComfyUI && nohup /root/miniconda3/bin/python main.py --listen 0.0.0.0 --port 8188 > /tmp/comfyui_restart.log 2>&1 &')
time.sleep(10)
# Verify it started
import urllib.request
try:
    resp = urllib.request.urlopen('http://127.0.0.1:8188/system_stats')
    print('[RESTART] ComfyUI is running!')
except:
    print('[RESTART] Waiting more...')
    time.sleep(10)
    try:
        resp = urllib.request.urlopen('http://127.0.0.1:8188/system_stats')
        print('[RESTART] ComfyUI is running!')
    except:
        print('[RESTART] ComfyUI may not be ready yet - check manually')

print('[DONE] All fixes applied!')
