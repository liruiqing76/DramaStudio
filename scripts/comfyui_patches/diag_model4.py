MODEL_PY = '/root/autodl-tmp/ComfyUI/custom_nodes/ComfyUI-WanVideoWrapper/wanvideo/modules/model.py'
lines = open(MODEL_PY).read().splitlines()

# Find where 'y' parameter is used in forward method
print('=== Where y is used in model.py ===')
for i, line in enumerate(lines):
    if 'self.y' in line or ('y' in line and ('cat' in line or 'patch_embedding' in line or 'x =' in line)):
        stripped = line.strip()
        if 'y' in stripped and len(stripped) < 200:
            print('L%d: %s' % (i+1, stripped))
