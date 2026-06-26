#!/usr/bin/env python3
"""查WanVideoTextEncode的完整输入参数"""
import json, urllib.request

resp = urllib.request.urlopen("http://127.0.0.1:8189/object_info/WanVideoTextEncode", timeout=15)
d = json.loads(resp.read().decode())
info = d.get("WanVideoTextEncode", {})
all_inputs = {}
for category in ["required", "optional"]:
    for k, v in info.get("input", {}).get(category, {}).items():
        all_inputs[k] = v
print("WanVideoTextEncode inputs:")
for k, v in all_inputs.items():
    print(f"  {k}: {v}")
