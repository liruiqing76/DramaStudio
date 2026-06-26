#!/usr/bin/env python3
"""从HuggingFace下载Lightx2v蒸馏LoRA文件到AutoDL服务器"""
import urllib.request, json, sys, subprocess

# 先从HuggingFace API查找正确的repo和文件
repos_to_try = [
    "Wan-AI/Lightx2v-I2V-14B-480P-cfg-step-distill",
    "Wan-AI/Lightx2v-I2V-14B-720P-cfg-step-distill",
    "Wan-AI/Wan2.2-I2V-A14B-720P",
    "Kijai/Wan2.2-I2V-A14B-HighNoise-comfyui",
    "cityhill/Lightx2v-I2V-14B-480P-cfg-step-distill",
    "cityhill/lightx2v",
]

for repo in repos_to_try:
    url = f"https://huggingface.co/api/models/{repo}"
    try:
        resp = urllib.request.urlopen(url, timeout=10)
        data = json.loads(resp.read().decode())
        siblings = data.get('siblings', [])
        print(f"\n=== {repo} ===")
        for s in siblings:
            fn = s.get('rfilename', '')
            if 'lora' in fn.lower() or 'distill' in fn.lower() or 'lightx2v' in fn.lower() or fn.endswith('.safetensors'):
                size = s.get('size', 0)
                print(f"  {fn}  ({size/(1024**3):.2f}GB)")
    except Exception as e:
        print(f"  {repo}: {e}")
