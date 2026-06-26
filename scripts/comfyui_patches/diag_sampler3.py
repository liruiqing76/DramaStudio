NODES_PY = '/root/autodl-tmp/ComfyUI/custom_nodes/ComfyUI-WanVideoWrapper/nodes_sampler.py'
lines = open(NODES_PY).read().splitlines()

# Find where image_cond is passed to transformer/predict_with_cfg
print('=== transformer call with image_cond ===')
for i, line in enumerate(lines):
    if 'transformer' in line and 'image_cond' in line:
        print('L%d: %s' % (i+1, line.strip()))

print()
print('=== predict_with_cfg call with image_cond ===')
for i, line in enumerate(lines):
    if 'predict_with_cfg' in line and 'image_cond' in line:
        print('L%d: %s' % (i+1, line.strip()))

print()
print('=== Where x/z is constructed before model forward ===')
for i, line in enumerate(lines):
    if ('x =' in line or 'z =' in line) and ('cat' in line or 'image_embeds' in line or 'image_cond' in line):
        print('L%d: %s' % (i+1, line.strip()))

print()
# L230-260 area where image_cond is built
print('=== L226-250 (image_cond construction from image_embeds) ===')
for i in range(225, 250):
    print('L%d: %s' % (i+1, lines[i]))
