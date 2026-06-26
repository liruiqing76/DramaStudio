#!/usr/bin/env python3
"""列出lightx2v/Wan2.2-Distill-Loras的文件"""
import sys
sys.path.insert(0, '/root/autodl-tmp/miniconda3/lib/python3.10/site-packages')
from huggingface_hub import list_repo_files

repos = [
    "lightx2v/Wan2.2-Distill-Loras",
    "lightx2v/Wan2.2-I2V-A14B-Moe-Distill-Lightx2v",
    "lightx2v/Wan2.1-Distill-Loras",
    "jayn7/WAN2.2-I2V_A14B-DISTILL-LIGHTX2V-4STEP-GGUF",
    "lgylgy/Wan21_I2V_14B_lightx2v_cfg_step_distill_lora_rank64",
]

for repo in repos:
    try:
        files = list_repo_files(repo)
        print(f"\n=== {repo} ===")
        for f in files:
            if f.endswith('.safetensors') or f.endswith('.gguf') or 'distill' in f.lower() or 'lora' in f.lower():
                print(f"  {f}")
    except Exception as e:
        err = str(e)[:150]
        print(f"  {repo}: {err}")
