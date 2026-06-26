#!/bin/bash
pkill -9 -f 'python.*main.py' 2>/dev/null
sleep 3
cd /root/autodl-tmp/ComfyUI
export PATH=/root/autodl-tmp/miniconda3/bin:$PATH
nohup python main.py --listen 0.0.0.0 --port 8189 > /tmp/comfyui_v024_patched.log 2>&1 &
sleep 35
echo "=== Version check ==="
curl -s http://127.0.0.1:8189/system_stats | /root/autodl-tmp/miniconda3/bin/python -c "import sys,json;d=json.loads(sys.stdin.read());print(f'ComfyUI v{d[\"system\"][\"comfyui_version\"]}')"
echo "=== WanVideo loaded? ==="
grep "WanVideoWrapper" /tmp/comfyui_v024_patched.log
echo V024_PATCHED_READY
