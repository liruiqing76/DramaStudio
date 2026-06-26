MODEL_PY = "/root/autodl-tmp/ComfyUI/custom_nodes/ComfyUI-WanVideoWrapper/wanvideo/modules/model.py"
lines = open(MODEL_PY).read().splitlines()

# Current broken logic:
# L2823: if clip_fea is not None and hasattr(self, "img_emb"):
# L2825:     if next(self.img_emb.parameters()).device.type == 'meta':
# L2826:         clip_fea = None          ← sets clip_fea to None
# L2827:         log.info(...)
# L2828:     elif self.offload_img_emb:
# L2829:         self.img_emb.to(self.main_device)
# L2830:     clip_embed = self.img_emb(clip_fea.to(self.main_device))  ← STILL RUNS even when clip_fea=None!

# Fix: Replace the entire block (L2823-L2838) with correct logic
# When img_emb is on meta device, skip ALL img_emb calls

old_block = [
    '        if clip_fea is not None and hasattr(self, "img_emb"):',
    '            # Skip img_emb if weights not loaded (meta device = 14B distill has no img_emb)',
    '            if next(self.img_emb.parameters()).device.type == \'meta\':',
    '                clip_fea = None',
    '                log.info("Skipping img_emb - model has no clip image embedding weights (14B distill)")',
    '            elif self.offload_img_emb:',
    '                self.img_emb.to(self.main_device)',
    '            clip_embed = self.img_emb(clip_fea.to(self.main_device))  # bs x 257 x dim',
    '            if sdancer_input is not None:',
    '                clip_fea_c = sdancer_input.get("clip_fea_c", None)',
    '                if clip_fea_c is not None:',
    '                    self.img_emb = self.img_emb.to(self.main_device)',
    '                    if next(self.img_emb.parameters()).device.type != \'meta\':',
    '                        clip_embed += self.img_emb(clip_fea_c.to(self.main_device))',
    '            if self.offload_img_emb:',
    '                self.img_emb.to(self.offload_device, non_blocking=self.use_non_blocking)',
]

new_block = [
    '        if clip_fea is not None and hasattr(self, "img_emb"):',
    '            # 14B distill models have no img_emb weights (on meta device) - skip entirely',
    '            if next(self.img_emb.parameters()).device.type != \'meta\':',
    '                if self.offload_img_emb:',
    '                    self.img_emb.to(self.main_device)',
    '                clip_embed = self.img_emb(clip_fea.to(self.main_device))  # bs x 257 x dim',
    '                if sdancer_input is not None:',
    '                    clip_fea_c = sdancer_input.get("clip_fea_c", None)',
    '                    if clip_fea_c is not None:',
    '                        self.img_emb = self.img_emb.to(self.main_device)',
    '                        clip_embed += self.img_emb(clip_fea_c.to(self.main_device))',
    '                if self.offload_img_emb:',
    '                    self.img_emb.to(self.offload_device, non_blocking=self.use_non_blocking)',
    '            else:',
    '                log.info("Skipping img_emb - model has no clip image embedding weights (14B distill)")',
    '                clip_fea = None',
]

# Find and replace the block
content = "\n".join(lines)
old_str = "\n".join(old_block)
new_str = "\n".join(new_block)

if old_str in content:
    content = content.replace(old_str, new_str, 1)
    print("Block replaced successfully!")
else:
    print("ERROR: old block not found!")
    # Debug: show what's actually in the file
    idx = None
    for i, line in enumerate(lines):
        if 'clip_fea is not None and hasattr(self, "img_emb")' in line:
            idx = i
            break
    if idx:
        for j in range(idx, min(idx+16, len(lines))):
            print(f"  L{j+1}: {lines[j][:80]}")

open(MODEL_PY, "w").write(content)

import ast
try:
    ast.parse(content)
    print("Syntax OK!")
except SyntaxError as e:
    print(f"Syntax ERROR: L{e.lineno}: {e.msg}")

# Restart ComfyUI
import os, time, urllib.request
os.system("pkill -f 'python main.py' 2>/dev/null")
time.sleep(3)
os.system("cd /root/autodl-tmp/ComfyUI && nohup /root/miniconda3/bin/python main.py --listen 0.0.0.0 --port 8188 > /tmp/comfyui_fix3.log 2>&1 &")
time.sleep(15)
resp = urllib.request.urlopen("http://127.0.0.1:8188/object_info/WanVideoModelLoader")
print("WanVideoWrapper loaded - ready to test!")
