MODEL_PY = '/root/autodl-tmp/ComfyUI/custom_nodes/ComfyUI-WanVideoWrapper/wanvideo/modules/model.py'
lines = open(MODEL_PY).read().splitlines()

# Find forward method signature
print('=== model.py forward signature ===')
for i, line in enumerate(lines):
    if 'def forward(self' in line:
        print('L%d: %s' % (i+1, line.strip()))
        # Print next 10 lines
        for j in range(i+1, min(i+10, len(lines))):
            print('L%d: %s' % (j+1, lines[j].strip()))
        print('---')

print()
# Find where image_cond is used in forward
print('=== image_cond in model.py forward ===')
for i, line in enumerate(lines):
    if 'image_cond' in line:
        print('L%d: %s' % (i+1, line.strip()))
