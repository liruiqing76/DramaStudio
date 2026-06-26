#!/usr/bin/env python3
"""从AutoDL服务器上用学术加速搜HuggingFace找Lightx2v LoRA"""
import urllib.request, json, sys

# 在AutoDL服务器上直接通过学术加速搜HuggingFace API
repos = [
    "Wan-AI/Lightx2v-I2V-14B-480P-cfg-step-distill",
    "Wan-AI/Lightx2v-I2V-14B-720P-cfg-step-distill",
    "Kijai/Wan2.2-workflows",
    "Kijai/Wan2.2-comfyui-workflows",
    "Kijai/Wan2.2-I2V-A14B-HighNoise-comfyui",
    "Kijai/Wan2.2-I2V-A14B-LowNoise-comfyui",
]

for repo in repos:
    url = f"https://huggingface.co/api/models/{repo}"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        resp = urllib.request.urlopen(req, timeout=15)
        data = json.loads(resp.read().decode())
        siblings = data.get('siblings', [])
        print(f"\n=== {repo} ===")
        for s in siblings:
            fn = s.get('rfilename', '')
            if fn.endswith('.safetensors') or fn.endswith('.gguf'):
                sz = s.get('size', 0)
                print(f"  {fn} ({sz/(1024**3):.2f}GB)")
    except Exception as e:
        print(f"  {repo}: {str(e)[:80]}")
