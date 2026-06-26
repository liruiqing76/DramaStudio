#!/bin/bash
pkill -9 -f 'python.*main.py' 2>/dev/null
sleep 3
cd /root/autodl-tmp/ComfyUI
export PATH=/root/autodl-tmp/miniconda3/bin:$PATH
nohup python main.py --listen 0.0.0.0 --port 8189 > /tmp/comfyui_template.log 2>&1 &
sleep 35
echo "=== Version ==="
curl -s http://127.0.0.1:8189/system_stats | python -c "import sys,json;d=json.loads(sys.stdin.read());print(d['system']['comfyui_version'])"
echo "=== WanVideoWrapper ==="
grep "WanVideoWrapper" /tmp/comfyui_template.log | head -2
echo "=== PATCHED check ==="
grep "PATCHED" /root/autodl-tmp/ComfyUI/custom_nodes/ComfyUI-WanVideoWrapper/wanvideo/modules/model.py | head -1
echo "READY"
