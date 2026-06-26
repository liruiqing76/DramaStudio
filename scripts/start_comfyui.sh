#!/bin/bash
export PATH=/root/autodl-tmp/miniconda3/bin:$PATH
pkill -9 -f "python.*main.py" 2>/dev/null
sleep 2
cd /root/ComfyUI
nohup python main.py --listen 0.0.0.0 --port 8189 > /tmp/comfyui.log 2>&1 &
sleep 40
curl -s http://127.0.0.1:8189/system_stats | head -2
echo READY
