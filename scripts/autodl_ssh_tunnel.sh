#!/bin/bash
# ============================================================
# 本地SSH隧道 → AutoDL ComfyUI
# 
# 用法: 
#   1. 在AutoDL控制台复制SSH连接命令(类似: ssh -p 12345 root@region-1.autodl.pro)
#   2. 填入下方配置
#   3. bash autodl_ssh_tunnel.sh
#
# 连上后浏览器打开 http://localhost:8188 即可访问ComfyUI
# LocalMiniDrama项目的视频API也会通过 localhost:8188 连接
# ============================================================

# ===== 在这里填你的AutoDL SSH信息 =====
AUTODL_HOST=""       # 例: region-1.autodl.pro
AUTODL_PORT=""       # 例: 12345
AUTODL_USER="root"
LOCAL_PORT=8188      # 本地端口
REMOTE_PORT=8188     # ComfyUI端口
# ========================================

if [ -z "$AUTODL_HOST" ] || [ -z "$AUTODL_PORT" ]; then
    echo "❌ 请先填写 AUTODL_HOST 和 AUTODL_PORT"
    echo "   编辑此文件: $0"
    echo ""
    echo "   获取方式: AutoDL控制台 → 容器实例 → SSH连接 → 复制命令"
    echo "   例: ssh -p 12345 root@region-1.autodl.pro"
    echo "       AUTODL_HOST=region-1.autodl.pro"
    echo "       AUTODL_PORT=12345"
    exit 1
fi

echo "🔗 建立SSH隧道: localhost:${LOCAL_PORT} → ${AUTODL_HOST}:${REMOTE_PORT}"
echo "   浏览器打开: http://localhost:${LOCAL_PORT}"
echo "   Ctrl+C 断开隧道"
echo ""

ssh -L ${LOCAL_PORT}:localhost:${REMOTE_PORT} \
    -p ${AUTODL_PORT} \
    -o StrictHostKeyChecking=no \
    -o ServerAliveInterval=30 \
    ${AUTODL_USER}@${AUTODL_HOST}
