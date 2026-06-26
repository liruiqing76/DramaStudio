NODES_PY = '/root/autodl-tmp/ComfyUI/custom_nodes/ComfyUI-WanVideoWrapper/nodes_sampler.py'
lines = open(NODES_PY).read().splitlines()

# L1185-1210 - where z is constructed with image_cond_input
print('=== L1185-1210 (z + image_cond_input) ===')
for i in range(1184, 1210):
    print('L%d: %s' % (i+1, lines[i]))

print()
# Also L1230-1260 - where z goes into predict_with_cfg
print('=== L1228-1260 (z before predict) ===')
for i in range(1227, 1260):
    print('L%d: %s' % (i+1, lines[i]))

print()
# L2440-2460 in model.py - where x and y are combined before patch_embedding
print('=== model.py L2445-2460 ===')
MODEL_PY = '/root/autodl-tmp/ComfyUI/custom_nodes/ComfyUI-WanVideoWrapper/wanvideo/modules/model.py'
mlines = open(MODEL_PY).read().splitlines()
for i in range(2444, 2460):
    print('L%d: %s' % (i+1, mlines[i]))
