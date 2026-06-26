#!/usr/bin/env python3
"""查WanVideoVAELoader完整参数"""
import json, urllib.request

resp = urllib.request.urlopen("http://127.0.0.1:8189/object_info/WanVideoVAELoader", timeout=15)
d = json.loads(resp.read().decode())
info = d.get("WanVideoVAELoader", {})
for cat in ["required", "optional"]:
    for k, v in info.get("input", {}).get(cat, {}).items():
        print(f"  {cat} | {k}: {v}")
