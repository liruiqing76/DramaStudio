#!/usr/bin/env python3
"""Poll a specific prompt_id for completion"""
import json, urllib.request, sys, time

COMFY = "http://127.0.0.1:8189"
PID = sys.argv[1] if len(sys.argv) > 1 else "d92a57de-80b4-47cb-a42d-6dea67ffee87"

elapsed = 0
while elapsed < 600:
    time.sleep(30)
    elapsed += 30
    try:
        resp = urllib.request.urlopen(f"{COMFY}/history/{PID}", timeout=15)
        history = json.loads(resp.read().decode())
        pd = history.get(PID, {})
        status = pd.get("status", {}).get("status_str", "running")
        print(f"  {elapsed}s: {status}")
        if status == "success":
            for nid, out in pd.get("outputs", {}).items():
                for key in ["videos", "images"]:
                    if key in out:
                        for item in out[key]:
                            fn = item.get("filename", "")
                            print(f"  OUTPUT: {fn}")
            break
        elif status == "error":
            msgs = pd.get("status", {}).get("messages", [])
            for m in msgs:
                if isinstance(m, list) and len(m) >= 2:
                    md = m[1]
                    if isinstance(md, dict):
                        print(f"  ERR: node={md.get('node_id','')} type={md.get('exception_type','')} msg={md.get('exception_message','')[:300]}")
            break
    except Exception as e:
        print(f"  {elapsed}s: poll error {e}")
else:
    print("TIMEOUT 600s")
