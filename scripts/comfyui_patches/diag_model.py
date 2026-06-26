MODEL_PY = '/root/autodl-tmp/ComfyUI/custom_nodes/ComfyUI-WanVideoWrapper/wanvideo/modules/model.py'
lines = open(MODEL_PY).read().splitlines()

# Find the forward method and how it constructs x from image_cond
print('=== model.py forward method entry ===')
for i, line in enumerate(lines):
    if 'def forward(self' in line and 'x' in line:
        for j in range(i, min(i+20, len(lines))):
            print('L%d: %s' % (j+1, lines[j]))
        break

print()
print('=== Where x is constructed with image_cond/image_embeds ===')
for i, line in enumerate(lines):
    if 'x' in line and ('image_cond' in line or 'image_embeds' in line):
        print('L%d: %s' % (i+1, line.strip()))

print()
print('=== L2525-2530 (patch_embedding call) ===')
for i in range(2524, 2530):
    print('L%d: %s' % (i+1, lines[i]))
