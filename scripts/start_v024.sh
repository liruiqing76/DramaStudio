#!/bin/bash
cd /root/autodl-tmp/ComfyUI
export PATH=/root/autodl-tmp/miniconda3/bin:$PATH
pkill -9 -f 'python.*main.py' 2>/dev/null
sleep 3
nohup python main.py --listen 0.0.0.0 --port 8189 > /tmp/comfyui_v024.log 2>&1 &
sleep 35
echo "=== ComfyUI version ==="
curl -s http://127.0.0.1:8189/system_stats | /root/autodl-tmp/miniconda3/bin/python -c "import sys,json;d=json.loads(sys.stdin.read());print(d['system']['comfyui_version'])"
echo COMFYUI_V024_READY
