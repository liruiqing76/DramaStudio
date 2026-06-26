#!/bin/bash
# Clean ALL output and cache
rm -rf /root/autodl-tmp/ComfyUI/output/*
echo "Output cleaned"

# Kill ComfyUI, clear cache, restart
pkill -9 -f "python.*main.py" 2>/dev/null
sleep 3

# Clear temp/input dirs that might be cached
find /root/autodl-tmp/ComfyUI/temp/ -name "*.tmp" -delete 2>/dev/null
echo "Temp cleaned"

cd /root/autodl-tmp/ComfyUI
export PATH=/root/autodl-tmp/miniconda3/bin:$PATH
python main.py --listen 0.0.0.0 --port 8189 > /tmp/cf4.log 2>&1 &
sleep 30
curl -s http://127.0.0.1:8189/system_stats | head -2
echo "COMFYUI_READY"
