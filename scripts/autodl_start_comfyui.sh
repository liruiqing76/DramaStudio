#!/bin/bash
# ============================================================
# AutoDL ComfyUI 启动脚本 (Wan2.1 专用)
# 
# 用法: bash autodl_start_comfyui.sh
# 后台运行: nohup bash autodl_start_comfyui.sh > /root/autodl-tmp/comfyui.log 2>&1 &
# ============================================================

COMFYUI_DIR="/root/autodl-tmp/ComfyUI"

if [ ! -d "$COMFYUI_DIR" ]; then
    echo "❌ ComfyUI 未安装，先运行 autodl_deploy_wan21.sh"
    exit 1
fi

cd "$COMFYUI_DIR"

# 检查是否已在运行
if pgrep -f "main.py.*8188" > /dev/null 2>&1; then
    echo "⚠️  ComfyUI 已在运行 (PID: $(pgrep -f 'main.py.*8188'))"
    echo "   如需重启: kill $(pgrep -f 'main.py.*8188') && bash $0"
    exit 0
fi

echo "🚀 启动 ComfyUI (Wan2.1, port 8188)..."
echo "   日志: tail -f /root/autodl-tmp/comfyui.log"
echo ""

python main.py --listen 0.0.0.0 --port 8188 --preview-method auto
