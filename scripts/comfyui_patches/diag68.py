import re, sys
NODES_PY = "/root/autodl-tmp/ComfyUI/custom_nodes/ComfyUI-WanVideoWrapper/nodes.py"
content = open(NODES_PY).read()
lines = content.splitlines()

print("=== latent_channels usage ===")
for i, line in enumerate(lines, 1):
    if "latent_channels" in line:
        print(f"  L{i}: {line.strip()}")

print("=== in_channels / patch_embed ===")
for i, line in enumerate(lines, 1):
    if "in_channels" in line or "patch_embed" in line:
        print(f"  L{i}: {line.strip()}")

print("=== WanVideoImageToVideoEncode class ===")
for i, line in enumerate(lines, 1):
    if "class WanVideoImageToVideoEncode" in line:
        for j in range(i-1, min(i+30, len(lines))):
            print(f"  L{j+1}: {lines[j]}")
        break

print("=== torch.cat near latent/model_input ===")
for i, line in enumerate(lines, 1):
    if "torch.cat" in line and ("latent" in line.lower() or "model_input" in line):
        print(f"  L{i}: {line.strip()}")

print("=== WanVideoSampler INPUT_TYPES ===")
for i, line in enumerate(lines, 1):
    if "class WanVideoSampler" in line:
        for j in range(i-1, min(i+25, len(lines))):
            print(f"  L{j+1}: {lines[j]}")
        break

print("=== WanVideoImageToVideoEncode RETURN_TYPES ===")
for i, line in enumerate(lines, 1):
    if "class WanVideoImageToVideoEncode" in line:
        for j in range(i-1, min(i+15, len(lines))):
            print(f"  L{j+1}: {lines[j]}")
        break
