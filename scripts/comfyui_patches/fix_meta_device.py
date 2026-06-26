"""Fix meta device bug: img_emb weights stay on 'meta' device after fp8 model loading.
Patch: force img_emb.to(main_device) before calling it in forward()."""
import re

MODEL_PY = '/root/autodl-tmp/ComfyUI/custom_nodes/ComfyUI-WanVideoWrapper/wanvideo/modules/model.py'
content = open(MODEL_PY).read()

# The bug line is: clip_embed = self.img_emb(clip_fea.to(self.main_device))
# Fix: add self.img_emb = self.img_emb.to(self.main_device) before it

old = 'clip_embed = self.img_emb(clip_fea.to(self.main_device))  # bs x 257 x dim'
new = 'self.img_emb = self.img_emb.to(self.main_device)\n            clip_embed = self.img_emb(clip_fea.to(self.main_device))  # bs x 257 x dim'

if old not in content:
    print("ERROR: target line not found! Searching alternatives...")
    # Try without comment
    old2 = 'clip_embed = self.img_emb(clip_fea.to(self.main_device))'
    if old2 in content:
        new2 = 'self.img_emb = self.img_emb.to(self.main_device)\n            clip_embed = self.img_emb(clip_fea.to(self.main_device))'
        content = content.replace(old2, new2, 1)
        print(f"Fixed (no-comment variant) at position {content.find(new2)}")
    else:
        # Try with different spacing
        for variant in [
            '            clip_embed = self.img_emb(clip_fea.to(self.main_device))',
            '        clip_embed = self.img_emb(clip_fea.to(self.main_device))',
        ]:
            if variant in content:
                indent = variant[:variant.index('clip_embed')]
                fix = f'{indent}self.img_emb = self.img_emb.to(self.main_device)\n{variant}'
                content = content.replace(variant, fix, 1)
                print(f"Fixed (indent variant) at position {content.find(fix)}")
                break
        else:
            print("FATAL: Cannot find img_emb call line!")
            # Print all lines containing img_emb for diagnosis
            lines = content.splitlines()
            for i, line in enumerate(lines):
                if 'img_emb' in line and 'self.img_emb' in line and 'clip_fea' not in line:
                    print(f"  L{i+1}: {line.strip()}")
            import sys; sys.exit(1)
else:
    content = content.replace(old, new, 1)
    print(f"Fixed at position {content.find(new)}")

# Also fix the second img_emb call (conditional branch)
old3 = '                    clip_embed += self.img_emb(clip_fea_c.to(self.main_device))'
if old3 in content:
    new3 = '                    self.img_emb = self.img_emb.to(self.main_device)\n                    clip_embed += self.img_emb(clip_fea_c.to(self.main_device))'
    content = content.replace(old3, new3, 1)
    print("Also fixed second img_emb call")

open(MODEL_PY, 'w').write(content)
print("meta device fix applied! Restart ComfyUI to take effect.")
