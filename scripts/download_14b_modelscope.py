#!/usr/bin/env python3
"""Download REAL wan2.1 14B I2V fp8 model from ModelScope (魔塔社区)"""
import subprocess, os, sys

# Use ModelScope mirror instead of HuggingFace
os.environ["MODELSCOPE_CACHE"] = "/root/autodl-tmp/modelscope_cache"

# First check if modelscope is installed
result = subprocess.run(["pip", "list"], capture_output=True, text=True)
if "modelscope" not in result.stdout:
    print("Installing modelscope...")
    subprocess.run(["pip", "install", "modelscope"], check=True)

from modelscope import snapshot_download

# Search for wan2.1 I2V 14B fp8 on ModelScope
# The repo should be something like: AI-ModelScope/wan2.1-I2V-14B-720P
# or we need to find the exact repo name

# Try downloading - first list what's available
print("Searching ModelScope for wan2.1 I2V 14B fp8...")

# ModelScope repo for wan2.1 I2V 14B
repo_id = "AI-ModelScope/Wan2.1-I2V-14B-720P"

try:
    # Download only the diffusion model weights
    local_dir = snapshot_download(
        repo_id,
        local_dir="/root/autodl-tmp/comfyui_models/diffusion_models/wan_fp8_scaled/I2V_real14b",
        allow_patterns=["*.safetensors"]
    )
    print(f"Downloaded to: {local_dir}")
    
    # List downloaded files
    for f in os.listdir(local_dir):
        fpath = os.path.join(local_dir, f)
        if os.path.isfile(fpath):
            size_gb = os.path.getsize(fpath) / (1024**3)
            print(f"  {f}: {size_gb:.2f} GB")
except Exception as e:
    print(f"Error with AI-ModelScope repo: {e}")
    # Try alternative repo names
    alt_repos = [
        "Wan2.1/Wan2.1-I2V-14B-720P",
        "wan-community/Wan2.1-I2V-14B-720P",
    ]
    for alt_repo in alt_repos:
        try:
            print(f"Trying {alt_repo}...")
            local_dir = snapshot_download(
                alt_repo,
                local_dir="/root/autodl-tmp/comfyui_models/diffusion_models/wan_fp8_scaled/I2V_real14b",
                allow_patterns=["*.safetensors"]
            )
            print(f"Downloaded to: {local_dir}")
            for f in os.listdir(local_dir):
                fpath = os.path.join(local_dir, f)
                if os.path.isfile(fpath):
                    size_gb = os.path.getsize(fpath) / (1024**3)
                    print(f"  {f}: {size_gb:.2f} GB")
            break
        except Exception as e2:
            print(f"  Failed: {e2}")
