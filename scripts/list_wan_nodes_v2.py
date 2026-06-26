import json, urllib.request
resp = urllib.request.urlopen("http://127.0.0.1:8189/object_info", timeout=15)
d = json.loads(resp.read().decode())
wan_nodes = [k for k in d if "Wan" in k or "wan" in k]
for n in sorted(wan_nodes):
    print(n)
