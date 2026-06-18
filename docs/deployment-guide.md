# LocalMiniDrama 全流程部署指南

> **Wan2.1 FP8 + AutoDL + ComfyUI** — 图片/视频全部自部署，TTS用MiniMax云API
>
> 更新: 2026-06-18

---

## 目录

- [架构总览](#架构总览)
- [模型清单](#模型清单)
- [第一步: AutoDL租卡部署ComfyUI](#第一步-autodl租卡部署comfyui)
- [第二步: 下载Wan2.1模型](#第二步-下载wan21模型)
- [第三步: 本地SSH隧道](#第三步-本地ssh隧道)
- [第四步: 验证ComfyUI](#第四步-验证comfyui)
- [第五步: 配置MiniMax TTS](#第五步-配置minimax-tts)
- [第六步: 启动LocalMiniDrama](#第六步-启动localminidrama)
- [第七步: 端到端测试](#第七步-端到端测试)
- [成本估算](#成本估算)
- [常见问题](#常见问题)

---

## 架构总览

```
┌─────────────────────────────────┐        SSH隧道         ┌────────────────────────────┐
│  本地 Windows                    │ ←──────────────────→  │  AutoDL GPU服务器           │
│                                  │   localhost:8188       │                            │
│  LocalMiniDrama (前端3013)       │                       │  ComfyUI :8188             │
│  LocalMiniDrama (后端5679)       │ ─── POST /prompt ──→ │  Wan2.1 FP8 模型            │
│       │                          │                       │  RTX 4090 (24GB)           │
│       ├── 文本 → DeepSeek API    │                       └────────────────────────────┘
│       ├── 图片 → ComfyUI T2I     │
│       ├── 视频 → ComfyUI T2V/I2V │
│       └── 语音 → MiniMax API     │
└─────────────────────────────────┘
```

**数据流:**
1. 用户在前端创建短剧 → 后端调用DeepSeek生成剧本
2. 角色图/场景图 → ComfyUI `wan2.1_fun_inp_1.3B` (T2I)
3. 分镜图 → ComfyUI `wan2.1_fun_inp_1.3B` (T2I，支持参考图)
4. 视频 → ComfyUI `wan2.1_t2v_14B_fp8` (T2V) 或 `wan2.1_i2v_480p_14B_fp8` (I2V)
5. 语音 → MiniMax `speech-02-hd` (云API)

---

## 模型清单

共8个文件，**57 GB**，全部从 `hf-mirror.com/Comfy-Org/Wan_2.1_ComfyUI_repackaged` 下载。

### 基础模型 (7.69 GB) — 所有任务共用

| 文件 | 大小 | 放置目录 |
|------|------|----------|
| `umt5_xxl_fp8_e4m3fn_scaled.safetensors` | 6.27 GB | `models/text_encoders/` |
| `clip_vision_h.safetensors` | 1.18 GB | `models/clip_vision/` |
| `wan_2.1_vae.safetensors` | 0.24 GB | `models/vae/` |

### T2V 文生视频 (15.95 GB)

| 文件 | 大小 | 放置目录 |
|------|------|----------|
| `wan2.1_t2v_14B_fp8_scaled.safetensors` | 13.31 GB | `models/diffusion_models/` |
| `wan2.1_t2v_1.3B_bf16.safetensors` | 2.64 GB | `models/diffusion_models/` |

### I2V 图生视频 (30.54 GB) — 角色一致性核心

| 文件 | 大小 | 放置目录 |
|------|------|----------|
| `wan2.1_i2v_480p_14B_fp8_scaled.safetensors` | 15.27 GB | `models/diffusion_models/` |
| `wan2.1_i2v_720p_14B_fp8_scaled.safetensors` | 15.27 GB | `models/diffusion_models/` |

### T2I 文生图 (2.91 GB)

| 文件 | 大小 | 放置目录 |
|------|------|----------|
| `wan2.1_fun_inp_1.3B_bf16.safetensors` | 2.91 GB | `models/diffusion_models/` |

> ⚠️ 24GB显存跑14B FP8约占15-17GB，I2V时需额外CLIP Vision约1.2GB，总计约18GB，够用。
> 如果显存不够，可只下480P版I2V（省15GB），或用1.3B的T2V（省13GB）。

---

## 第一步: AutoDL租卡部署ComfyUI

### 1.1 选卡

| 推荐GPU | 显存 | 时租 | 说明 |
|---------|------|------|------|
| RTX 4090 | 24GB | ¥2-3/h | 最佳性价比 |
| RTX 3090 | 24GB | ¥1-2/h | 便宜但慢 |
| A100 40GB | 40GB | ¥5-8/h | 阔气，可跑14B不量化 |

- 磁盘选 **60GB** 以上
- 镜像选: **PyTorch 2.1+ / Python 3.10+** 基础镜像（不要选ComfyUI社区镜像，版本太旧）

### 1.2 SSH连上

从AutoDL控制台复制SSH命令，如:

```bash
ssh -p 12345 root@region-1.autodl.pro
```

### 1.3 一键部署

复制项目 `scripts/autodl_deploy_wan21.sh` 到服务器，或直接执行:

```bash
cd /root/autodl-tmp

# 安装 ComfyUI
git clone https://github.com/comfyanonymous/ComfyUI.git
cd ComfyUI
pip install -r requirements.txt -i https://mirrors.aliyun.com/pypi/simple/

# 安装 aria2c (多线程下载)
apt-get update -qq && apt-get install -y -qq aria2

# 下载模型
mkdir -p models/text_encoders models/clip_vision models/vae models/diffusion_models

HF="https://hf-mirror.com/Comfy-Org/Wan_2.1_ComfyUI_repackaged/resolve/main/split_files"

# 基础模型
aria2c -x 16 -s 16 -d models/text_encoders -o umt5_xxl_fp8_e4m3fn_scaled.safetensors "${HF}/text_encoders/umt5_xxl_fp8_e4m3fn_scaled.safetensors"
aria2c -x 16 -s 16 -d models/clip_vision -o clip_vision_h.safetensors "${HF}/clip_vision/clip_vision_h.safetensors"
aria2c -x 16 -s 16 -d models/vae -o wan_2.1_vae.safetensors "${HF}/vae/wan_2.1_vae.safetensors"

# T2V
aria2c -x 16 -s 16 -d models/diffusion_models -o wan2.1_t2v_14B_fp8_scaled.safetensors "${HF}/diffusion_models/wan2.1_t2v_14B_fp8_scaled.safetensors"
aria2c -x 16 -s 16 -d models/diffusion_models -o wan2.1_t2v_1.3B_bf16.safetensors "${HF}/diffusion_models/wan2.1_t2v_1.3B_bf16.safetensors"

# I2V
aria2c -x 16 -s 16 -d models/diffusion_models -o wan2.1_i2v_480p_14B_fp8_scaled.safetensors "${HF}/diffusion_models/wan2.1_i2v_480p_14B_fp8_scaled.safetensors"
aria2c -x 16 -s 16 -d models/diffusion_models -o wan2.1_i2v_720p_14B_fp8_scaled.safetensors "${HF}/diffusion_models/wan2.1_i2v_720p_14B_fp8_scaled.safetensors"

# T2I
aria2c -x 16 -s 16 -d models/diffusion_models -o wan2.1_fun_inp_1.3B_bf16.safetensors "${HF}/diffusion_models/wan2.1_fun_inp_1.3B_bf16.safetensors"
```

> 💡 AutoDL已预设 `HF_ENDPOINT=https://hf-mirror.com`，aria2c下载速度约50-80MB/s，57GB约15-20分钟。
> 断了重跑aria2c会自动续传。

### 1.4 启动ComfyUI

```bash
cd /root/autodl-tmp/ComfyUI
nohup python main.py --listen 0.0.0.0 --port 8188 > /root/autodl-tmp/comfyui.log 2>&1 &

# 检查是否启动成功
tail -20 /root/autodl-tmp/comfyui.log
# 看到 "To see the GUI go to: http://0.0.0.0:8188" 即成功
```

---

## 第二步: 下载Wan2.1模型

> 已包含在第一步1.3中，此步可跳过。

---

## 第三步: 本地SSH隧道

在Windows上打开终端（Git Bash / PowerShell / CMD均可）:

```bash
# 把 <PORT> 和 <HOST> 替换为AutoDL控制台显示的值
ssh -L 8188:localhost:8188 -N -o ServerAliveInterval=30 root@<HOST> -p <PORT>
```

> - `-L 8188:localhost:8188`: 把远程8188映射到本地8188
> - `-N`: 不开远程shell，只做端口转发
> - `-o ServerAliveInterval=30`: 每30秒发心跳防断开
> - **此窗口不能关！** 关了隧道就断

### 验证隧道

浏览器打开 http://localhost:8188 ，看到ComfyUI界面即成功。

---

## 第四步: 验证ComfyUI

### 4.1 API连通测试

```bash
curl http://localhost:8188/system_stats
```

返回JSON包含GPU信息即正常。

### 4.2 模型检测

```bash
# 列出已加载的模型
curl http://localhost:8188/object_info/UNETLoader
```

返回包含 `wan2.1_t2v_14B_fp8_scaled.safetensors` 即模型已就位。

### 4.3 手动生图测试

1. 浏览器打开 http://localhost:8188
2. 右键画布 → Add Node → loadors → `UNETLoader`
3. 选 `wan2.1_fun_inp_1.3B_bf16.safetensors`
4. 搭一个简单workflow: UNETLoader → CLIPLoader(wan) → CLIPTextEncode → KSampler → VAEDecode → SaveImage
5. 点击 Queue Prompt，能出图即全部正常

---

## 第五步: 配置MiniMax TTS

### 5.1 获取API Key

1. 注册 https://platform.minimaxi.com/
2. 创建应用 → 获取 API Key 和 Group ID
3. 充值（新用户有免费额度）

### 5.2 在LocalMiniDrama中配置

1. 启动前端 http://localhost:3013
2. 右上角 **AI配置** → **语音合成(TTS)** Tab
3. 找到 `MiniMax-T2A` 配置项
4. 填入:
   - **API Key**: 你的MiniMax API Key
   - **Settings** 中加 `group_id`: 你的Group ID

---

## 第六步: 启动LocalMiniDrama

### 6.1 启动后端

```bash
cd D:\zmzc-code\ai-drama-refs\LocalMiniDrama\backend-node
npm start
```

后端运行在 http://localhost:5679

### 6.2 启动前端

```bash
cd D:\zmzc-code\ai-drama-refs\LocalMiniDrama\frontweb
npm run dev
```

前端运行在 http://localhost:3013

### 6.3 或用一键启动

```bash
cd D:\zmzc-code\ai-drama-refs\LocalMiniDrama
start.bat
```

---

## 第七步: 端到端测试

### 7.1 测试文本生成

1. 前端创建新短剧
2. 输入主题，点"生成剧本"
3. ✅ DeepSeek返回剧本内容

### 7.2 测试图片生成

1. 在角色管理中，点"生成角色图"
2. ✅ ComfyUI收到请求，返回图片
3. 观察后端日志: `[ComfyUI-T2I] 图片生成完成`

### 7.3 测试视频生成

1. 选择分镜，点"生成视频"
2. ✅ ComfyUI收到T2V workflow
3. 观察后端日志: `[ComfyUI poll] 视频生成完成`

### 7.4 测试语音合成

1. 选择分镜对话，点"生成语音"
2. ✅ MiniMax返回音频

### 7.5 完整流程

1. 创建短剧 → 生成剧本 ✅
2. 创建角色 → 生成角色图 (ComfyUI T2I) ✅
3. 生成分镜图 (ComfyUI T2I + 参考图) ✅
4. 生成视频 (ComfyUI T2V/I2V) ✅
5. 生成语音 (MiniMax TTS) ✅
6. 合成短剧 ✅

---

## 成本估算

### AutoDL GPU费用

| GPU | 时租 | 一集耗时 | 一集GPU成本 |
|-----|------|---------|------------|
| RTX 4090 | ¥2.5/h | ~1.5h | ¥3.75 |
| RTX 3090 | ¥1.5/h | ~2.5h | ¥3.75 |

> 一集: 6个分镜 × (1张图 ~30s + 1段视频 ~10min) ≈ 1.5小时

### 各环节费用

| 环节 | 之前 | 现在 | 节省 |
|------|------|------|------|
| 文本 | DeepSeek ¥0.01/集 | 不变 | - |
| 图片(30张) | 通义万相 ¥15/集 | **免费**(ComfyUI) | ¥15 |
| 视频(6段) | 未跑通 | **免费**(ComfyUI) | - |
| 语音 | 未配 | MiniMax ¥0.5/集 | - |
| **合计** | **¥15+/集(不完整)** | **¥4-5/集(全流程)** | **¥10+/集** |

---

## 数据库配置参考

当前 `ai_service_configs` 表的关键记录:

| ID | 服务类型 | 名称 | Provider | Base URL | Protocol | 默认 |
|----|---------|------|----------|----------|----------|------|
| 6 | text | DeepSeek-V4-Flash | deepseek | https://api.deepseek.com/v1 | openai | ✅ |
| 8 | video | ComfyUI-Wan2.1 | comfyui | http://localhost:8188 | comfyui | ✅ |
| 9 | image | ComfyUI-Wan2.1-T2I | comfyui | http://localhost:8188 | comfyui | ✅ |
| 10 | storyboard_image | ComfyUI-Wan2.1-T2I-分镜 | comfyui | http://localhost:8188 | comfyui | ✅ |
| 11 | tts | MiniMax-T2A | minimax | https://api.minimax.chat/v1 | minimax | ✅ |

> 旧的通义万相配置(ID=2,3)保留但 `is_default=0`，前端可切换回云API作为备用。

## Workflow文件

| 文件 | 用途 | 节点 |
|------|------|------|
| `wan21_t2v.json` | 文生视频 | UNETLoader → CLIPLoader → CLIPTextEncode → KSampler → VAEDecode → SaveVideo |
| `wan21_i2v.json` | 图生视频 | 同上 + CLIPVisionLoader → CLIPVisionEncode |
| 内置 `buildWan21T2IWorkflow()` | 图片生成兜底 | UNETLoader → CLIPLoader → CLIPTextEncode → KSampler → VAEDecode → SaveImage |

## 代码改动清单

| 文件 | 改动 |
|------|------|
| `imageClient.js` | +`comfyui`协议路由, +`callComfyUIImageApi()`, +`buildWan21T2IWorkflow()`, +`substituteImagePlaceholders()` |
| `videoClient.js` | `buildDefaultLtxWorkflow` → `buildDefaultWan21Workflow`, 默认workflow改为`wan21_t2v.json` |
| `AIConfigContent.vue` | image/storyboard_image/video下拉加ComfyUI, `providerProtocolMap`加comfyui |
| `config.yaml` | `default_image_provider: comfyui` |
| `drama_generator.db` | +ID=9 image/comfyui, +ID=10 storyboard_image/comfyui, +ID=11 tts/minimax |

---

## 常见问题

### Q: ComfyUI报 "node not found: UNETLoader"

ComfyUI版本太旧。更新:
```bash
cd /root/autodl-tmp/ComfyUI
git pull
pip install -r requirements.txt
```

### Q: 生成报OOM (Out of Memory)

14B FP8约占17GB显存，24GB卡刚好够。如果还OOM:
1. 关掉其他占用GPU的程序
2. 用1.3B模型: `wan2.1_t2v_1.3B_bf16`
3. 降低分辨率: 480P而非720P

### Q: SSH隧道经常断

加保活参数:
```bash
ssh -L 8188:localhost:8188 -N -o ServerAliveInterval=15 -o ServerAliveCountMax=3 root@<HOST> -p <PORT>
```

### Q: 图片生成了但前端看不到

检查 `storage.local_path` 配置。ComfyUI返回的 `http://localhost:8188/view?filename=xxx` 需要SSH隧道才能下载，确保隧道未断。

### Q: workflow提交报 "node validation error"

ComfyUI节点名可能随版本变化。从ComfyUI UI手动搭workflow后，导出API格式JSON替换 `wan21_t2v.json`。

### Q: 想切回通义万相云API

前端AI配置页面，把image/video的默认配置从ComfyUI切到通义万相即可。不需要改代码。
