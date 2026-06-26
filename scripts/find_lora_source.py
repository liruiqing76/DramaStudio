#!/usr/bin/env python3
"""从GitHub/ComfyUI管理器找Lightx2v蒸馏LoRA的下载源"""
import urllib.request, json

# WanVideoWrapper的LoRA配置 - 从custom_nodes源码找
# 先从ComfyUI Registry API搜
urls = [
    "https://registry.comfyui.org/api/v1/nodes/search?query=lightx2v",
    "https://registry.comfyui.org/api/v1/nodes/search?query=WanVideoLora",
]

for url in urls:
    try:
        resp = urllib.request.urlopen(url, timeout=15)
        data = json.loads(resp.read().decode())
        print(f"=== {url} ===")
        if isinstance(data, list):
            for item in data[:5]:
                print(f"  {item.get('name','')}: {item.get('description','')[:100]}")
        else:
            print(f"  {json.dumps(data)[:200]}")
    except Exception as e:
        print(f"  Error: {e}")

# 从GitHub搜Lightx2v
github_search = "https://api.github.com/search/repositories?q=lightx2v+wan2.2&sort=stars"
try:
    resp = urllib.request.urlopen(github_search, timeout=15)
    data = json.loads(resp.read().decode())
    items = data.get('items', [])[:5]
    print(f"\n=== GitHub lightx2v repos ===")
    for item in items:
        print(f"  {item['full_name']} (★{item['stargazers_count']}) - {item['html_url']}")
except Exception as e:
    print(f"  Error: {e}")

# 直接搜HuggingFace - Lightx2v组织
hf_orgs = ["Wan-AI", "Kijai", "cityhill", "Lightx2v"]
for org in hf_orgs:
    url = f"https://huggingface.co/api/models?author={org}&search=lightx2v&limit=10"
    try:
        resp = urllib.request.urlopen(url, timeout=10)
        data = json.loads(resp.read().decode())
        for m in data:
            mid = m.get('id', '')
            if 'lightx2v' in mid.lower() or 'distill' in mid.lower():
                print(f"  HF: {mid}")
    except Exception as e:
        pass  # timeout expected for HF
