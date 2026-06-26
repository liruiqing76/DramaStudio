import json, sys, urllib.request
pid = "a8a8e134-8b61-4577-af9b-3f74001e5992"
resp = urllib.request.urlopen(f"http://127.0.0.1:8189/history/{pid}", timeout=15)
d = json.loads(resp.read().decode())
p = d.get(pid, {})
s = p.get("status", {})
status = s.get("status_str", "unknown")
print(f"STATUS: {status}")
if status == "success":
    for nid, out in p.get("outputs", {}).items():
        for key in ["videos", "images"]:
            if key in out:
                for item in out[key]:
                    fn = item.get("filename", "")
                    print(f"OUTPUT: {fn}")
elif status == "error":
    for m in s.get("messages", []):
        if isinstance(m, list) and len(m) >= 2:
            md = m[1]
            if isinstance(md, dict):
                print(f"ERR: node={md.get('node_id','')} type={md.get('exception_type','')} msg={md.get('exception_message','')[:200]}")
