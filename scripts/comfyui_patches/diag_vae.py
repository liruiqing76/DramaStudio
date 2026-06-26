import os
VAE_PY = '/root/autodl-tmp/ComfyUI/comfy/vae.py'
content = open(VAE_PY).read()
lines = content.splitlines()
for i, line in enumerate(lines):
    if 'latent_channels' in line or 'WanVAE' in line:
        print(f'comfy/vae L{i+1}: {line.strip()}')

print()
# WanVideoWrapper VAE
VAE2 = '/root/autodl-tmp/ComfyUI/custom_nodes/ComfyUI-WanVideoWrapper/wanvideo/vae.py'
if os.path.exists(VAE2):
    content2 = open(VAE2).read()
    lines2 = content2.splitlines()
    for i, line in enumerate(lines2):
        if 'latent_channels' in line or ('48' in line and 'ch' in line.lower()):
            print(f'wrapper/vae L{i+1}: {line.strip()}')
