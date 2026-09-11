#!/bin/bash
# ============================================================
# AutoDL 一键部署 ComfyUI + Wan2.1 (AI短剧用)
# 
# 用法: 在AutoDL终端直接运行
#   curl -sL <此脚本URL> | bash
#   或: bash autodl_deploy_wan21.sh
#
# AutoDL环境: 
#   - /root/autodl-tmp  持久存储(不会随实例释放丢失)
#   - /root/autodl-nas  网盘存储
#   - HF_ENDPOINT 已预设 hf-mirror.com
# ============================================================

set -e

COMFYUI_DIR="/root/autodl-tmp/ComfyUI"
MODELS_DIR="$COMFYUI_DIR/models"
HF_MIRROR="${HF_ENDPOINT:-https://hf-mirror.com}"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 AutoDL 一键部署 ComfyUI + Wan2.1 FP8"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ============ 1. 安装 ComfyUI ============
install_comfyui() {
    if [ -d "$COMFYUI_DIR" ] && [ -f "$COMFYUI_DIR/main.py" ]; then
        echo "✅ ComfyUI 已存在: $COMFYUI_DIR"
        cd "$COMFYUI_DIR"
        git pull 2>/dev/null || echo "⚠️ git pull 失败(不影响)"
        return 0
    fi

    echo "📦 安装 ComfyUI..."
    cd /root/autodl-tmp
    git clone https://github.com/comfyanonymous/ComfyUI.git
    cd ComfyUI
    pip install -r requirements.txt -i https://mirrors.aliyun.com/pypi/simple/ --quiet
    echo "✅ ComfyUI 安装完成"
}

# ============ 2. 安装 aria2c (多线程下载) ============
install_aria2c() {
    if command -v aria2c &>/dev/null; then
        echo "✅ aria2c 已安装"
        return 0
    fi
    echo "📦 安装 aria2c..."
    apt-get update -qq 2>/dev/null && apt-get install -y -qq aria2 2>/dev/null || \
    yum install -y aria2 2>/dev/null || \
    echo "⚠️  aria2c 安装失败, 用wget代替(较慢)"
}

# ============ 3. 下载模型 ============
download_file() {
    local url="$1"
    local dest="$2"
    local filename=$(basename "$dest")

    if [ -f "$dest" ]; then
        local size=$(stat -c%s "$dest" 2>/dev/null || echo 0)
        if [ "$size" -gt 1000000 ]; then
            echo "✅ 已存在: $filename ($(python3 -c \"print(f'{${size}/1024/1024/1024:.2f}GB')\" 2>/dev/null || echo '?'))"
            return 0
        fi
    fi

    echo "⬇️  $filename"

    if command -v aria2c &>/dev/null; then
        aria2c -x 16 -s 16 -k 1M --continue=true \
            --max-tries=5 --retry-wait=3 \
            --file-allocation=none \
            -d "$(dirname "$dest")" -o "$filename" \
            "$url" 2>&1 | tail -3
    else
        wget -c --tries=5 --timeout=60 \
            -O "$dest" "$url"
    fi
}

# 主流程
install_comfyui
install_aria2c

mkdir -p "$MODELS_DIR/text_encoders"
mkdir -p "$MODELS_DIR/clip_vision"
mkdir -p "$MODELS_DIR/vae"
mkdir -p "$MODELS_DIR/diffusion_models"

# ---- 基础模型 ----
echo ""
echo "━━━ [1/4] 基础模型 (7.69 GB) ━━━"

download_file \
    "${HF_MIRROR}/Comfy-Org/Wan_2.1_ComfyUI_repackaged/resolve/main/split_files/text_encoders/umt5_xxl_fp8_e4m3fn_scaled.safetensors" \
    "$MODELS_DIR/text_encoders/umt5_xxl_fp8_e4m3fn_scaled.safetensors"

download_file \
    "${HF_MIRROR}/Comfy-Org/Wan_2.1_ComfyUI_repackaged/resolve/main/split_files/clip_vision/clip_vision_h.safetensors" \
    "$MODELS_DIR/clip_vision/clip_vision_h.safetensors"

download_file \
    "${HF_MIRROR}/Comfy-Org/Wan_2.1_ComfyUI_repackaged/resolve/main/split_files/vae/wan_2.1_vae.safetensors" \
    "$MODELS_DIR/vae/wan_2.1_vae.safetensors"

# ---- T2V ----
echo ""
echo "━━━ [2/4] T2V 文生视频 (15.95 GB) ━━━"

download_file \
    "${HF_MIRROR}/Comfy-Org/Wan_2.1_ComfyUI_repackaged/resolve/main/split_files/diffusion_models/wan2.1_t2v_14B_fp8_scaled.safetensors" \
    "$MODELS_DIR/diffusion_models/wan2.1_t2v_14B_fp8_scaled.safetensors"

download_file \
    "${HF_MIRROR}/Comfy-Org/Wan_2.1_ComfyUI_repackaged/resolve/main/split_files/diffusion_models/wan2.1_t2v_1.3B_bf16.safetensors" \
    "$MODELS_DIR/diffusion_models/wan2.1_t2v_1.3B_bf16.safetensors"

# ---- I2V ----
echo ""
echo "━━━ [3/4] I2V 图生视频 (30.54 GB) ━━━"

download_file \
    "${HF_MIRROR}/Comfy-Org/Wan_2.1_ComfyUI_repackaged/resolve/main/split_files/diffusion_models/wan2.1_i2v_480p_14B_fp8_scaled.safetensors" \
    "$MODELS_DIR/diffusion_models/wan2.1_i2v_480p_14B_fp8_scaled.safetensors"

download_file \
    "${HF_MIRROR}/Comfy-Org/Wan_2.1_ComfyUI_repackaged/resolve/main/split_files/diffusion_models/wan2.1_i2v_720p_14B_fp8_scaled.safetensors" \
    "$MODELS_DIR/diffusion_models/wan2.1_i2v_720p_14B_fp8_scaled.safetensors"

# ---- T2I ----
echo ""
echo "━━━ [4/4] T2I 文生图 (2.91 GB) ━━━"

download_file \
    "${HF_MIRROR}/Comfy-Org/Wan_2.1_ComfyUI_repackaged/resolve/main/split_files/diffusion_models/wan2.1_fun_inp_1.3B_bf16.safetensors" \
    "$MODELS_DIR/diffusion_models/wan2.1_fun_inp_1.3B_bf16.safetensors"

# ============ 4. 完成 ============
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ 部署完成!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📊 磁盘占用:"
du -sh "$MODELS_DIR"/*/
echo ""
echo "💰 模型总大小:"
du -sh "$MODELS_DIR"
echo ""

# ============ 5. 启动 ============
echo "🚀 启动 ComfyUI:"
echo "   cd $COMFYUI_DIR"
echo "   python main.py --listen 0.0.0.0 --port 8188"
echo ""
echo "🔗 本地连接 (在你Windows电脑执行):"
echo "   ssh -L 8188:localhost:8188 root@<AutoDL连接地址> -p <端口>"
echo "   然后浏览器打开 http://localhost:8188"
