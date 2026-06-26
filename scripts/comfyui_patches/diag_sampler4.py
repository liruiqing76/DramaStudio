NODES_PY = '/root/autodl-tmp/ComfyUI/custom_nodes/ComfyUI-WanVideoWrapper/nodes_sampler.py'
lines = open(NODES_PY).read().splitlines()

# Find where predict_with_cfg calls transformer forward
print('=== transformer() calls in predict_with_cfg ===')
for i, line in enumerate(lines):
    if i >= 1171 and 'transformer(' in line:
        for j in range(i-2, min(i+15, len(lines))):
            print('L%d: %s' % (j+1, lines[j]))
        print('---')

print()
# Also find where x/z is set with image_cond before predict_with_cfg
print('=== z/x construction near predict_with_cfg ===')
for i, line in enumerate(lines):
    if 'noise_pred' in line and 'transformer(' in lines[min(i+5, len(lines)-1)]:
        for j in range(max(i-5,0), min(i+10, len(lines))):
            print('L%d: %s' % (j+1, lines[j]))
        print('---')
