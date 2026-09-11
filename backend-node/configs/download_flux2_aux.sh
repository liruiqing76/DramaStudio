#!/bin/bash
cd /root/autodl-tmp/comfyui_models
wget --no-check-certificate -O text_encoders/clip_l.safetensors https://hf-mirror.com/comfyanonymous/flux_text_encoders/resolve/main/clip_l.safetensors
wget --no-check-certificate -O vae/ae.safetensors https://hf-mirror.com/black-forest-labs/FLUX.2-dev/resolve/main/ae.safetensors 2>/dev/null || wget --no-check-certificate -O vae/ae.safetensors https://hf-mirror.com/black-forest-labs/FLUX.1-dev/resolve/main/ae.safetensors
echo all_done
