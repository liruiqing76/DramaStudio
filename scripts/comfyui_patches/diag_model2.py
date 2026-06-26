MODEL_PY = '/root/autodl-tmp/ComfyUI/custom_nodes/ComfyUI-WanVideoWrapper/wanvideo/modules/model.py'
lines = open(MODEL_PY).read().splitlines()

# L2460-2475 context around the cat line
print('=== L2455-2475 (x construction area) ===')
for i in range(2454, 2475):
    print('L%d: %s' % (i+1, lines[i]))

print()
# Also check L1620-1630 where clip_extra_context_tokens is set
print('=== L1620-1635 (clip proj) ===')
for i in range(1619, 1635):
    print('L%d: %s' % (i+1, lines[i]))

print()
# Check self.original_patch_embedding creation
print('=== patch_embedding creation ===')
for i, line in enumerate(lines):
    if 'original_patch_embedding' in line and ('=' in line or 'Conv3d' in line):
        print('L%d: %s' % (i+1, line.strip()))
