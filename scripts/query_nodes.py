#!/usr/bin/env python3
"""查询ComfyUI可用的WanVideo节点和LoRA/TextEncode相关节点"""
import json, urllib.request

resp = urllib.request.urlopen("http://127.0.0.1:8189/object_info", timeout=15)
d = json.loads(resp.read().decode())

wan_nodes = sorted([k for k in d.keys() if k.startswith("WanVideo")])
print(f"WanVideo节点数: {len(wan_nodes)}")
for k in wan_nodes:
    info = d[k]
    inputs = info.get("input", {}).get("required", {})
    # Show key inputs
    key_inputs = list(inputs.keys())[:5]
    print(f"  {k} → inputs: {key_inputs}")

# Also find LoRA-related nodes
lora_nodes = sorted([k for k in d.keys() if "lora" in k.lower() or "LoRA" in k])
print(f"\nLoRA节点: {len(lora_nodes)}")
for k in lora_nodes:
    print(f"  {k}")

# Text encode related
text_nodes = sorted([k for k in d.keys() if "text" in k.lower() or "encode" in k.lower() and "wan" in k.lower()])
print(f"\nText Encode节点:")
for k in text_nodes:
    print(f"  {k}")
