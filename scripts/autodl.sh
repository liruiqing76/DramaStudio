#!/bin/bash
# ComfyUI 开机自启动脚本
# AutoDL / SeetaCloud 容器环境用
# 此文件由 /init/bin/customer.cmd.sh 在开机时自动调用

log() { echo "[ComfyUI-Boot $(date '+%H:%M:%S')] $*"; }

# 1. 等待网络就绪
log "等待网络..."
for i in $(seq 1 30); do
    ping -c1 -W1 8.8.8.8 >/dev/null 2>&1 && break
    sleep 2
done

# 2. 等待 GPU 就绪
log "等待 GPU..."
for i in $(seq 1 30); do
    nvidia-smi >/dev/null 2>&1 && break
    sleep 2
done

# 3. 环境变量
export PATH="/root/miniconda3/bin:$PATH"
export CUDA_VISIBLE_DEVICES=0
export PYTHONUNBUFFERED=1

# 4. 清理旧进程
log "清理旧进程..."
fuser -k 8188/tcp 2>/dev/null || true
sleep 2

# 5. 启动 ComfyUI
log "启动 ComfyUI..."
cd /root/ComfyUI
nohup /root/miniconda3/bin/python3.10 main.py --listen 0.0.0.0 --port 8188 > /tmp/comfyui_boot.log 2>&1 &

log "ComfyUI 已启动 (PID=$!)"
log "日志: /tmp/comfyui_boot.log"
