NODES_PY = '/root/autodl-tmp/ComfyUI/custom_nodes/ComfyUI-WanVideoWrapper/nodes_sampler.py'
lines = open(NODES_PY).read().splitlines()

# L1241 onwards - image_cond construction
print('=== L1241-1260 (image_cond path) ===')
for i in range(1240, 1260):
    print('L%d: %s' % (i+1, lines[i]))

print()
print('=== Where image_cond is set from image_embeds ===')
for i, line in enumerate(lines):
    if 'image_cond' in line and ('image_embeds' in line or 'mask' in line):
        print('L%d: %s' % (i+1, line.strip()))

print()
print('=== L1090-1120 (noise + image_cond concatenation) ===')
for i in range(1089, 1120):
    print('L%d: %s' % (i+1, lines[i]))
