# Wan2.1 14B I2V 视频生成 — 正确配置规范

> **权威文档。所有视频生成必须严格按此配置执行，不许任何偏离。**
> 历史教训：5个参数全错叠加→220s推理输出纯色废品(mean RGB固定118,88,33)，浪费2天调试时间。

---

## 1. 模型文件（必用版本，不许替换）

| 模型 | 必用文件名 | 大小 | ❌禁用文件 | 原因 |
|---|---|---|---|---|
| 扩散模型 | `Wan2_1-I2V-14B-720P_fp8_e4m3fn.safetensors` | 16G | `wan2.1_i2v_480p_720p_14B_fp8_e4m3fn.safetensors`(旧名同内容可用) | 新名与官方一致 |
| T5编码器 | `umt5-xxl-enc-bf16.safetensors` | 11G | `umt5_xxl_fp8_e4m3fn_scaled.safetensors` | fp8 scaled被LoadWanVideoT5TextEncoder拒绝 |
| VAE | `Wan2_1_VAE_bf16.safetensors` | 243M | `wan_2.1_vae.safetensors` | Kijai仓库bf16版，解码质量更好 |
| CLIP Vision | `clip_vision_h.safetensors` | 1.2G | 无替代 | 唯一版本 |
| GGUF Q4 | ❌不可用 | 11G | `wan2.1-i2v-14b-720p-Q4_K_M.gguf` | reshape bug: size 10644687 ≠ 5120×4200 |

**下载来源**：hf-mirror.com（国内加速）、Kijai/WanVideo_comfy HF仓库（VAE）
**AutoDL部署**：所有模型必须放`/root/autodl-tmp/comfyui_models/`（持久盘），overlay盘重启会清空

---

## 2. Workflow参数（12节点，不许改任何值）

### Node 1 — WanVideoModelLoader
```
model:           Wan2_1-I2V-14B-720P_fp8_e4m3fn.safetensors
base_precision:  fp16          ← ❌不许用bf16！官方标注fp16
quantization:    fp8_e4m3fn    ← fp8_e4m3fn可用；❌fp8_fast画质严重退化
load_device:     offload_device
attention_mode:  sdpa
```

### Node 2 — LoadWanVideoT5TextEncoder
```
model_name:      umt5-xxl-enc-bf16.safetensors  ← ❌不许用fp8 scaled版
precision:       bf16
load_device:     offload_device
                 ← ❌不要加quantization字段！bf16模型无量化参数
```

### Node 3 — WanVideoTextEncode
```
t5:              ["2", 0]
model_to_offload: ["1", 0]
positive_prompt: {{prompt}}
negative_prompt: {{negative_prompt}}
force_offload:   true
device:          gpu
```

### Node 4 — WanVideoVAELoader
```
model_name:      Wan2_1_VAE_bf16.safetensors  ← ❌不许用wan_2.1_vae.safetensors
precision:       bf16
```

### Node 5 — CLIPVisionLoader
```
clip_name:       clip_vision_h.safetensors
```

### Node 6 — LoadImage
```
image:           {{image_url}}
```

### Node 7 — WanVideoClipVisionEncode
```
clip_vision:     ["5", 0]
image_1:         ["6", 0]
strength_1:      1.0
strength_2:      0.2           ← ❌不许用1.0！0.2是官方值，1.0冲毁画面
crop:            center
combine_embeds:  average
force_offload:   true
```

### Node 8 — WanVideoImageToVideoEncode
```
vae:             ["4", 0]
start_image:     ["6", 0]
                 ← ❌不要连clip_embeds到此处！官方示例不连
width:           {{width}}     ← 默认832
height:          {{height}}    ← 默认480
num_frames:      {{frames}}    ← 默认41
noise_aug_strength: 0.03       ← ❌不许用0！0.03是官方值
start_latent_strength: 1.0
end_latent_strength: 1.0
force_offload:   true
enable_vae_tiling: true        ← ❌不许用false！16G VRAM必须开，否则OOM
```

### Node 9 — WanVideoSampler
```
model:           ["1", 0]
image_embeds:    ["8", 0]
text_embeds:     ["3", 0]
steps:           {{steps}}     ← 默认20
cfg:             {{cfg}}       ← 默认1.0，❌不要调高
shift:           5.0           ← 固定值
seed:            {{seed}}      ← ❌不要固定42！会触发execution cache跳过节点
force_offload:   true
scheduler:       dpm++_sde     ← ❌不许用unipc！这是废品根因#1
riflex_freq_index: 0
denoise_strength: 1.0
image_embeds_strength: "1.0"
```

### Node 10 — WanVideoDecode
```
vae:             ["4", 0]
samples:         ["9", 0]
enable_vae_tiling: true        ← ❌不许用false
tile_x:          272
tile_y:          272
tile_stride_x:   144
tile_stride_y:   128
```

### Node 11 — CreateVideo
```
images:          ["10", 0]
fps:             {{fps}}       ← 默认16.0（wan2.1训练帧率）
```

### Node 12 — SaveVideo
```
filename_prefix: {{filename_prefix}}
video:           ["11", 0]
format:          auto          ← ❌不要用SaveWEBM！输出vp9 webm不是mp4
codec:           auto
```

---

## 3. 参数对照表（废品→正确）

| 参数 | 废品值(导致纯色) | 正确值(验证通过) | 错误影响 |
|---|---|---|---|
| scheduler | unipc | **dpm++_sde** | 采样路径完全错误，#1根因 |
| base_precision | bf16 | **fp16** | 模型计算精度不对 |
| noise_aug_strength | 0.0 | **0.03** | 无噪声注入→扩散无法起始 |
| clip_vision strength_2 | 1.0 | **0.2** | 强度太高冲毁画面 |
| VAE文件 | wan_2.1_vae.safetensors | **Wan2_1_VAE_bf16.safetensors** | 解码质量差 |
| T5文件 | fp8_e4m3fn_scaled | **bf16版** | 被节点拒绝报错 |
| clip_embeds→ImageToVideoEncode | 有连接 | **无连接** | 官方示例不连 |
| enable_vae_tiling | false | **true** | 16G VRAM不开会OOM |
| image_embeds_strength | 缺失 | **"1.0"** | 缺失导致默认值不同 |
| seed | 42(固定) | **随机大数** | 固定值触发cache跳过 |

---

## 4. 质量验证标准（每次生成必须检查）

### 废品特征（任一即判定废品）
- 颜色数 < 5000
- Pixel Std (任一通道) < 10
- Mean RGB ≈ (118, 88, 33) 固定值
- 文件大小 < 50KB（41帧时）

### 正常视频特征（必须全部满足）
- 颜色数 > 30000
- Pixel Std > 70
- Mean RGB 各帧自然变化，三通道有明显差异
- 文件大小 > 400KB（41帧时）

### 验证脚本（Python）
```python
import av, numpy as np
c = av.open("output.mp4")
frame = next(c.decode(video=0))
a = frame.to_ndarray(format='rgb24')
colors = len(np.unique(a.reshape(-1, 3), axis=0))
std = (a[:,:,0].std(), a[:,:,1].std(), a[:,:,2].std())
mean = (a[:,:,0].mean(), a[:,:,1].mean(), a[:,:,2].mean())
print(f"colors={colors}, std={std}, mean={mean}")
# 正常: colors>30000, std>70, mean各通道差异明显
# 废品: colors<5000, std<10, mean≈(118,88,33)
```

---

## 5. 性能数据

| 配置 | 分辨率 | 帧数 | 步数 | 耗时 | 文件大小 | 颜色数 |
|---|---|---|---|---|---|---|
| wan2.1 fp8 + 旧图 | 832×480 | 41 | 20 | 220s | 490KB | 30K-62K |
| wan2.1 fp8 + 新图 | 832×480 | 41 | 20 | 250s | ~490KB | 77K-81K |

**预计性能**：832×480/41帧/20步 ≈ 220-250s（RTX 4080 SUPER）

---

## 6. 部署检查清单（每次开机/重启后必须执行）

1. **ComfyUI在线** → `curl http://127.0.0.1:8189/system_stats`
2. **模型文件存在** → `ls -lh` 检查4个必用文件
3. **symlink完整** → AutoDL重启后overlay数据丢失，需重建symlink指向autodl-tmp
4. **img_emb patch生效** → model.py L2824必须是`if True:`（仅GGUF路径需要，fp8路径不需要）
5. **execution cache** → 避免固定seed，每次用随机大数

---

## 7. 已知坑 & 禁止操作

| 坑 | 说明 | 处置 |
|---|---|---|
| fp8_fast量化 | 官方标注"huge quality degradation" | ❌永远不许用 |
| GGUF Q4 reshape | size 10644687 ≠ 5120×4200 | ❌不可用，换fp8_e4m3fn |
| fp8 scaled T5 | 被LoadWanVideoT5TextEncoder拒绝 | ❌必须用bf16版 |
| 固定seed=42 | 触发execution cache跳过节点 | ❌每次随机seed |
| SaveWEBM | 输出vp9 webm不是mp4 | ❌必须用SaveVideo(format=auto) |
| unipc调度器 | 采样路径错误→纯色废品 | ❌必须用dpm++_sde |
| base_precision=bf16 | 模型计算精度错误 | ❌必须用fp16 |
| strength_2=1.0 | CLIP Vision冲毁画面 | ❌必须用0.2 |
| noise_aug=0 | 扩散无法起始 | ❌必须用0.03 |
| clip_embeds→I2VEncode | 官方示例不连此线 | ❌不要连 |
| AutoDL overlay盘 | 重启清空数据 | ✅模型放autodl-tmp |
| ComfyUI 0.24.0 object_info | 对ComfyExtension节点返回空参数 | ✅读源码或用已保存模板 |

---

## 8. 默认值速查

```
width=832  height=480  num_frames=41  fps=16
steps=20   cfg=1.0    shift=5.0       scheduler=dpm++_sde
noise_aug_strength=0.03  strength_2=0.2  base_precision=fp16
enable_vae_tiling=true   image_embeds_strength="1.0"
seed=随机大数(如99999999)
```

**改动任何值前必须先在此文档记录原因+验证结果。否则视为违规操作。**
