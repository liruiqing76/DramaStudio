# AI 配置指南

**导航：[项目主页](../README.md) | [快速开始](quickstart.md) | [English](en.md)**

---

## 目录

- [配置入口](#配置入口)
- [三类模型配置](#三类模型配置)
- [阿里云 DashScope（通义）](#阿里云-dashscope通义)
  - [申请 API Key](#申请-api-key)
  - [可用模型](#可用模型)
  - [配置示例](#配置示例)
- [火山引擎 Volcengine（豆包）](#火山引擎-volcengine豆包)
  - [申请 API Key](#申请-api-key-1)
  - [可用模型](#可用模型-1)
  - [配置示例](#配置示例-1)
- [本地部署模型（Ollama 等）](#本地部署模型ollama-等)
- [远程 ComfyUI 服务器（GPU 云服务器）](#远程-comfyui-服务器gpu-云服务器)
  - [方案架构](#方案架构)
  - [快速配置步骤](#快速配置步骤)
  - [完整配置指南](#完整配置指南)
  - [性能建议](#性能建议)
- [其他 OpenAI 兼容接口](#其他-openai-兼容接口)
- [一键配置功能](#一键配置功能)
- [连接测试](#连接测试)
- [常见问题](#常见问题)

---

## 配置入口

点击软件右上角 **「AI 配置」** 按钮，进入 AI 服务管理页面。

页面分为三个 Tab：
- **文本生成** — 用于生成剧本、分镜脚本、提示词等
- **图片生成** — 用于生成角色图、场景图、分镜图
- **视频生成** — 用于生成分镜视频片段

每类模型可独立配置不同的服务商和模型，互不影响。

---

## 三类模型配置

| 类型 | 用途 | 推荐服务商 |
|------|------|----------|
| 文本生成 | 剧本生成、角色提取、分镜脚本、提示词优化 | 通义 Qwen、豆包 Pro |
| 图片生成 | 角色形象图、场景背景图、分镜静帧图 | 通义万象、豆包图片 |
| 视频生成 | 分镜视频片段 | **WAN 3.0 / MiniMax Hailuo-03 / Agnes Video 2.5**（见下文「视频模型」） |

---

## 视频模型（三家主力）

当前版本视频生成聚焦以下三家，配置时请从「AI 配置 → 视频生成」中选择对应服务商与模型。

| 服务商 | 模型 ID | 模式说明 |
|--------|---------|----------|
| 阿里云 DashScope（通义万相） | `wan3.0-t2v` | 文生视频 |
| | `wan3.0-i2v` | 图生视频（单图驱动） |
| | `wan3.0-kf2v` | 首尾帧生视频 |
| | `wan3.0-r2v` | 参考图生视频 |
| MiniMax（海螺） | `MiniMax-Hailuo-03` / `MiniMax-Hailuo-03-Fast` | 图生视频 |
| Agnes AI | `agnes-video-2.5-flash` / `agnes-video-2.5` | 文生视频 / 关键帧（首尾帧）/ 参考图 |

> 其他厂商的适配器代码仍保留在 `backend-node/src/services/videoClient.js`，
> 如需恢复只需在 `frontweb/src/components/AIConfigContent.vue` 的
> `providerConfigs.video` 中加回条目。

---

## 一致性校验

生成前可用只读体检发现潜在的跨集一致性问题（不修改任何数据）：

```
GET /api/v1/dramas/:id/consistency
```

返回 `{ ok, findings, counts }`，`findings` 为问题清单：

| code | severity | 含义 |
|------|----------|------|
| `char_name_empty` | warning | 存在未命名角色 |
| `char_dup_name` | warning | 同剧内角色重名，跨集极易出现形象分裂 |
| `char_no_anchor` | warning | 角色缺少身份锚点 / 外观描述，跨集易形象漂移 |
| `scene_no_location` | info | 场景缺少 `location` |
| `scene_cross_episode` | info | 同一地点跨多集出现，各集独立生成场景图需注意视觉一致 |
| `scene_dup_in_episode` | info | 同一集内同地点且同时间重复，可考虑复用同一场景素材 |

`ok` 为 `true` 表示无 warning 级问题。

---

## 阿里云 DashScope（通义）

### 申请 API Key

1. 访问 [阿里云百炼控制台](https://bailian.console.aliyun.com/)
2. 注册/登录阿里云账号
3. 进入「模型广场」，开通你需要的模型（文本类、图片类等）
4. 左侧菜单点击「API-KEY 管理」，创建新的 API Key
5. 复制 API Key（以 `sk-` 开头）

> 新用户通常有免费额度，建议先用免费额度测试。

### 可用模型

**文本生成：**
| 模型名 | 说明 |
|--------|------|
| `qwen-turbo` | 速度快、成本低，适合批量生成 |
| `qwen-plus` | 性能均衡，推荐日常使用 |
| `qwen-max` | 最强文本能力，适合剧本生成 |
| `qwen-long` | 超长上下文，适合长剧本 |

**图片生成：**
| 模型名 | 说明 |
|--------|------|
| `wanx2.1-t2i-turbo` | 速度快，通用图片生成 |
| `wanx2.1-t2i-plus` | 更高质量 |
| `wanx-v1` | 经典版本 |

**视频生成：**
| 模型名 | 说明 |
|--------|------|
| `wan2.1-t2v-turbo` | 文字转视频，速度较快 |
| `wan2.1-t2v-plus` | 更高质量 |

### 配置示例

在「AI 配置」页面新增配置：

```
服务商：DashScope
Base URL：https://dashscope.aliyuncs.com/compatible-mode/v1
API Key：sk-xxxxxxxxxxxxxxxx
模型：qwen-plus（文本）/ wanx2.1-t2i-turbo（图片）/ wan2.1-t2v-turbo（视频）
```

---

## 火山引擎 Volcengine（豆包）

### 申请 API Key

1. 访问 [火山方舟控制台](https://console.volcengine.com/ark)
2. 注册/登录火山引擎账号
3. 进入「模型广场」，开通所需模型（文本/图片/视频）
4. 左侧点击「API Key 管理」，创建 API Key
5. 复制 API Key

> 💡 火山引擎在本项目中主要用于文本与图片生成；视频生成请使用 WAN 3.0 / MiniMax Hailuo-03 / Agnes Video 2.5。

### 可用模型

**文本生成：**
| 模型名 | API 端点 ID | 说明 |
|--------|------------|------|
| `Doubao-pro-32k` | `doubao-pro-32k-241215` | 通用高性能模型 |
| `Doubao-lite-32k` | `doubao-lite-32k-241215` | 低成本模型 |
| `Doubao-pro-128k` | `doubao-pro-128k-241215` | 超长上下文 |

**图片生成：**
| 模型名 | API 端点 ID | 说明 |
|--------|------------|------|
| `Doubao-seedream-4.5` | `doubao-seedream-4-5-251128` | 高质量图片生成 |

**视频生成：**

> ⚠️ 火山 Seedance 视频模型已在当前版本中从 AI 配置页收敛下线，
> 视频生成请使用 **WAN 3.0 / MiniMax Hailuo-03 / Agnes Video 2.5**（见上文「视频模型」）。
> 若确有需要，可在 `frontweb/src/components/AIConfigContent.vue` 的
> `providerConfigs.video` 中加回对应条目，后端适配器代码仍保留。

**分镜「全能模式」（v1.2.5+）：**

- 制作页单个分镜可切换为 **「全能模式」**：中间编辑区为**片段描述**，可用 **`@图片1`、`@图片2`…** 对应参考图顺序（一般为场景 → 角色 → 物品；不含经典分镜中间主图；`@图片N` 后建议加**半角空格**）。若该框有内容，生视频时**只发送这段文本**，不会拼接下方结构化「视频提示词」。
- 该模式配合 **Agnes 参考图模式**等链路使用时，提交前会校验 AI 配置是否匹配；不匹配时弹窗说明，可选强制继续。
- **经典模式**无分镜参考图时会提示先生成分镜图，不提供纯文案强行生成。

### 配置示例

```
服务商：Volcengine
Base URL：https://ark.cn-beijing.volces.com/api/v3
API Key：xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
模型：Doubao-pro-32k（文本）/ Doubao-seedream-4.5（图片）
```

**视频生成参数（可选）：**
| 参数 | 说明 | 默认值 |
|------|------|--------|
| 分辨率 | `720p` / `1080p` / `480p` | `720p` |
| 视频时长 | 每段分镜的视频秒数（4 / 5 / 8 / 10s） | `5` |
| seed | 随机种子，固定可复现结果 | 随机 |
| camera_fixed | 是否固定摄像机 | `false` |
| watermark | 是否添加水印 | `false` |

---

## 本地部署模型（Ollama 等）

如果你在本机或内网部署了兼容 OpenAI 接口的模型服务（如 Ollama、LM Studio、vLLM 等）：

```
服务商：自定义 / OpenAI 兼容
Base URL：http://localhost:11434/v1   （Ollama 示例）
API Key：ollama   （或任意字符串，本地服务通常不验证）
模型：qwen2.5:7b   （你下载的模型名）
```

> ⚠️ 本地模型仅适用于**文本生成**，图片和视频生成通常需要专用的云端 API。

---

## 远程 ComfyUI 服务器（GPU 云服务器）

如果你有远程 GPU 服务器（如 SeetaCloud、腾讯云等），可以通过 SSH 隧道连接远程 ComfyUI 服务。

### 方案架构

```
本地电脑 → SSH 隧道 → 远程 GPU 服务器
localhost:8188  ←── 端口转发 ──  ComfyUI :8188
```

### 快速配置步骤

#### 1. 启动远程 ComfyUI

SSH 连接到远程服务器，启动 ComfyUI：

```bash
ssh -p 23011 root@connect.westc.seetacloud.com
cd /root/ComfyUI
python main.py --listen 0.0.0.0 --port 8188
```

> 💡 建议创建启动脚本 `/root/comfyui_boot.sh`，包含等待网络/GPU 就绪的逻辑。

#### 2. 建立 SSH 隧道

**本地执行**（保持隧道运行）：

```bash
# 格式：ssh -p <端口> -L <本地端口>:<远程地址>:<远程端口> -N <用户>@<服务器>
ssh -p 23011 -L 8188:localhost:8188 -N root@connect.westc.seetacloud.com
```

**Windows 用户**（使用 PuTTY）：

1. Session → Host Name: `connect.westc.seetacloud.com`，Port: `23011`
2. Connection → SSH → Tunnels:
   - Source port: `8188`
   - Destination: `localhost:8188`
   - 选择 `Local`，点击 `Add`
3. 点击 `Open` 连接

#### 3. 配置 LocalMiniDrama

在软件内配置：

1. 点击右上角 **「AI 配置」**
2. 切换到 **「视频生成」** Tab
3. 新增配置：
   - **服务商**：`ComfyUI`
   - **Base URL**：`http://localhost:8188`
   - **接口规范**：`comfyui`
   - **设为默认**：✅ 勾选
4. 点击 **「测试」** 验证连接

#### 4. 配置开机自启动（可选）

如果远程服务器会重启，需要配置 ComfyUI 开机自启动：

**方案 1：通过 cron（推荐）**

在远程服务器执行：

```bash
crontab -e
# 在末尾添加
@reboot sleep 30 && bash /root/comfyui_boot.sh
```

**方案 2：通过 systemd**

在远程服务器创建 `/etc/systemd/system/comfyui.service`：

```ini
[Unit]
Description=ComfyUI Service
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/root/ComfyUI
ExecStart=/usr/bin/python3 /root/ComfyUI/main.py --listen 0.0.0.0 --port 8188
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

启用服务：

```bash
systemctl daemon-reload
systemctl enable comfyui.service
systemctl start comfyui.service
```

### 完整配置指南

详细的配置步骤、故障排查、自动化脚本等，请参考：

📄 **[快速开始](quickstart.md)** · **[项目结构](PROJECT_STRUCTURE.md)**

包含内容：
- 完整的部署流程（从零开始）
- SSH 免密登录配置
- 多种开机自启动方案对比
- Windows/Mac/Linux 全平台操作
- 常见问题诊断与解决
- 自动化部署脚本

---

### 性能建议

| 服务器配置 | 支持模型 | 说明 |
|-----------|---------|------|
| RTX 3060 (12GB) | SD1.5 / SDXL | 入门配置，适合测试 |
| RTX 4080 SUPER (16GB) | SDXL / Flux | 推荐配置，性价比高 |
| RTX 4090 (24GB) | 所有模型 | 高端配置，适合生产环境 |

> 💡 远程 ComfyUI 适合团队共享，多个用户可连接同一台服务器（注意并发限制）。

---

## 其他 OpenAI 兼容接口

任何支持 OpenAI Chat Completions 协议的接口均可接入：

```
Base URL：https://your-api-endpoint/v1
API Key：your-api-key
模型：your-model-name
```

常见兼容服务商：DeepSeek、硅基流动（SiliconFlow）、Groq、OpenRouter 等。

---

## 一键配置功能

在「AI 配置」页面，点击顶部的：
- **「一键配置通义」** — 自动创建阿里云 DashScope 的文本/图片/视频三套配置模板
- **「一键配置火山」** — 自动创建火山引擎的文本/图片/视频三套配置模板

一键配置后，只需填入你的 API Key，其他参数已预填好，点击「保存」即可使用。

---

## 连接测试

每条 AI 配置记录右侧有「测试」按钮，点击后会发送一条简短请求验证连接是否正常。  
测试成功显示绿色提示，失败会显示具体错误信息（如认证失败、模型不存在等）。

---

## 常见问题

### Q: API Key 填错了或过期了怎么办？

在「AI 配置」页面找到对应记录，点击编辑，修改 API Key 后保存即可立即生效。

---

### Q: 生成图片时提示「image size must be at least 3686400 pixels」

这是火山引擎图片生成 API 的最低像素要求。本系统会自动根据项目设定的画面比例计算合适的分辨率（最低 2560×1440），通常无需手动处理。如果仍然报错，请检查是否配置了自定义的 size 参数。

---

### Q: 视频生成提示「model does not exist」

火山引擎视频模型的 API 端点 ID 与展示名称不同。请确认你已在火山方舟控制台开通了该模型，并使用正确的模型名称。系统内置了常见模型名称的映射，两种写法（展示名 / 端点 ID）均支持。

---

### Q: 生成速度很慢怎么办？

- 图片生成通常需要 15–60 秒
- 视频生成通常需要 1–5 分钟（取决于时长和分辨率）
- 建议使用 `turbo` 或 `fast` 后缀的模型加快速度
- 如频繁遇到 429 限流，系统会自动重试，无需手动干预

---

[← 返回项目主页](../README.md)
