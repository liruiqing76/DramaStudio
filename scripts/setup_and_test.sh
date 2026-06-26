#!/bin/bash
set -e

KILLALL() { pkill -f wget 2>/dev/null; pkill -f curl 2>/dev/null; true; }

HOST=https://hf-mirror.com
GGUF=/root/autodl-tmp/comfyui_models/diffusion_models/GGUF
TXT=/root/autodl-tmp/comfyui_models/text_encoders
VAE=/root/autodl-tmp/comfyui_models/vae

echo "=== 1. Kill duplicate downloads ==="
KILLALL
sleep 1

echo "=== 2. Clean corrupted files ==="
for f in "$GGUF/flux2-dev-Q4_K_M.gguf" "$TXT/clip_l.safetensors" "$VAE/ae.safetensors"; do
    [ -f "$f" ] && [ "$(stat -c%s "$f" 2>/dev/null || echo 0)" -lt 1048576 ] && rm -f "$f" && echo "rm $f"
done

echo "=== 3. Download cl_l.safetensors ==="
[ -f "$TXT/clip_l.safetensors" ] || wget -q --show-progress --no-check-certificate -O "$TXT/clip_l.safetensors" "$HOST/comfyanonymous/flux_text_encoders/resolve/main/clip_l.safetensors"
ls -lh "$TXT/clip_l.safetensors"

echo "=== 4. Download ae.safetensors ==="
[ -f "$VAE/ae.safetensors" ] || wget -q --show-progress --no-check-certificate -O "$VAE/ae.safetensors" "$HOST/black-forest-labs/FLUX.2-dev/resolve/main/ae.safetensors"
ls -lh "$VAE/ae.safetensors"

echo "=== 5. Check flux2 GGUF ==="
ls -lh "$GGUF/flux2-dev-Q4_K_M.gguf" 2>/dev/null || echo "flux2 GGUF NOT READY - need manual download"

echo "=== 6. Start ComfyUI ==="
fuser -k 8188/tcp 2>/dev/null || true
sleep 1
cd /root/ComfyUI
nohup /root/miniconda3/bin/python main.py --listen 0.0.0.0 --port 8188 > /tmp/comfyui.log 2>&1 &
echo "ComfyUI PID=$!"

echo "=== 7. Wait for ComfyUI to be ready ==="
for i in 1 2 3 4 5 6 7 8 9 10; do
    sleep 3
    curl -s http://localhost:8188/system_stats > /dev/null 2>&1 && echo "ComfyUI READY" && break
    echo "waiting... ($i)"
done

echo "=== DONE ==="
