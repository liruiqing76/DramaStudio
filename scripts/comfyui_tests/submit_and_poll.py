#!/usr/bin/env python3
"""Submit wrapper workflow and poll result - all in one"""
import json, urllib.request, io, uuid, time
from PIL import Image

# 1. Upload test image
img = Image.new('RGB', (832, 480), color=(128, 64, 32))
buf = io.BytesIO()
img.save(buf, format='PNG')
boundary = uuid.uuid4().hex
body = b'--' + boundary.encode() + b'\r\n'
body += b'Content-Disposition: form-data; name="image"; filename="test_final2.png"\r\n'
body += b'Content-Type: image/png\r\n\r\n' + buf.getvalue() + b'\r\n'
body += b'--' + boundary.encode() + b'--\r\n'
req = urllib.request.Request('http://localhost:18189/upload/image', body,
    headers={'Content-Type': f'multipart/form-data; boundary={boundary}'})
resp = urllib.request.urlopen(req)
img_name = json.loads(resp.read())['name']
print(f'Image: {img_name}')

# 2. Build workflow
wf = json.loads(open('D:/zmzc-code/ai-drama-refs/LocalMiniDrama/backend-node/configs/comfyui_workflows/wan22_distill_i2v_wrapper.json').read())
placeholder_map = {
    '{{image_url}}': img_name,
    '{{prompt}}': 'A cat walking slowly',
    '{{negative_prompt}}': '',
    '{{width}}': 832, '{{height}}': 480, '{{frames}}': 81,
    '{{steps}}': 20, '{{cfg}}': 6.0, '{{seed}}': 42, '{{denoise}}': 0.7,
}
for nid, node in wf.items():
    for key, val in list(node.get('inputs', {}).items()):
        if isinstance(val, str) and val in placeholder_map:
            node['inputs'][key] = placeholder_map[val]
        # Ensure numeric types
        if key in ('width', 'height', 'frames', 'steps', 'seed'):
            try: node['inputs'][key] = int(node['inputs'][key])
            except: pass
        elif key in ('cfg', 'denoise'):
            try: node['inputs'][key] = float(node['inputs'][key])
            except: pass

# Verify no placeholders left
remaining = []
for nid, node in wf.items():
    for key, val in node.get('inputs', {}).items():
        if isinstance(val, str) and '{{' in val:
            remaining.append(f'{nid}.{key}={val}')
if remaining:
    print(f'UNREPLACED: {remaining}')
else:
    print('All placeholders replaced!')

# 3. Submit
data = json.dumps({'prompt': wf}).encode()
req = urllib.request.Request('http://localhost:18189/prompt', data,
    headers={'Content-Type': 'application/json'})
try:
    resp = urllib.request.urlopen(req)
    pid = json.loads(resp.read()).get('prompt_id')
    print(f'SUBMITTED pid={pid}')
except urllib.error.HTTPError as e:
    err = e.read().decode()[:300]
    print(f'SUBMIT FAILED: {err}')
    import sys; sys.exit(1)

# 4. Poll every 10s for up to 300s
start = time.time()
while time.time() - start < 300:
    try:
        resp = urllib.request.urlopen(f'http://localhost:18189/history/{pid}')
        hist = json.loads(resp.read())
        if pid in hist:
            s = hist[pid].get('status', {})
            elapsed = int(time.time() - start)
            if s.get('completed', False):
                print(f'\n=== COMPLETED in {elapsed}s! ===')
                for nid, out in hist[pid].get('outputs', {}).items():
                    if 'videos' in out:
                        for v in out['videos']:
                            print(f'Video: subfolder={v.get("subfolder")}, filename={v.get("filename")}, type={v.get("type")}')
                break
            elif s.get('status_str') == 'error':
                for m in s.get('messages', []):
                    if m[0] == 'execution_error':
                        err = m[1]
                        msg = err.get('exception_message', '')[:200]
                        print(f'\nERROR Node {err.get("node_id")} ({err.get("node_type")}): {msg}')
                        if '68 channels' in msg:
                            print('>>> 68CH BUG STILL EXISTS')
                        elif 'meta' in msg:
                            print('>>> META DEVICE BUG STILL EXISTS')
                        elif 'NoneType' in msg:
                            print('>>> NoneType BUG - clip_fea/img_emb handling broken')
                        else:
                            print('>>> NEW/OTHER ERROR')
                break
            elif s.get('status_str') == 'running':
                if elapsed % 30 < 11:
                    print(f'Running... {elapsed}s')
            else:
                print(f'Status: {s.get("status_str", "?")} {elapsed}s')
    except Exception as ex:
        pass
    time.sleep(10)
print(f'Total elapsed: {int(time.time()-start)}s')
