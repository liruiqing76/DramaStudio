#!/bin/bash
# ComfyUI 自启动包装脚本
# 设置环境变量并启动 ComfyUI 服务

set -e

# === 环境变量 ===
export PATH="/root/miniconda3/bin:$PATH"
export CUDA_VISIBLE_DEVICES=0
export PYTHONUNBUFFERED=1
export HF_HOME="/root/.cache/huggingface"

# 如果使用 HF 镜像加速，取消下面一行的注释
# export HF_ENDPOINT="https://hf-mirror.com"

cd /root/ComfyUI

# 可选：先杀掉已有的 ComfyUI 进程（防止端口冲突）
fuser -k 8188/tcp 2>/dev/null || true
sleep 2

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting ComfyUI..."
exec /root/miniconda3/bin/python3.10 main.py --listen 0.0.0.0 --port 8188
