#!/usr/bin/env python3
"""查询ComfyUI中CLIP相关的加载节点"""
import json, urllib.request

resp = urllib.request.urlopen("http://127.0.0.1:8189/object_info", timeout=15)
d = json.loads(resp.read().decode())

# 找CLIP相关节点
clip_nodes = sorted([k for k in d.keys() if "clip" in k.lower() and ("load" in k.lower() or "vision" in k.lower())])
print("CLIP Load/Vision节点:")
for k in clip_nodes:
    info = d[k]
    inputs = info.get("input", {}).get("required", {})
    print(f"  {k} → required: {list(inputs.keys())}")
    for inp_name, inp_config in inputs.items():
        if isinstance(inp_config, list) and len(inp_config) >= 1:
            choices = inp_config[0] if isinstance(inp_config[0], list) else inp_config[0]
            if isinstance(choices, list) and len(choices) > 0:
                print(f"    {inp_name}: choices[:5] = {choices[:5]}")
