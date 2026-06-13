# 查看启动日志
ssh -p 23011 root@connect.westc.seetacloud.com "cat /tmp/comfyui_boot.log"

# 检查服务是否运行
ssh -p 23011 root@connect.westc.seetacloud.com "curl -s http://localhost:8188/system_stats"

# 查看 ComfyUI 进程
ssh -p 23011 root@connect.westc.seetacloud.com "ps aux | grep main.py"
# LocalMiniDrama 远程模型部署指南

> 将 LTX Video 视频生成模型部署到 AutoDL 等 GPU 云服务器，通过 SSH 隧道供本地使用。

---

## 目录

- [硬件要求](#硬件要求)
- [第一部分：远程服务器部署](#第一部分远程服务器部署)
  - [1.1 租用 GPU 服务器](#11-租用-gpu-服务器)
  - [1.2 安装 ComfyUI](#12-安装-comfyui)
  - [1.3 安装 LTX Video 自定义节点](#13-安装-ltx-video-自定义节点)
  - [1.4 下载模型文件](#14-下载模型文件)
  - [1.5 启动 ComfyUI 服务](#15-启动-comfyui-服务)
  - [1.6 验证部署](#16-验证部署)
  - [1.7 开机自启动](#17-开机自启动)
- [第二部分：本地开发环境](#第二部分本地开发环境)
  - [2.1 前置条件](#21-前置条件)
  - [2.2 配置 SSH 隧道](#22-配置-ssh-隧道)
  - [2.3 一键启动](#23-一键启动)
- [第三部分：验证与测试](#第三部分验证与测试)
- [第四部分：常见问题](#第四部分常见问题)

---

## 硬件要求

| 组件 | 最低配置 | 推荐配置 |
|------|---------|---------|
| GPU | 24GB VRAM (RTX 3090) | 32GB+ VRAM (RTX 4080 S / A100) |
| 内存 | 32GB | 64GB |
| 存储 | 50GB | 100GB+ SSD |
| 网络 | 10Mbps+ | 50Mbps+ |

> **实测配置**: RTX 4080 SUPER 32GB VRAM + 30GB 系统盘 + 50GB 数据盘，生成 2 秒视频约需 2-3 分钟。

---

## 第一部分：远程服务器部署

### 1.1 租用 GPU 服务器

推荐平台：

| 平台 | 网址 | 特点 |
|------|------|------|
| AutoDL | https://www.autodl.com | 按量计费，镜像丰富，国内速度快 |
| 恒源云 | https://www.gpushare.com | 性价比高 |
| SeetaCloud | - | 本次活动使用 |

**关键配置**：
- 选择包含 `CUDA 12.1+` 的 PyTorch 镜像
- 数据盘至少 50GB（模型文件约 10-30GB）
- 开启 SSH 公网访问

> **本次示例服务器信息**：
> ```
> 地址: connect.westc.seetacloud.com
> 端口: 23011
> 用户: root
> ComfyUI: 8188 端口
> ```

---

### 1.2 安装 ComfyUI

```bash
# SSH 登录服务器
ssh -p 23011 root@connect.westc.seetacloud.com

# 安装 ComfyUI
cd /root
git clone https://github.com/comfyanonymous/ComfyUI.git
cd ComfyUI

# 安装依赖（使用镜像加速）
pip install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple
pip install sentencepiece tiktoken -i https://pypi.tuna.tsinghua.edu.cn/simple
```

---

### 1.3 安装 LTX Video 自定义节点

ComfyUI 的 LTX Video 支持通过核心节点实现，无需额外安装插件。

**确认核心节点可用**：
- `CheckpointLoaderSimple` — 加载模型
- `CLIPLoader` (type: `ltxv`) — 加载 T5 文本编码器
- `CLIPTextEncode` — 文本编码
- `EmptyLTXVLatentVideo` — 创建视频潜在空间
- `LTXVScheduler` — 调度器
- `LTXVConditioning` — 条件编码
- `LTXVImgToVideo` — 图生视频
- `KSamplerSelect` — 采样器选择
- `SamplerCustom` — 自定义采样
- `VAEDecode` — VAE 解码
- `VHS_VideoCombine` — 视频合成输出

---

### 1.4 下载模型文件

#### 方案 A：ModelScope 下载（推荐，国内快）

```bash
# 设置镜像
pip install modelscope -i https://pypi.tuna.tsinghua.edu.cn/simple

# 下载 LTX Video 2B 模型（约 8.9GB，推荐先用这个测试）
python3 -c "
from modelscope import snapshot_download
snapshot_download('Lightricks/LTX-Video', cache_dir='/root/autodl-tmp/modelscope_cache')
"
```

#### 方案 B：HuggingFace 下载

```bash
# 设置 HF 镜像
export HF_ENDPOINT=https://hf-mirror.com

# 安装 huggingface_hub
pip install huggingface_hub -i https://pypi.tuna.tsinghua.edu.cn/simple

# 下载
python3 -c "
from huggingface_hub import snapshot_download
snapshot_download('Lightricks/LTX-Video', cache_dir='/root/autodl-tmp/modelscope_cache')
"
```

#### 可用模型列表

| 模型 | 大小 | 速度 | 质量 | 推荐场景 |
|------|------|------|------|----------|
| `ltx-video-2b-v0.9.5.safetensors` | 8.9GB | ⚡ 快 | ★★★ | 快速测试、批量生成 |
| `ltx-video-13b-distilled.safetensors` | 13GB | ⚡⚡ 较快 | ★★★★ | **推荐日常使用** |
| `ltx-video-13b.safetensors` | 26GB | 🐢 慢 | ★★★★★ | 最终出片 |

#### 模型文件组织结构

下载完成后，确保模型文件在 ComfyUI 的 `models/checkpoints/` 目录下可见：

```bash
# 创建符号链接（推荐，避免复制大文件）
ln -s /root/autodl-tmp/modelscope_cache/Lightricks/LTX-Video /root/ComfyUI/models/checkpoints/LTX-Video

# 或者直接复制 safetensors 文件
cp /root/autodl-tmp/modelscope_cache/Lightricks/LTX-Video/*.safetensors /root/ComfyUI/models/checkpoints/
```

T5 文本编码器需要在 `models/clip/` 目录：

```bash
# 下载 T5 XXL 编码器
python3 -c "
from huggingface_hub import snapshot_download
snapshot_download('google/t5-v1_1-xxl', cache_dir='/root/autodl-tmp/t5_cache',
                  allow_patterns=['config.json', 'spiece.model', 'tokenizer_config.json',
                                  'special_tokens_map.json', 'added_tokens.json'])
"

# 链接到 ComfyUI clip 目录
ln -s /root/autodl-tmp/t5_cache/models--google--t5-v1_1-xxl/snapshots/*/* /root/ComfyUI/models/clip/t5xxl_fp8_e4m3fn.safetensors
```

---

### 1.5 启动 ComfyUI 服务

```bash
cd /root/ComfyUI

# 前台运行（测试用）
python3 main.py --listen 0.0.0.0 --port 8188

# 后台运行
nohup python3 main.py --listen 0.0.0.0 --port 8188 > /tmp/comfyui.log 2>&1 &
```

启动成功标志：
```
[INFO] Starting server
[INFO] To see the GUI go to: http://0.0.0.0:8188
```

---

### 1.6 验证部署

```bash
# 检查服务是否运行
curl http://localhost:8188/system_stats

# 查看已注册节点
curl -s http://localhost:8188/object_info | python3 -c "
import sys, json
d = json.load(sys.stdin)
ltx = [k for k in d if 'LTX' in k.upper()]
print(f'总节点数: {len(d)}')
print(f'LTX 相关节点: {ltx}')
"
```

预期输出应包含：
```
LTX 相关节点: ['EmptyLTXVLatentVideo', 'LTXVScheduler', 'LTXVConditioning', 'LTXVImgToVideo', ...]
```

**测试生成一个视频**：

```bash
python3 << 'EOF'
import json, urllib.request

BASE = "http://localhost:8188"

workflow = {
    "1": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": "ltx-video-2b-v0.9.5.safetensors"}},
    "2": {"class_type": "CLIPLoader", "inputs": {"clip_name": "t5xxl_fp8_e4m3fn.safetensors", "type": "ltxv"}},
    "3": {"class_type": "CLIPTextEncode", "inputs": {"text": "A beautiful sunset over the ocean, cinematic", "clip": ["2", 0]}},
    "4": {"class_type": "CLIPTextEncode", "inputs": {"text": "low quality, blurry, distorted", "clip": ["2", 0]}},
    "5": {"class_type": "EmptyLTXVLatentVideo", "inputs": {"width": 768, "height": 512, "length": 49, "batch_size": 1}},
    "6": {"class_type": "LTXVScheduler", "inputs": {"steps": 20, "max_shift": 2.05, "base_shift": 0.95, "stretch": True, "terminal": 0.1, "latent": ["5", 0]}},
    "7": {"class_type": "LTXVConditioning", "inputs": {"positive": ["3", 0], "negative": ["4", 0], "frame_rate": 25.0}},
    "8": {"class_type": "KSamplerSelect", "inputs": {"sampler_name": "euler"}},
    "9": {"class_type": "SamplerCustom", "inputs": {"model": ["1", 0], "add_noise": True, "noise_seed": 42, "cfg": 3.0, "positive": ["7", 0], "negative": ["7", 1], "sampler": ["8", 0], "sigmas": ["6", 0], "latent_image": ["5", 0]}},
    "10": {"class_type": "VAEDecode", "inputs": {"samples": ["9", 0], "vae": ["1", 2]}},
    "11": {"class_type": "VHS_VideoCombine", "inputs": {"images": ["10", 0], "frame_rate": 25, "loop_count": 1, "filename_prefix": "deploy_test", "format": "video/h264-mp4", "pingpong": False, "save_output": True}}
}

req = urllib.request.Request(f"{BASE}/prompt", data=json.dumps({"prompt": workflow}).encode(), headers={"Content-Type": "application/json"})
resp = json.loads(urllib.request.urlopen(req).read())
print(f"prompt_id: {resp['prompt_id']}")
EOF
```

部署成功后，视频将保存在 `/root/ComfyUI/output/deploy_test_00001.mp4`。

---

### 1.7 开机自启动

AutoDL / SeetaCloud 等 GPU 云平台使用容器环境，**没有 systemd**，但有平台自带的启动钩子。

#### ✅ AutoDL / SeetaCloud 方案（推荐，已实测）

平台在容器启动时会自动调用 `/init/bin/customer.cmd.sh`，该脚本会执行 `/etc/autodl.sh`（如果存在）。

创建 `/etc/autodl.sh`：

```bash
cat > /etc/autodl.sh << 'EOF'
#!/bin/bash
# ComfyUI 开机自启动 (AutoDL/SeetaCloud)

log() { echo "[ComfyUI-Boot $(date '+%H:%M:%S')] $*"; }

# 1. 等待网络就绪
log "等待网络..."
for i in $(seq 1 30); do
    ping -c1 -W1 8.8.8.8 >/dev/null 2>&1 && break
    sleep 2
done

# 2. 等待 GPU 就绪
log "等待 GPU..."
for i in $(seq 1 30); do
    nvidia-smi >/dev/null 2>&1 && break
    sleep 2
done

# 3. 环境变量
export PATH="/root/miniconda3/bin:$PATH"
export CUDA_VISIBLE_DEVICES=0
export PYTHONUNBUFFERED=1

# 4. 清理旧进程
log "清理旧进程..."
fuser -k 8188/tcp 2>/dev/null || true
sleep 2

# 5. 启动 ComfyUI
log "启动 ComfyUI..."
cd /root/ComfyUI
nohup /root/miniconda3/bin/python3.10 main.py --listen 0.0.0.0 --port 8188 > /tmp/comfyui_boot.log 2>&1 &

log "ComfyUI 已启动"
log "日志: /tmp/comfyui_boot.log"
EOF

chmod +x /etc/autodl.sh
```

**启动链路**（服务器开机时自动触发）：
```
容器启动 → /init/bin/customer.cmd.sh → bash /etc/autodl.sh → ComfyUI 启动
```

**手动测试**（确认脚本能正常工作）：
```bash
fuser -k 8188/tcp 2>/dev/null; true
bash /etc/autodl.sh

# 等待 15 秒后检查
sleep 15
curl http://localhost:8188/system_stats  # 应返回 200
```

#### 备选 A：systemd（传统服务器 / 裸机）

```bash
cat > /etc/systemd/system/comfyui.service << 'EOF'
[Unit]
Description=ComfyUI Video Generation Service
After=network.target
[Service]
Type=simple
User=root
WorkingDirectory=/root/ComfyUI
ExecStart=/root/miniconda3/bin/python3 main.py --listen 0.0.0.0 --port 8188
Restart=on-failure
RestartSec=10
[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload && systemctl enable comfyui && systemctl start comfyui
```

#### 备选 B：crontab @reboot（通用）

```bash
(crontab -l 2>/dev/null; echo '@reboot sleep 30 && cd /root/ComfyUI && nohup /root/miniconda3/bin/python3.10 main.py --listen 0.0.0.0 --port 8188 > /tmp/comfyui_boot.log 2>&1 &') | crontab -
```

---

## 第二部分：本地开发环境

### 2.1 前置条件

- **Node.js** ≥ 18.x ([下载](https://nodejs.org/))
- **npm** ≥ 9.x
- **SSH 客户端** (Windows 10+ 自带 OpenSSH)
- 推荐：Git Bash（SSH 隧道更稳定）

### 2.2 配置 SSH 隧道

编辑项目根目录下的 `ssh_config.txt`：

```ini
HOST=connect.westc.seetacloud.com    # 你的服务器地址
PORT=23011                            # SSH 端口
USER=root                             # 登录用户
REMOTE_PORT=8188                      # ComfyUI 端口
LOCAL_PORT=8188                       # 本地映射端口
```

**手动建立隧道（不使用一键脚本）**：

```bash
# Windows PowerShell / CMD
ssh -p 23011 -L 8188:localhost:8188 root@connect.westc.seetacloud.com -N

# 保持此窗口运行，不要关闭
```

### 2.3 一键启动

```bash
# 双击运行
start.bat
```

脚本会自动完成：
1. ✅ 检查 Node.js 是否安装
2. ✅ 自动安装 npm 依赖（首次）
3. ✅ 初始化数据库
4. ✅ 清理端口占用
5. ✅ 建立 SSH 隧道（连接远程 ComfyUI）
6. ✅ 验证 ComfyUI 服务状态
7. ✅ 启动后端 API（端口 5679）
8. ✅ 启动前端页面（端口 3013）
9. ✅ 自动打开浏览器

**手动启动（不使用一键脚本）**：

```bash
# 终端 1：SSH 隧道
ssh -p 23011 -L 8188:localhost:8188 root@connect.westc.seetacloud.com -N

# 终端 2：后端
cd backend-node
npm install    # 首次
npm run dev

# 终端 3：前端
cd frontweb
npm install    # 首次
npm run dev
```

---

## 第三部分：验证与测试

### 端到端测试

1. 打开浏览器访问 `http://127.0.0.1:3013`
2. 创建或打开一个短剧项目
3. 进入故事板编辑页面
4. 点击「生成视频」
5. 查看任务状态，确认视频生成成功

### API 测试

```bash
# 健康检查
curl http://127.0.0.1:5679/api/health

# 视频生成测试
curl -X POST http://127.0.0.1:5679/api/videos/generate \
  -H "Content-Type: application/json" \
  -d '{"prompt": "A cat walking in a garden, cinematic", "duration": 2}'
```

### ComfyUI 直连测试

```bash
# 通过 SSH 隧道访问 ComfyUI Web UI
# 浏览器打开
http://127.0.0.1:8188
```

可以在 ComfyUI Web UI 中拖拽节点测试 LTX Video 生成效果。

---

## 第四部分：常见问题

### Q: SSH 隧道连接失败

```bash
# 测试 SSH 连通性
ssh -p 23011 root@connect.westc.seetacloud.com "echo ok"

# 检查本地端口是否被占用
netstat -ano | findstr :8188

# 杀掉占用进程
taskkill /PID <PID> /F
```

### Q: ComfyUI 返回 400 或 "no prompt"

检查 ComfyUI 是否正常运行：
```bash
curl http://localhost:8188/system_stats
```

### Q: 视频生成超时

- 2B 模型：约 2-3 分钟
- 13B 模型：约 5-10 分钟
- 检查 `config.yaml` 中 `video.generation_timeout_minutes` 配置
- 检查 GPU 显存：`nvidia-smi`

### Q: 显存不足 (OOM)

```bash
# 查看显存使用
nvidia-smi

# 降低分辨率或帧数
# 在 workflow 中调整:
#   width: 512, height: 288  (最省显存)
#   length: 25               (1 秒视频)
#   batch_size: 1
```

### Q: 如何在多台电脑上使用

每台电脑分别执行：

```bash
# 电脑 A
ssh -p 23011 -L 8188:localhost:8188 root@your-server.com -N
cd backend-node && npm run dev
cd frontweb && npm run dev

# 电脑 B（同一服务器，不同本地端口）
ssh -p 23011 -L 8189:localhost:8188 root@your-server.com -N
# 然后修改 backend-node/configs/config.yaml 中的 comfyui 地址为 localhost:8189
```

---

## 附录：ComfyUI LTX Video 完整工作流参考

### 文生视频 (T2V)

```
CheckpointLoaderSimple ──→ MODEL ──→ SamplerCustom
         │                              ↑
         ├──→ CLIP ──→ CLIPTextEncode(pos) ──→ LTXVConditioning ──→ positive
         │          └─→ CLIPTextEncode(neg) ──→ LTXVConditioning ──→ negative
         │
         ├──→ VAE ──→ VAEDecode ←── LATENT ←── SamplerCustom
         │              ↑
         │              │
EmptyLTXVLatentVideo ──→ LTXVScheduler ──→ SIGMAS ──→ SamplerCustom
```

### 图生视频 (I2V)

```
CheckpointLoaderSimple ──→ MODEL ──→ SamplerCustom
         │                              ↑
         ├──→ CLIP ──→ CLIPTextEncode(pos) ──→ LTXVImgToVideo ──→ positive / negative / LATENT
         │          └─→ CLIPTextEncode(neg) ──→ LTXVImgToVideo     │
         │                                         ↑               ↓
         ├──→ VAE ───────────────────────────→ LTXVImgToVideo    LTXVScheduler ──→ SIGMAS
         │                                         ↑                                 ↓
      LoadImage ───────────────────────────→ LTXVImgToVideo                     SamplerCustom
                                                                                     ↓
         └──→ VAE ──→ VAEDecode ←── LATENT ←────────────────────────────────── SamplerCustom
                        ↓
                  VHS_VideoCombine ──→ video.mp4
```

---

> **文档版本**: v1.0 | **最后更新**: 2026-06-14 | **测试环境**: RTX 4080 SUPER + ComfyUI + LTX Video 2B
