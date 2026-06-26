#!/usr/bin/env python3
import json, urllib.request
resp = urllib.request.urlopen("http://127.0.0.1:8189/history", timeout=10)
d = json.loads(resp.read().decode())
# Last 5 entries
items = sorted(d.items(), key=lambda x: x[1].get("status",{}).get("status_str",""))
for k, v in items[-5:]:
    s = v.get("status",{}).get("status_str","?")
    outputs = []
    for nid, out in v.get("outputs",{}).items():
        for key in ["videos", "images"]:
            if key in out:
                for item in out[key]:
                    outputs.append(item.get("filename",""))
    # Get model info from prompt
    prompt = v.get("prompt", [None, None])[0] if isinstance(v.get("prompt"), list) else v.get("prompt", {})
    model_info = ""
    if isinstance(prompt, dict):
        for nid, node in prompt.items():
            if isinstance(node, dict) and "WanVideoModelLoader" in node.get("class_type",""):
                model_info = node.get("inputs",{}).get("model","")[-40:]
    print(f"{k[:8]}... {s} outputs={outputs} model=...{model_info}")
