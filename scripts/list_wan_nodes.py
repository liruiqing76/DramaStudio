import json, urllib.request

COMFYUI = "http://127.0.0.1:8189"

# Get all object_info
resp = urllib.request.urlopen(f"{COMFYUI}/object_info", timeout=30)
info = json.loads(resp.read().decode())

wan_nodes = [k for k in info.keys() if "wan" in k.lower() or "Wan" in k or "video" in k.lower()]
print(f"=== WanVideo related nodes ({len(wan_nodes)}) ===")
for n in sorted(wan_nodes):
    inputs = info[n].get("input", {}).get("required", {})
    opt_inputs = info[n].get("input", {}).get("optional", {})
    print(f"\n{n}:")
    for k, v in inputs.items():
        typ = v[0] if isinstance(v, list) and len(v) > 0 else str(v)[:80]
        print(f"  REQ: {k} = {typ}")
    for k, v in opt_inputs.items():
        typ = v[0] if isinstance(v, list) and len(v) > 0 else str(v)[:80]
        print(f"  OPT: {k} = {typ}")
