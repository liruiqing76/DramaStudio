#!/usr/bin/env python3
"""搜HuggingFace上KJNodes的镜像"""
import sys
sys.path.insert(0, '/root/autodl-tmp/miniconda3/lib/python3.10/site-packages')
from huggingface_hub import HfApi

api = HfApi()
results = api.list_models(search="ComfyUI-KJNodes", limit=10)
for m in results:
    print(f"  {m.id}")
    
# 也搜comfyui节点集合
results2 = api.list_models(search="comfyui custom nodes kijai", limit=10)
for m in results2:
    print(f"  {m.id}")
