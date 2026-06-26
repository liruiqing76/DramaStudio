# Wan2.1 14B I2V 720p 视频生成 — 成功案例配置文档

## 硬件环境

- GPU: RTX 4080 SUPER **16GB VRAM** (实际显示32G,可能是AutoDL内存共享)
- RAM: 540GB
- ComfyUI: v0.24.0
- Python: 3.10.8 (miniconda3)
- PyTorch: 2.5.1+cu121

## 成功验证数据

| 指标 | 值 |
|---|---|
| 分辨率 | 832×480 (接近720p) |
| 帧数 | 41帧 |
| FPS | 16 |
| 生成耗时 | 220s (约3.5分钟) |
| 输出格式 | h264 yuv420p mp4 |
| 文件大小 | 490KB |
| Frame0颜色数 | 30,235 |
| Frame10颜色数 | 62,618 |
| Pixel Std (R/G/B) | 71.5 / 77.9 / 81.1 |
| Mean RGB (Frame10) | (145.3, 158.0, 177.5) — 正常分布 |

**对比废品数据**：废品特征=1566色、std=3-6、mean RGB固定(118.8,88.5,33.7)

---

## 模型文件清单

| 文件 | 大小 | 路径 | 来源 |
|---|---|---|---|
| **扩散模型** | 16G | `/root/autodl-tmp/comfyui_models/diffusion_models/wan_fp8_scaled/I2V/Wan2_1-I2V-14B-720P_fp8_e4m3fn.safetensors` | hf-mirror.com |
| **T5编码器** | 11G | `/root/autodl-tmp/comfyui_models/text_encoders/umt5-xxl-enc-bf16.safetensors` | hf-mirror.com |
| **VAE** | 243M | `/root/autodl-tmp/comfyui_models/vae/Wan2_1_VAE_bf16.safetensors` | hf-mirror.com (Kijai repo) |
| **CLIP Vision** | 1.2G | `/root/autodl-tmp/comfyui_models/clip_vision/clip_vision_h.safetensors` | 预装 |

⚠️ **关键**：T5必须用bf16版(`umt5-xxl-enc-bf16.safetensors`)，不能用fp8 scaled版(会报错"Invalid T5 text encoder model, fp8 scaled is not supported")
⚠️ **关键**：VAE必须用`Wan2_1_VAE_bf16.safetensors`(Kijai仓库特供)，不是原版`wan_2.1_vae.safetensors`

---

## Workflow 参数配置 (成功案例)

### Node 1: WanVideoModelLoader
```json
{
  "model": "Wan2_1-I2V-14B-720P_fp8_e4m3fn.safetensors",
  "base_precision": "fp16",
  "quantization": "fp8_e4m3fn",
  "load_device": "offload_device",
  "attention_mode": "sdpa"
}
```
⚠️ **base_precision必须fp16**，不是bf16！官方示例明确标注。

### Node 2: LoadWanVideoT5TextEncoder
```json
{
  "model_name": "umt5-xxl-enc-bf16.safetensors",
  "precision": "bf16",
  "load_device": "offload_device"
}
```

### Node 3: WanVideoTextEncode
```json
{
  "t5": ["2", 0],
  "model_to_offload": ["1", 0],
  "positive_prompt": "描述文本",
  "negative_prompt": "负面提示词",
  "force_offload": true,
  "device": "gpu"
}
```

### Node 4: WanVideoVAELoader
```json
{
  "model_name": "Wan2_1_VAE_bf16.safetensors",
  "precision": "bf16"
}
```

### Node 5: CLIPVisionLoader
```json
{
  "clip_name": "clip_vision_h.safetensors"
}
```

### Node 6: LoadImage
```json
{
  "image": "输入图片名"
}
```

### Node 7: WanVideoClipVisionEncode
```json
{
  "clip_vision": ["5", 0],
  "image_1": ["6", 0],
  "strength_1": 1.0,
  "strength_2": 0.2,
  "crop": "center",
  "combine_embeds": "average",
  "force_offload": true
}
```
⚠️ **strength_2=0.2** — 不是1.0！官方示例用0.2，太大会导致画质崩。

### Node 8: WanVideoImageToVideoEncode
```json
{
  "vae": ["4", 0],
  "start_image": ["6", 0],
  "width": 832,
  "height": 480,
  "num_frames": 41,
  "noise_aug_strength": 0.03,
  "start_latent_strength": 1.0,
  "end_latent_strength": 1.0,
  "force_offload": true,
  "enable_vae_tiling": true
}
```
⚠️ **noise_aug_strength=0.03** — 不是0！加微量噪声增强鲁棒性。
⚠️ **enable_vae_tiling=true** — 16GB VRAM必须开启，否则OOM。

### Node 9: WanVideoSampler
```json
{
  "model": ["1", 0],
  "image_embeds": ["8", 0],
  "text_embeds": ["3", 0],
  "steps": 20,
  "cfg": 1.0,
  "shift": 5.0,
  "seed": 88888888,
  "force_offload": true,
  "scheduler": "dpm++_sde",
  "riflex_freq_index": 0,
  "denoise_strength": 1.0,
  "image_embeds_strength": "1.0"
}
```
⚠️ **scheduler=dpm++_sde** — 不是unipc！这是官方示例指定的调度器。
⚠️ **cfg=1.0** — wan2.1 I2V标准cfg值，不要调高。

### Node 10: WanVideoDecode
```json
{
  "vae": ["4", 0],
  "samples": ["9", 0],
  "enable_vae_tiling": true,
  "tile_x": 272,
  "tile_y": 272,
  "tile_stride_x": 144,
  "tile_stride_y": 128
}
```

### Node 11: CreateVideo
```json
{
  "images": ["10", 0],
  "fps": 16.0
}
```
⚠️ **fps=16** — wan2.1 I2V官方训练帧率。

### Node 12: SaveVideo
```json
{
  "filename_prefix": "wan21_official_41f",
  "video": ["11", 0],
  "format": "auto",
  "codec": "auto"
}
```
⚠️ 用SaveVideo(format=auto, codec=auto)输出mp4，不要用SaveWEBM(输出vp9 webm)。

---

## 根因分析：为什么之前全是废品

| 参数 | 废品配置 | 正确配置 | 影响 |
|---|---|---|---|
| scheduler | unipc | **dpm++_sde** | 调度器不同导致采样路径完全错误 |
| base_precision | bf16 | **fp16** | 模型加载精度错误 |
| noise_aug_strength | 0.0 | **0.03** | 缺少噪声增强，模型无法正常扩散 |
| strength_2 | 1.0 | **0.2** | CLIP Vision第二强度太高，冲毁画面 |
| VAE文件 | wan_2.1_vae.safetensors | **Wan2_1_VAE_bf16.safetensors** | VAE版本可能影响解码质量 |
| T5 | fp8 scaled版 | **bf16版** | fp8 scaled版被节点拒绝 |

**这些参数全部错误叠加，导致输出mean RGB固定(118.8,88.5,33.7)——推理过程根本没走正确的扩散路径。**

---

## 废品特征识别标准

- 颜色数 < 5000 → 废品
- Pixel Std < 10 → 废品  
- Mean RGB 接近固定值(118,88,33) → 废品
- 文件大小 < 50KB(41帧) → 废品

## 正常视频特征标准

- 颜色数 > 30000 → 正常
- Pixel Std > 70 → 正常
- Mean RGB 有明显通道差异(非固定值) → 正常
- 文件大小 > 400KB(41帧) → 正常

---

## WanVideoWrapper 版本信息

- Git commit: e4e7f41
- ComfyUI版本: 0.24.0
- ⚠️ ComfyUI 0.24.0的object_info API对ComfyExtension格式节点返回空参数，无法通过API查询参数。必须读源码或用已保存workflow模板。

---

## 已知问题 & 注意事项

1. **fp8_e4m3fn量化仍有轻微画质损失** — 官方示例Note节点明确标注"fp8_fast seems to cause huge quality degradation"，但fp8_e4m3fn(非fast版)可用
2. **GGUF Q4_K_M版本reshape报错** — `cannot reshape array of size 10644687 into shape (5120,4200)`，WanVideoModelLoader和UnetLoaderGGUF都无法加载
3. **img_emb检测bug** — WanVideoWrapper model.py L2824-2837: meta device检测误判GGUF为14B蒸馏，skip了img_emb。已patch为`if True:`绕过(仅影响GGUF路径)
4. **execution cache** — 同seed+同输入可能导致节点被缓存跳过，换seed可避免
5. **AutoDL重启会清overlay盘** — 模型必须放autodl-tmp(持久盘)，symlink指向overlay会丢失

---

## 部署路径映射

```
/root/autodl-tmp/comfyui_models/
├── diffusion_models/
│   ├── wan_fp8_scaled/I2V/Wan2_1-I2V-14B-720P_fp8_e4m3fn.safetensors (16G)
│   └── GGUF/wan2.1-i2v-14b-720p-Q4_K_M.gguf → symlink to unet_gguf (不可用)
├── text_encoders/
│   ├── umt5-xxl-enc-bf16.safetensors (11G) ← 正确版本
│   └── umt5_xxl_fp8_e4m3fn.safetensors → symlink (不可用，被节点拒绝)
├── vae/
│   ├── Wan2_1_VAE_bf16.safetensors (243M) ← 正确版本
│   └── wan_2.1_vae.safetensors (243M) ← 旧版本(可能可用但不推荐)
├── clip_vision/
│   └── clip_vision_h.safetensors (1.2G)
└── unet_gguf/
    └── wan2.1-i2v-14b-720p-Q4_K_M.gguf (11G) ← reshape bug，不可用
```
