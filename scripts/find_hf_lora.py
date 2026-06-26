#!/usr/bin/env python3
"""在AutoDL服务器上用huggingface_hub搜Lightx2v LoRA repo"""
import sys
sys.path.insert(0, '/root/autodl-tmp/miniconda3/lib/python3.10/site-packages')
from huggingface_hub import list_repo_files, HfApi

api = HfApi()

repos = [
    "Wan-AI/Lightx2v-I2V-14B-480P-cfg-step-distill",
    "Wan-AI/Lightx2v-I2V-14B-720P-cfg-step-distill",
    "Kijai/Wan2.2-I2V-A14B-HighNoise-comfyui",
    "Kijai/Wan2.2-I2V-A14B-LowNoise-comfyui",
    "cityhill/lightx2v-I2V-14B-480P-cfg-step-distill",
    "cityhill/Lightx2v-I2V-14B",
]

for repo in repos:
    try:
        files = list_repo_files(repo)
        print(f"\n=== {repo} ===")
        for f in files:
            if f.endswith('.safetensors') or f.endswith('.gguf'):
                print(f"  {f}")
    except Exception as e:
        err = str(e)[:100]
        print(f"  {repo}: {err}")

# 也搜search API
print("\n=== HuggingFace Search ===")
try:
    results = api.list_models(search="lightx2v distill", limit=10)
    for m in results:
        print(f"  {m.id}")
except Exception as e:
    print(f"  Search error: {e}")
