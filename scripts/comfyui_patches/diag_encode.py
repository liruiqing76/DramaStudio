NODES_PY = '/root/autodl-tmp/ComfyUI/custom_nodes/ComfyUI-WanVideoWrapper/nodes.py'
lines = open(NODES_PY).read().splitlines()

# Find WanVideoImageToVideoEncode class
print('=== WanVideoImageToVideoEncode class ===')
found = False
for i, line in enumerate(lines):
    if 'class WanVideoImageToVideoEncode' in line and not found:
        found = True
        # Print up to 200 lines or until next class
        for j in range(i, min(i+200, len(lines))):
            if j > i+5 and line.startswith('class ') and 'WanVideoImageToVideoEncode' not in lines[j]:
                break
            print('L%d: %s' % (j+1, lines[j]))
        break

print()
# Also search for how image_embeds dict is constructed  
print('=== image_embeds dict construction ===')
for i, line in enumerate(lines):
    if 'image_embeds' in line and ('dict' in line or '{' in line or 'return' in line):
        for j in range(max(i-2,0), min(i+5, len(lines))):
            print('L%d: %s' % (j+1, lines[j]))
        print('---')
