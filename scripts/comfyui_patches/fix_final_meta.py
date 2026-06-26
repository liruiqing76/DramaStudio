#!/usr/bin/env python3
"""
Final fix: 14B distill model has no img_emb weights in safetensors.
The model doesn't use clip image embedding - it only uses VAE-encoded latents.
We need to skip img_emb processing in the forward method.
"""
import os, time

MODEL_PY = '/root/autodl-tmp/ComfyUI/custom_nodes/ComfyUI-WanVideoWrapper/wanvideo/modules/model.py'
content = open(MODEL_PY).read()

# Fix 1: In forward method, skip img_emb if its weights are on meta device
# Original: 
#   if clip_fea is not None and hasattr(self, "img_emb"):
#       if self.offload_img_emb:
#           self.img_emb.to(self.main_device)
#       clip_embed = self.img_emb(clip_fea.to(self.main_device))
# Replace with check for meta device:

old_forward = '''if clip_fea is not None and hasattr(self, "img_emb"):
            if self.offload_img_emb:
                self.img_emb.to(self.main_device)'''

new_forward = '''if clip_fea is not None and hasattr(self, "img_emb"):
            # Skip img_emb if weights not loaded (meta device = 14B distill has no img_emb)
            if next(self.img_emb.parameters()).device.type == 'meta':
                clip_fea = None
                log.info("Skipping img_emb - model has no clip image embedding weights (14B distill)")
            elif self.offload_img_emb:
                self.img_emb.to(self.main_device)'''

if old_forward in content:
    content = content.replace(old_forward, new_forward, 1)
    print('[FIX1] Added meta device skip for img_emb in forward method')
else:
    print('[FIX1] Target not found, searching...')
    # Try to find the line
    lines = content.splitlines()
    for i, line in enumerate(lines):
        if 'clip_fea is not None and hasattr' in line:
            print(f'  Found similar line at L{i+1}: {line.strip()[:80]}')

# Fix 2: Also need to handle the second img_emb call
old2 = '''clip_embed += self.img_emb(clip_fea_c.to(self.main_device))'''
new2 = '''if next(self.img_emb.parameters()).device.type != 'meta':
                    clip_embed += self.img_emb(clip_fea_c.to(self.main_device))'''

if old2 in content:
    content = content.replace(old2, new2, 1)
    print('[FIX2] Added meta device skip for second img_emb call')
else:
    print('[FIX2] Second target not found')

# Remove previous crude fix (self.img_emb = self.img_emb.to(self.main_device))
crude_fix = 'self.img_emb = self.img_emb.to(self.main_device)\n            clip_embed = self.img_emb(clip_fea.to(self.main_device))'
original = 'clip_embed = self.img_emb(clip_fea.to(self.main_device))'
if crude_fix in content:
    content = content.replace(crude_fix, original, 1)
    print('[CLEANUP] Removed crude img_emb.to() fix from first call')

crude_fix2 = 'self.img_emb = self.img_emb.to(self.main_device)\n                    clip_embed += self.img_emb(clip_fea_c.to(self.main_device))'
original2 = 'clip_embed += self.img_emb(clip_fea_c.to(self.main_device))'
if crude_fix2 in content:
    content = content.replace(crude_fix2, original2, 1)
    print('[CLEANUP] Removed crude img_emb.to() fix from second call')

open(MODEL_PY, 'w').write(content)

# Restart ComfyUI
print('[RESTART] Restarting ComfyUI...')
os.system('pkill -f "python main.py" 2>/dev/null')
time.sleep(3)
os.system('cd /root/autodl-tmp/ComfyUI && nohup /root/miniconda3/bin/python main.py --listen 0.0.0.0 --port 8188 > /tmp/comfyui_final.log 2>&1 &')
time.sleep(10)
import urllib.request
try:
    resp = urllib.request.urlopen('http://127.0.0.1:8188/system_stats')
    print('[RESTART] ComfyUI running!')
except:
    time.sleep(10)
    try:
        resp = urllib.request.urlopen('http://127.0.0.1:8188/system_stats')
        print('[RESTART] ComfyUI running!')
    except:
        print('[RESTART] Check manually')

print('[DONE] Final fix applied!')
