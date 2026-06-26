#!/usr/bin/env python3
"""Download the REAL wan2.1 14B I2V fp8 model (in_channels=48) from city96 HF"""
import subprocess, os, sys

os.system("source /etc/network_turbo")

# city96/wan2.1-I2V-14B-720P-fp8 has the real 14B model
# URL: https://huggingface.co/city96/wan2.1-I2V-14B-720P-fp8
target_dir = "/root/autodl-tmp/comfyui_models/diffusion_models/wan_fp8_scaled/I2V"

# First check what files are in the repo
result = subprocess.run(["python3", "-m", "huggingface_hub.commands.huggingface_cli", "scan-cache"], capture_output=True, text=True)
print(f"Cache: {result.stdout[:200]}")

# Download the correct file - wan2.1_i2v_480p_720p_14B_fp8_e4m3fn.safetensors from the REAL 14B repo
# The current one is 5B (36 channels), we need the 48-channel version
# Try downloading from city96/wan2.1-I2V-14B-720P-fp8
from huggingface_hub import hf_hub_download

print("Downloading REAL 14B I2V fp8 model from city96...")
try:
    path = hf_hub_download(
        repo_id="city96/wan2.1-I2V-14B-720P-fp8",
        filename="wan2.1_i2v_480p_720p_14B_fp8_e4m3fn.safetensors",
        local_dir=target_dir
    )
    print(f"Downloaded to: {path}")
except Exception as e:
    print(f"Error: {e}")
    # Try listing repo files first
    from huggingface_hub import list_repo_files
    files = list_repo_files("city96/wan2.1-I2V-14B-720P-fp8")
    print(f"Repo files: {files}")
