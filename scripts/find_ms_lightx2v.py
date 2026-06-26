#!/usr/bin/env python3
"""在ModelScope搜索Lightx2v distill LoRA"""
import urllib.request, json

# 搜索ModelScope
search_urls = [
    "https://modelscope.cn/api/v1/models?Search=lightx2v+distill&PageSize=20",
    "https://modelscope.cn/api/v1/models?Search=lightx2v&PageSize=20",
    "https://modelscope.cn/api/v1/models?Search=Wan2.2+LoRA&PageSize=20",
]

for url in search_urls:
    try:
        resp = urllib.request.urlopen(url, timeout=15)
        data = json.loads(resp.read().decode())
        models = data.get('Data', {}).get('Models', data.get('Data', []))
        if isinstance(models, list):
            for m in models:
                name = m.get('Name', '')
                path = m.get('Path', '')
                full = f"{path}/{name}" if path else name
                print(f"  {full}")
        else:
            print(f"  response: {json.dumps(data)[:200]}")
    except Exception as e:
        print(f"  Error: {e}")

# 直接查cityhill（常见的模型搬运者）
for repo_path in [
    "cityhill/lightx2v-I2V-14B-480P-cfg-step-distill",
    "cityhill/Wan2.2-Lightx2v",
    "cityhill/lightx2v",
    "Kijai/Lightx2v-I2V-14B-480P-cfg-step-distill",
]:
    url = f"https://modelscope.cn/api/v1/models/{repo_path}"
    try:
        resp = urllib.request.urlopen(url, timeout=10)
        d = json.loads(resp.read().decode())
        name = d.get('Data', {}).get('Name', '')
        files = d.get('Data', {}).get('ModelInfos', {}).get('safetensor', {}).get('files', [])
        print(f"\n=== {repo_path} ({name}) ===")
        for f in files:
            fn = f.get('name', '')
            sz = f.get('size', 0)
            print(f"  {fn} ({sz/(1024**3):.2f}GB)")
    except Exception as e:
        pass
