NODES_PY = '/root/autodl-tmp/ComfyUI/custom_nodes/ComfyUI-WanVideoWrapper/nodes.py'
lines = open(NODES_PY).read().splitlines()

# WanVideoImageToVideoEncode - the full encode method
# L985 starts the class, find the encode method
print('=== WanVideoImageToVideoEncode encode method ===')
for i in range(984, 1175):
    line = lines[i]
    # Only print key lines (not whitespace, not comments only)
    if line.strip() and not line.strip().startswith('#') and ('y' in line or 'image_embeds' in line or 'cat' in line or 'latent' in line or 'mask' in line or 'def' in line or 'return' in line or 'vae' in line or 'clip' in line):
        print('L%d: %s' % (i+1, line.strip()))
