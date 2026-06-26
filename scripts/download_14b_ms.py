#!/usr/bin/env python3
"""Download REAL wan2.1 14B I2V bf16 model from ModelScope (魔塔社区)
Then we can convert fp8 ourselves, or just use bf16 directly (32G VRAM enough for bf16 14B I2V)
"""
import os, sys, subprocess

pip_path = "/root/autodl-tmp/miniconda3/bin/pip"
python_path = "/root/autodl-tmp/miniconda3/bin/python"

# Check modelscope
result = subprocess.run([pip_path, "list"], capture_output=True, text=True)
if "modelscope" not in result.stdout:
    print("Installing modelscope...")
    subprocess.run([pip_path, "install", "modelscope", "-q"], check=True)

# Now download
# We need the REAL 14B I2V model (in_channels=48)
# The bf16 version is about 28GB, too big for download
# Let's search for fp8 quantized version on ModelScope
from modelscope.hub.api import HubApi
api = HubApi()

# Search for wan2.1 I2V 14B
print("Searching ModelScope for wan2.1 I2V 14B...")
results = api.list_models(filter="wan2.1-I2V-14B")
for r in results:
    print(f"  Found: {r.name}")

# Try known repos
repos_to_try = [
    "AI-ModelScope/Wan2.1-I2V-14B-720P",
]

target_dir = "/root/autodl-tmp/comfyui_models/diffusion_models/wan_fp8_scaled/I2V_real14b"

from modelscope import snapshot_download
for repo_id in repos_to_try:
    try:
        print(f"Downloading from {repo_id}...")
        local_dir = snapshot_download(
            repo_id,
            local_dir=target_dir,
            # Only download diffusion model weights (not T5, CLIP etc)
            allow_patterns=["*.safetensors", "*.pth", "*.bin"]
        )
        print(f"Downloaded to: {local_dir}")
        
        # List files
        for f in sorted(os.listdir(local_dir)):
            fpath = os.path.join(local_dir, f)
            if os.path.isfile(fpath):
                size_gb = os.path.getsize(fpath) / (1024**3)
                print(f"  {f}: {size_gb:.2f} GB")
        break
    except Exception as e:
        print(f"  Failed: {e}")
