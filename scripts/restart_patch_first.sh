#!/bin/bash
pkill -9 -f 'python.*main.py' 2>/dev/null
sleep 3
cd /root/autodl-tmp/ComfyUI
export PATH=/root/autodl-tmp/miniconda3/bin:$PATH
nohup python main.py --listen 0.0.0.0 --port 8189 > /tmp/comfyui9.log 2>&1 &
sleep 40
echo "=== Check PATCHED loaded ==="
grep -c "PATCHED" /tmp/comfyui9.log
echo "=== Check img_emb ==="
curl -s http://127.0.0.1:8189/system_stats | head -1
echo COMFYUI_READY
