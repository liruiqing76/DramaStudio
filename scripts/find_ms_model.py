#!/usr/bin/env python3
"""查找ModelScope上Wan2.1 FP16模型的正确下载URL"""
import urllib.request, json

# 尝试不同的模型路径
paths = [
    "Wan-AI/Wan2.1-I2V-14B-720P",
    "Wan-AI/Wan2.1-I2V-14B-480P-720P",
    "Wan2.1/Wan2.1-I2V-14B-720P",
]

for path in paths:
    url = f"https://modelscope.cn/api/v1/models/{path}/repo?revision=master"
    print(f"\nTrying: {url}")
    try:
        resp = urllib.request.urlopen(url, timeout=15)
        data = json.loads(resp.read().decode())
        files = data.get("Data", {}).get("Files", [])
        for f in files:
            name = f.get("Name", "")
            size = f.get("Size", 0)
            if name.endswith(".safetensors") and "fp16" in name.lower() or (name.endswith(".safetensors") and "14B" in name and size > 20_000_000_000):
                print(f"  MATCH: {name} ({size/1e9:.1f}GB)")
                # 构建下载URL
                dl_url = f"https://modelscope.cn/models/{path}/resolve/master/{name}"
                print(f"  Download URL: {dl_url}")
    except Exception as e:
        print(f"  Error: {e}")
