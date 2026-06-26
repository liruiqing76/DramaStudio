#!/usr/bin/env python3
"""查询LoadWanVideoT5TextEncoder和WanVideoModelLoader的详细参数"""
import json, urllib.request

resp = urllib.request.urlopen("http://127.0.0.1:8189/object_info", timeout=15)
d = json.loads(resp.read().decode())

for node_name in ["LoadWanVideoT5TextEncoder", "WanVideoModelLoader", "WanVideoLoraSelectByName", "WanVideoSetLoRAs", "WanVideoBlockSwap", "WanVideoSetBlockSwap", "WanVideoSampler", "WanVideoTextEncode"]:
    info = d.get(node_name, {})
    if not info:
        print(f"  {node_name}: NOT FOUND")
        continue
    print(f"\n=== {node_name} ===")
    inputs = info.get("input", {}).get("required", {})
    for k, v in inputs.items():
        if isinstance(v, list) and len(v) >= 2:
            dtype = v[0]
            default = v[1] if len(v) > 1 else None
            if isinstance(dtype, list):
                print(f"  {k}: choices[:10]={dtype[:10]}, default={default}")
            else:
                print(f"  {k}: type={dtype}, default={default}")
        else:
            print(f"  {k}: {v}")
