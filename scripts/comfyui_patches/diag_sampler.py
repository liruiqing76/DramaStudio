NODES_PY = '/root/autodl-tmp/ComfyUI/custom_nodes/ComfyUI-WanVideoWrapper/nodes_sampler.py'
lines = open(NODES_PY).read().splitlines()

print('=== predict_with_cfg function ===')
found = False
for i, line in enumerate(lines):
    if 'def predict_with_cfg' in line and not found:
        found = True
        for j in range(i, min(i+70, len(lines))):
            print('L%d: %s' % (j+1, lines[j]))
        break

print()
print('=== image_embeds cat ===')
for i, line in enumerate(lines):
    if 'image_embeds' in line and 'cat' in line:
        for j in range(max(i-3,0), min(i+3, len(lines))):
            print('L%d: %s' % (j+1, lines[j]))
        print()

print()
print('=== L2520-2535 (patch_embedding area) ===')
for i in range(2519, 2535):
    print('L%d: %s' % (i+1, lines[i]))
