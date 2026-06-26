#!/usr/bin/env python3
"""查询WanVideoLoraSelectByName可用的LoRA文件列表"""
import json, urllib.request

resp = urllib.request.urlopen("http://127.0.0.1:8189/object_info/WanVideoLoraSelectByName", timeout=15)
d = json.loads(resp.read().decode())
info = d.get("WanVideoLoraSelectByName", {})
lora_config = info.get("input", {}).get("required", {}).get("lora_name", [])
if isinstance(lora_config, list) and len(lora_config) > 0:
    choices = lora_config[0]
    if isinstance(choices, list):
        print(f"LoRA choices: {len(choices)}")
        for c in choices:
            print(f"  {c}")
    else:
        print(f"lora_name type: {choices}")
else:
    print(f"lora_name config: {lora_config}")
