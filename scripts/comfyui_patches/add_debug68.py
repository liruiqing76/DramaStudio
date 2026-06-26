# Add debug logging to nodes_sampler.py to trace 68ch bug
# Patch L228 and L2450 areas to print shapes

PATCH1 = '''
# After L228: image_cond = image_embeds.get("image_embeds", None)
# Add: log.info(f"DEBUG: image_embeds keys={list(image_embeds.keys())}")
# Add: log.info(f"DEBUG: image_cond shape={image_cond.shape if image_cond is not None else None}")
'''

PATCH2 = '''
# After L240-241: image_cond = torch.cat([image_cond_mask, image_cond])
# Add: log.info(f"DEBUG: after mask concat, image_cond shape={image_cond.shape}")
# Add: log.info(f"DEBUG: image_cond_mask shape={image_cond_mask.shape if image_cond_mask is not None else None}")
'''

# Write the actual patch script
NODES_PY = '/root/autodl-tmp/ComfyUI/custom_nodes/ComfyUI-WanVideoWrapper/nodes_sampler.py'
content = open(NODES_PY).read()

# Find and replace key lines
import sys

# Patch 1: After L228
old = '        image_cond = image_embeds.get("image_embeds", None)\n        image_cond_mask = None'
new = '        image_cond = image_embeds.get("image_embeds", None)\n        log.info(f"DEBUG68: image_embeds keys={list(image_embeds.keys())}")\n        log.info(f"DEBUG68: image_cond shape={image_cond.shape if image_cond is not None else None}")\n        image_cond_mask = None'
if old not in content:
    print("ERROR: Patch1 target not found!")
    sys.exit(1)
content = content.replace(old, new, 1)

# Patch 2: After L240-241
old2 = '            if image_cond_mask is not None:\n                image_cond = torch.cat([image_cond_mask, image_cond])\n            else:\n                image_cond[:, 1:] = 0'
new2 = '            if image_cond_mask is not None:\n                image_cond = torch.cat([image_cond_mask, image_cond])\n                log.info(f"DEBUG68: after mask concat, image_cond shape={image_cond.shape}, mask shape={image_cond_mask.shape}")\n            else:\n                image_cond[:, 1:] = 0\n                log.info(f"DEBUG68: no mask, image_cond shape={image_cond.shape}")'
if old2 not in content:
    print("ERROR: Patch2 target not found!")
    sys.exit(1)
content = content.replace(old2, new2, 1)

# Patch 3: In model.py L2450 area
MODEL_PY = '/root/autodl-tmp/ComfyUI/custom_nodes/ComfyUI-WanVideoWrapper/wanvideo/modules/model.py'
mcontent = open(MODEL_PY).read()

old3 = '            x = [torch.cat([u, v], dim=0) for u, v in zip(x, y)]'
new3 = '            x_shapes = [u.shape for u in x]\n            y_shapes = [v.shape for v in y]\n            log.info(f"DEBUG68 model: x shapes={x_shapes}, y shapes={y_shapes}")\n            x = [torch.cat([u, v], dim=0) for u, v in zip(x, y)]\n            log.info(f"DEBUG68 model: after cat, x shapes={[u.shape for u in x]}")'
if old3 not in mcontent:
    print("ERROR: Patch3 target not found!")
    sys.exit(1)
mcontent = mcontent.replace(old3, new3, 1)

# Write patched files
open(NODES_PY, 'w').write(content)
open(MODEL_PY, 'w').write(mcontent)

print("Patched both files with debug logging!")
print("Need to restart ComfyUI to apply patches")
