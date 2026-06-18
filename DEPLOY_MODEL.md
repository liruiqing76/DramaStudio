# MiniDrama 远程模型部署指南

> Wan2.2 GGUF 视频模型 + FLUX.2 GGUF 生图模型 → AutoDL/SeetaCloud ComfyUI

## 视频模型：Wan2.2 GGUF

| 文件 | 大小 | 位置 |
|------|------|------|
| `Wan2.2-T2V-HighNoise-Q4_K_M.gguf` | 9.0G | `diffusion_models/GGUF/` |
| `Wan2.2-T2V-LowNoise-Q4_K_M.gguf` | 9.0G | `diffusion_models/GGUF/` |
| `Wan2.2-I2V-HighNoise-Q4_K_M.gguf` | 9.0G | `diffusion_models/GGUF/` |
| `Wan2.2-I2V-LowNoise-Q4_K_M.gguf` | 9.0G | `diffusion_models/GGUF/` |
| `umt5_xxl_fp8_e4m3fn_scaled.safetensors` | 6.3G | `text_encoders/` |
| `wan_2.1_vae.safetensors` | 243M | `vae/` |
| `clip_vision_h.safetensors` | 1.2G | `clip_vision/` |

> 需要 ComfyUI-GGUF 自定义节点，已安装。

## 生图模型：FLUX.2 GGUF

### 主模型
```bash
wget -O /root/autodl-tmp/comfyui_models/diffusion_models/GGUF/flux2-dev-Q4_K_M.gguf \
  https://hf-mirror.com/city96/FLUX.2-dev-gguf/resolve/main/flux2-dev-Q4_K_M.gguf
```

### 辅助模型
```bash
wget -O /root/autodl-tmp/comfyui_models/text_encoders/clip_l.safetensors \
  https://hf-mirror.com/comfyanonymous/flux_text_encoders/resolve/main/clip_l.safetensors

wget -O /root/autodl-tmp/comfyui_models/vae/ae.safetensors \
  https://hf-mirror.com/black-forest-labs/FLUX.2-dev/resolve/main/ae.safetensors
```

> 工作流文件：`backend-node/configs/comfyui_workflows/flux2_gguf_t2i.json`
> 数据库配置：`backend-node/configs/flux2_image_config.sql`

## 启动 ComfyUI

```bash
cd /root/ComfyUI
nohup /root/miniconda3/bin/python main.py --listen 0.0.0.0 --port 8188 > /tmp/comfyui.log 2>&1 &
```
