#!/bin/bash
# FLUX.1 生图模型一键部署脚本
# 用法: SSH到AutoDL后执行 bash setup_flux1.sh
set -e

BASE=/root/autodl-tmp/comfyui_models
COMFYUI=/root/autodl-tmp/ComfyUI
PYTHON=/root/miniconda3/bin/python3

echo "=========================================="
echo "  FLUX.1 生图模型部署 (AutoDL)"
echo "=========================================="

# --- 1. 检查已有模型 ---
echo ""
echo ">>> Step 1: 检查模型文件..."
MISSING_FLUX=0
MISSING_T5=0

if [ -f "$BASE/diffusion_models/GGUF/flux1-dev-Q8_0.gguf" ]; then
    echo "  [OK] flux1-dev-Q8_0.gguf ($(du -h "$BASE/diffusion_models/GGUF/flux1-dev-Q8_0.gguf" | cut -f1))"
else
    echo "  [MISSING] flux1-dev-Q8_0.gguf — 需要下载 (~12.7GB)"
    MISSING_FLUX=1
fi

if [ -f "$BASE/text_encoders/clip_l.safetensors" ]; then
    echo "  [OK] clip_l.safetensors"
else
    echo "  [MISSING] clip_l.safetensors"
    exit 1
fi

if [ -f "$BASE/text_encoders/t5xxl_fp8_e4m3fn.safetensors" ]; then
    echo "  [OK] t5xxl_fp8_e4m3fn.safetensors (与WAN 2.1共享)"
else
    echo "  [MISSING] t5xxl_fp8_e4m3fn.safetensors — 需要下载 (~4.9GB)"
    MISSING_T5=1
fi

if [ -f "$BASE/vae/ae.safetensors" ]; then
    echo "  [OK] ae.safetensors"
else
    echo "  [MISSING] ae.safetensors"
    exit 1
fi

# --- 2. 下载缺失的模型 ---
if [ $MISSING_FLUX -eq 1 ] || [ $MISSING_T5 -eq 1 ]; then
    echo ""
    echo ">>> Step 2: 下载缺失模型..."
    export HF_ENDPOINT=https://hf-mirror.com

    if [ $MISSING_FLUX -eq 1 ]; then
        echo "  下载 FLUX.1-dev Q8_0 GGUF (~12.7GB)..."
        $PYTHON << 'PYEOF'
import os
os.environ['HF_ENDPOINT'] = 'https://hf-mirror.com'
from huggingface_hub import hf_hub_download
path = hf_hub_download(
    repo_id='city96/FLUX.1-dev-gguf',
    filename='flux1-dev-Q8_0.gguf',
    local_dir='/root/autodl-tmp/comfyui_models/diffusion_models/GGUF/'
)
print(f'  Done: {path} ({os.path.getsize(path)/1e9:.2f}GB)')
PYEOF
    fi

    if [ $MISSING_T5 -eq 1 ]; then
        echo "  下载 T5-XXL fp8 (~4.9GB)..."
        $PYTHON << 'PYEOF'
import os
os.environ['HF_ENDPOINT'] = 'https://hf-mirror.com'
from huggingface_hub import hf_hub_download
path = hf_hub_download(
    repo_id='comfyanonymous/flux_text_encoders',
    filename='t5xxl_fp8_e4m3fn.safetensors',
    local_dir='/root/autodl-tmp/comfyui_models/text_encoders'
)
print(f'  Done: {path} ({os.path.getsize(path)/1e9:.2f}GB)')
PYEOF
    fi
fi

# --- 3. 创建符号链接 ---
echo ""
echo ">>> Step 3: 创建符号链接..."
mkdir -p "$COMFYUI/models/diffusion_models/GGUF"
mkdir -p "$COMFYUI/models/clip"
mkdir -p "$COMFYUI/models/vae"

ln -sf "$BASE/diffusion_models/GGUF/flux1-dev-Q8_0.gguf" \
       "$COMFYUI/models/diffusion_models/GGUF/flux1-dev-Q8_0.gguf"
echo "  -> diffusion_models/GGUF/flux1-dev-Q8_0.gguf"

ln -sf "$BASE/text_encoders/comfyanonymous/flux_text_encoders/clip_l.safetensors" \
       "$COMFYUI/models/clip/clip_l.safetensors"
echo "  -> clip/clip_l.safetensors"

ln -sf "$BASE/text_encoders/t5xxl_fp8_e4m3fn.safetensors" \
       "$COMFYUI/models/clip/t5xxl_fp8_e4m3fn.safetensors"
echo "  -> clip/t5xxl_fp8_e4m3fn.safetensors"

ln -sf "$BASE/vae/ae.safetensors" \
       "$COMFYUI/models/vae/ae.safetensors"
echo "  -> vae/ae.safetensors"

# --- 4. 验证链接 ---
echo ""
echo ">>> Step 4: 验证符号链接..."
ALL_OK=1
for f in \
    "$COMFYUI/models/diffusion_models/GGUF/flux1-dev-Q8_0.gguf" \
    "$COMFYUI/models/clip/clip_l.safetensors" \
    "$COMFYUI/models/clip/t5xxl_fp8_e4m3fn.safetensors" \
    "$COMFYUI/models/vae/ae.safetensors"; do
    if [ -e "$f" ]; then
        echo "  [OK] $(basename $f)"
    else
        echo "  [BROKEN] $f"
        ALL_OK=0
    fi
done

if [ $ALL_OK -eq 0 ]; then
    echo ""
    echo "!!! 部分符号链接失效，请检查源文件是否存在"
    exit 1
fi

# --- 5. 写入开机自启动 ---
echo ""
echo ">>> Step 5: 更新开机自启动脚本..."
cat > /etc/autodl.sh << 'AUTODLEOF'
#!/bin/bash
# ComfyUI + 模型符号链接 开机自启动

log() { echo "[ComfyUI-Boot $(date '+%H:%M:%S')] $*"; }

# 等待网络和GPU就绪
for i in $(seq 1 30); do ping -c1 -W1 8.8.8.8 >/dev/null 2>&1 && break; sleep 2; done
for i in $(seq 1 30); do nvidia-smi >/dev/null 2>&1 && break; sleep 2; done

export PATH="/root/miniconda3/bin:$PATH"
export CUDA_VISIBLE_DEVICES=0
export PYTHONUNBUFFERED=1

# 清理旧进程
fuser -k 8188/tcp 2>/dev/null || true
sleep 2

# 创建模型符号链接
log "创建符号链接..."
mkdir -p /root/autodl-tmp/ComfyUI/models/diffusion_models/GGUF
mkdir -p /root/autodl-tmp/ComfyUI/models/clip
mkdir -p /root/autodl-tmp/ComfyUI/models/vae

ln -sf /root/autodl-tmp/comfyui_models/diffusion_models/GGUF/flux1-dev-Q8_0.gguf /root/autodl-tmp/ComfyUI/models/diffusion_models/GGUF/flux1-dev-Q8_0.gguf
ln -sf /root/autodl-tmp/comfyui_models/diffusion_models/GGUF/flux2-dev-Q4_K_M.gguf /root/autodl-tmp/ComfyUI/models/diffusion_models/GGUF/flux2-dev-Q4_K_M.gguf
ln -sf /root/autodl-tmp/comfyui_models/diffusion_models/GGUF/wan2.1-i2v-14b-720p-Q4_K_M.gguf /root/autodl-tmp/ComfyUI/models/diffusion_models/GGUF/wan2.1-i2v-14b-720p-Q4_K_M.gguf
ln -sf /root/autodl-tmp/comfyui_models/text_encoders/comfyanonymous/flux_text_encoders/clip_l.safetensors /root/autodl-tmp/ComfyUI/models/clip/clip_l.safetensors
ln -sf /root/autodl-tmp/comfyui_models/text_encoders/t5xxl_fp8_e4m3fn.safetensors /root/autodl-tmp/ComfyUI/models/clip/t5xxl_fp8_e4m3fn.safetensors
ln -sf /root/autodl-tmp/comfyui_models/vae/ae.safetensors /root/autodl-tmp/ComfyUI/models/vae/ae.safetensors

# 启动ComfyUI
log "启动 ComfyUI..."
cd /root/autodl-tmp/ComfyUI
nohup /root/miniconda3/bin/python3.10 main.py --listen 0.0.0.0 --port 8188 > /tmp/comfyui_boot.log 2>&1 &

log "完成"
AUTODLEOF
chmod +x /etc/autodl.sh
echo "  [OK] /etc/autodl.sh 已更新"

# --- 完成 ---
echo ""
echo "=========================================="
echo "  部署完成!"
echo "=========================================="
echo ""
echo "后续步骤:"
echo "  1. 重启 ComfyUI: fuser -k 8188/tcp; cd $COMFYUI && nohup $PYTHON main.py --listen 0.0.0.0 --port 8188 > /tmp/comfyui_boot.log 2>&1 &"
echo "  2. 本地执行 SQL: sqlite3 backend-node/data/drama_generator.db < backend-node/configs/flux2_image_config.sql"
echo "  3. 前端 AI配置 页面确认 ComfyUI-FLUX.1-GGUF 已激活"
echo ""
