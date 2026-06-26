#!/usr/bin/env python3
"""从ModelScope查找Lightx2v LoRA文件"""
import urllib.request, json

# ModelScope搜索lightx2v
search_url = "https://modelscope.cn/api/v1/models?Name=Lightx2v&page=1&limit=20"
try:
    resp = urllib.request.urlopen(search_url, timeout=15)
    data = json.loads(resp.read().decode())
    models = data.get('Data', [])
    for m in models:
        name = m.get('Name', '')
        path = m.get('Path', '')
        print(f"Model: {path}/{name}")
        # 获取文件列表
        api_url = f"https://modelscope.cn/api/v1/models/{path}/{name}"
        try:
            resp2 = urllib.request.urlopen(api_url, timeout=10)
            d2 = json.loads(resp2.read().decode())
            files = d2.get('Data', {}).get('ModelInfos', {}).get('safetensor', {}).get('files', [])
            for f in files:
                fn = f.get('name', '')
                sz = f.get('size', 0)
                if 'lora' in fn.lower() or 'distill' in fn.lower() or 'lightx2v' in fn.lower():
                    print(f"  FILE: {fn} ({sz/(1024**3):.2f}GB)")
        except Exception as e:
            print(f"  Detail error: {e}")
except Exception as e:
    print(f"Search error: {e}")

# 也直接尝试已知路径
known_paths = [
    "Wan-AI/Lightx2v-I2V-14B-480P-cfg-step-distill",
    "Wan-AI/Lightx2v-I2V-14B-720P-cfg-step-distill",
    "cityhill/Lightx2v-I2V-14B-480P-cfg-step-distill",
    "cityhill/lightx2v",
]
for p in known_paths:
    api_url = f"https://modelscope.cn/api/v1/models/{p}"
    try:
        resp = urllib.request.urlopen(api_url, timeout=10)
        d = json.loads(resp.read().decode())
        name = d.get('Data', {}).get('Name', '')
        files = d.get('Data', {}).get('ModelInfos', {}).get('safetensor', {}).get('files', [])
        print(f"\n=== {p} ({name}) ===")
        for f in files:
            fn = f.get('name', '')
            sz = f.get('size', 0)
            print(f"  {fn} ({sz/(1024**3):.2f}GB)")
    except Exception as e:
        print(f"  {p}: not found ({e})")
