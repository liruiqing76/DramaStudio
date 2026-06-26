# FLUX.1 生图模型 AutoDL 部署指南

> 在已有 WAN 2.1 视频生成的 AutoDL 机器上，部署 FLUX.1 GGUF 文生图模型，零额外 GPU 租金。
> FLUX.1 与 WAN 2.1 共享 T5-XXL 文本编码器，无需额外下载。

---

## 模型文件清单

FLUX.1 生图需要 4 个模型文件，共约 17.5GB：

| # | 文件名 | 大小 | 用途 | 存放目录 | 下载状态 |
|---|--------|------|------|----------|----------|
| 1 | `flux1-dev-Q8_0.gguf` | ~12.7GB | 扩散模型 (GGUF Q8量化，近无损) | `diffusion_models/GGUF/` | 已下载 |
| 2 | `clip_l.safetensors` | 246MB | CLIP-L 文本编码器 | `text_encoders/` | WAN 2.1 已下载 |
| 3 | `t5xxl_fp8_e4m3fn.safetensors` | ~4.9GB | T5-XXL 文本编码器 (fp8) | `text_encoders/` | WAN 2.1 已下载 |
| 4 | `ae.safetensors` | 335MB | FLUX VAE | `vae/` | 已下载 |

> 以上路径均相对于 `/root/autodl-tmp/comfyui_models/`

**关键优势**：FLUX.1 与 WAN 2.1 共用同一个 T5-XXL 文本编码器，零额外下载成本。

---

## 部署步骤

### Step 1：确认模型文件

SSH 到 AutoDL 后执行：

```bash
echo "=== 检查 FLUX.1 模型文件 ==="
ls -lh /root/autodl-tmp/comfyui_models/diffusion_models/GGUF/flux1-dev-Q8_0.gguf 2>/dev/null && echo "OK: 扩散模型" || echo "MISSING: 扩散模型"
ls -lh /root/autodl-tmp/comfyui_models/text_encoders/clip_l.safetensors 2>/dev/null && echo "OK: CLIP-L" || echo "MISSING: CLIP-L"
ls -lh /root/autodl-tmp/comfyui_models/text_encoders/t5xxl_fp8_e4m3fn.safetensors 2>/dev/null && echo "OK: T5-XXL" || echo "MISSING: T5-XXL"
ls -lh /root/autodl-tmp/comfyui_models/vae/ae.safetensors 2>/dev/null && echo "OK: VAE" || echo "MISSING: VAE"
```

### Step 2：下载缺失的模型（如果 Step 1 显示 MISSING）

```bash
# 下载 FLUX.1-dev Q8_0 GGUF 扩散模型 (~12.7GB)
/root/miniconda3/bin/python3 << 'PYEOF'
import os
os.environ['HF_ENDPOINT'] = 'https://hf-mirror.com'
from huggingface_hub import hf_hub_download
path = hf_hub_download(
    repo_id='city96/FLUX.1-dev-gguf',
    filename='flux1-dev-Q8_0.gguf',
    local_dir='/root/autodl-tmp/comfyui_models/diffusion_models/GGUF/'
)
print(f'Done: {path} ({os.path.getsize(path)/1e9:.2f}GB)')
PYEOF

# 下载 T5-XXL fp8 文本编码器 (~4.9GB)，如果缺失
/root/miniconda3/bin/python3 << 'PYEOF'
import os
os.environ['HF_ENDPOINT'] = 'https://hf-mirror.com'
from huggingface_hub import hf_hub_download
path = hf_hub_download(
    repo_id='comfyanonymous/flux_text_encoders',
    filename='t5xxl_fp8_e4m3fn.safetensors',
    local_dir='/root/autodl-tmp/comfyui_models/text_encoders'
)
print(f'Done: {path} ({os.path.getsize(path)/1e9:.2f}GB)')
PYEOF
```

### Step 3：创建符号链接

ComfyUI 的模型目录在 overlay 盘，重启会丢失。所有模型必须从持久盘 (`/root/autodl-tmp/`) 软链过去：

```bash
# FLUX.1 扩散模型（GGUF 子目录）
ln -sf /root/autodl-tmp/comfyui_models/diffusion_models/GGUF/flux1-dev-Q8_0.gguf \
       /root/autodl-tmp/ComfyUI/models/diffusion_models/GGUF/flux1-dev-Q8_0.gguf

# 文本编码器（与 WAN 2.1 共享）
ln -sf /root/autodl-tmp/comfyui_models/text_encoders/comfyanonymous/flux_text_encoders/clip_l.safetensors \
       /root/autodl-tmp/ComfyUI/models/clip/clip_l.safetensors
ln -sf /root/autodl-tmp/comfyui_models/text_encoders/t5xxl_fp8_e4m3fn.safetensors \
       /root/autodl-tmp/ComfyUI/models/clip/t5xxl_fp8_e4m3fn.safetensors

# VAE
ln -sf /root/autodl-tmp/comfyui_models/vae/ae.safetensors \
       /root/autodl-tmp/ComfyUI/models/vae/ae.safetensors
```

### Step 4：重启 ComfyUI

```bash
fuser -k 8188/tcp 2>/dev/null; sleep 2
cd /root/autodl-tmp/ComfyUI
nohup /root/miniconda3/bin/python3.10 main.py --listen 0.0.0.0 --port 8188 > /tmp/comfyui_boot.log 2>&1 &
sleep 10
curl -s http://localhost:8188/system_stats | head -c 200
```

### Step 5：写入数据库配置

```bash
sqlite3 backend-node/data/drama_generator.db < backend-node/configs/flux2_image_config.sql
```

执行后在前端"AI 配置"页面应能看到 `ComfyUI-FLUX.1-GGUF` 配置项，service_type 为 `image`。

---

## 显存占用

RTX 4080 SUPER 32GB VRAM 的显存分配：

| 模型 | 显存占用 | 备注 |
|------|---------|------|
| FLUX.1 GGUF Q8 + T5-XXL fp8 | ~17GB | 含模型+VAE+文本编码 |
| WAN 2.1 14B fp8 + LoRA | ~16GB | BlockSwap=20 时 |

两者不能同时加载，但 ComfyUI 按需加载模型，生图和生视频是串行流程，不存在冲突。

---

## 工作流参数

| 工作流 | 用途 | 关键参数 |
|--------|------|---------|
| `flux2_gguf_t2i.json` | 文生图（主力） | 20步, euler, **beta调度器**, cfg=7.0 |
| `flux2_gguf_i2i.json` | 图生图（风格转换） | 20步, euler, **beta调度器**, cfg=7.0, denoise=0.7 |

> 注意：工作流文件名保留 `flux2_` 前缀（历史原因），但实际架构是 FLUX.1。

**为什么用 beta 调度器而不是 simple？**
FLUX.1 dev 的参考实现使用 beta 噪声调度，`simple` 调度器会导致出图过曝发白。`beta` + `cfg=7.0` 是 FLUX.1 dev 的标准组合。

---

## 常见问题

**Q: FLUX.1 生图质量够短剧分镜用吗？**
FLUX.1 Dev 在构图、细节、光影方面表现优秀，完全适合做分镜图。角色一致性方面不如专门的 IP-Adapter 方案，但作为分镜参考图足够。

**Q: 出图过曝发白怎么办？**
确认调度器是 `beta` 而不是 `simple`，CFG 设为 7.0 而不是 3.5。`simple` + `cfg=3.5` 会导致 FLUX.1 dev 严重过曝。

**Q: 生图速度慢怎么办？**
FLUX.1 GGUF Q8 在 32GB 卡上单张 1024x576 约 20-25 秒。可以降到 512x288 加速到 8-10 秒，分镜图够用了。

**Q: 为什么不用 FLUX.2？**
FLUX.2 需要 Mistral 3 24B 文本编码器（~14GB），与视频模型不共享，总显存需求翻倍。FLUX.1 与 WAN 2.1 共用 T5-XXL，出图质量几乎无差别，更经济实用。
