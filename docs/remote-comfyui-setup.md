# 远程 ComfyUI 服务器连接指南

> 本文档介绍如何连接远程 GPU 服务器上的 ComfyUI 服务，用于 LocalMiniDrama 的视频生成。

---

## 目录

- [适用场景](#适用场景)
- [方案架构](#方案架构)
- [前置准备](#前置准备)
- [步骤一：连接远程服务器](#步骤一连接远程服务器)
- [步骤二：安装并启动 ComfyUI](#步骤二安装并启动-comfyui)
- [步骤三：建立 SSH 隧道](#步骤三建立-ssh-隧道)
- [步骤四：配置 LocalMiniDrama](#步骤四配置-localminidrama)
- [步骤五：配置开机自启动](#步骤五配置开机自启动)
- [常见问题](#常见问题)

---

## 适用场景

| 场景 | 说明 |
|------|------|
| 本地无 GPU | 本地电脑没有独立显卡，无法运行 ComfyUI |
| 需要更强算力 | 本地 GPU 性能不足，需要云端 GPU 加速 |
| 团队协作 | 多个用户共享一台 GPU 服务器 |

**典型配置**：AutoDL / SeetaCloud / 腾讯云等 GPU 云服务器

---

## 方案架构

```
┌─────────────────┐         SSH 隧道          ┌─────────────────────┐
│  本地电脑        │ ←────────────────────→  │  远程 GPU 服务器     │
│                  │    localhost:8188        │                     │
│  LocalMiniDrama │ ────────────────────→   │  ComfyUI :8188     │
│  (前端+后端)    │                          │  (RTX 4080 SUPER)  │
└─────────────────┘                          └─────────────────────┘
```

**核心原理**：通过 SSH 端口转发，将远程服务器的 ComfyUI 端口（8188）映射到本地，使 LocalMiniDrama 可以像访问本地服务一样访问远程 ComfyUI。

---

## 前置准备

### 1. 远程服务器

| 项目 | 要求 |
|------|------|
| GPU | 推荐 NVIDIA RTX 3060 以上 |
| 内存 | ≥ 16GB |
| 存储 | ≥ 50GB（用于 ComfyUI 和模型） |
| 系统 | Ubuntu 20.04 / 22.04 |
| SSH 访问 | 需要 SSH 地址、端口、密码/密钥 |

### 2. 本地环境

| 项目 | 要求 |
|------|------|
| SSH 客户端 | Windows: 自带 OpenSSH；Mac: 自带 ssh |
| LocalMiniDrama | 已安装并运行 |

---

## 步骤一：连接远程服务器

### 1.1 测试 SSH 连接

```bash
# 格式：ssh -p <端口> <用户名>@<服务器地址>
ssh -p 23011 root@connect.westc.seetacloud.com
```

输入密码后，看到服务器命令提示符表示连接成功。

### 1.2 配置 SSH 免密登录（可选但推荐）

**生成 SSH 密钥**（本地执行）：

```bash
ssh-keygen -t ed25519 -C "minidrama@local"
# 一路回车，使用默认路径
```

**复制公钥到服务器**：

```bash
ssh-copy-id -p 23011 root@connect.westc.seetacloud.com
# 输入一次密码后，以后不再需要
```

**验证免密登录**：

```bash
ssh -p 23011 root@connect.westc.seetacloud.com "echo '免密登录成功'"
```

---

## 步骤二：安装并启动 ComfyUI

### 2.1 检查 ComfyUI 是否已安装

```bash
ssh -p 23011 root@connect.westc.seetacloud.com "ls -la /root/ | grep -i comfy"
```

如果显示 `ComfyUI` 目录，说明已安装，跳到 [2.3](#23-启动-comfyui)。

### 2.2 安装 ComfyUI（如未安装）

```bash
ssh -p 23011 root@connect.westc.seetacloud.com
```

进入服务器后执行：

```bash
# 克隆 ComfyUI 仓库
cd /root
git clone https://github.com/comfyanonymous/ComfyUI.git

# 安装依赖
cd ComfyUI
pip install -r requirements.txt

# 退出服务器
exit
```

### 2.3 启动 ComfyUI

**手动启动**（用于测试）：

```bash
ssh -p 23011 root@connect.westc.seetacloud.com
cd /root/ComfyUI
python main.py --listen 0.0.0.0 --port 8188
```

看到 `Running on http://0.0.0.0:8188` 表示启动成功。

**创建启动脚本**（推荐）：

在服务器上创建 `/root/comfyui_boot.sh`：

```bash
#!/bin/bash
# ComfyUI 启动脚本

# 等待网络就绪
for i in $(seq 1 30); do
    if ping -c1 -W1 8.8.8.8 >/dev/null 2>&1; then break; fi
    sleep 2
done

# 等待 GPU 就绪
for i in $(seq 1 30); do
    if nvidia-smi >/dev/null 2>&1; then break; fi
    sleep 2
done

export PATH="/root/miniconda3/bin:$PATH"
export CUDA_VISIBLE_DEVICES=0
export PYTHONUNBUFFERED=1

# 杀掉旧进程
fuser -k 8188/tcp 2>/dev/null || true
sleep 2

echo "[$(date)] ComfyUI starting..."
cd /root/ComfyUI
exec python main.py --listen 0.0.0.0 --port 8188
```

添加执行权限：

```bash
ssh -p 23011 root@connect.westc.seetacloud.com "chmod +x /root/comfyui_boot.sh"
```

---

## 步骤三：建立 SSH 隧道

SSH 隧道用于将远程服务器的端口映射到本地，使 LocalMiniDrama 可以访问。

### 3.1 手动建立隧道

**Windows PowerShell / Mac Terminal**：

```bash
# 格式：ssh -p <端口> -L <本地端口>:<远程地址>:<远程端口> -N <用户>@<服务器>
ssh -p 23011 -L 8188:localhost:8188 -N root@connect.westc.seetacloud.com
```

> 参数说明：
> - `-L 8188:localhost:8188`：将远程的 8188 端口映射到本地的 8188 端口
> - `-N`：不执行远程命令，仅用于端口转发
> - 如果配置了免密登录，命令会一直运行，保持隧道开启

### 3.2 后台运行隧道

**Linux / Mac**（后台运行）：

```bash
ssh -p 23011 -L 8188:localhost:8188 -N -f root@connect.westc.seetacloud.com
# -f: 后台运行
```

**Windows**（使用 PuTTY）：

1. 打开 PuTTY
2. Session → Host Name: `connect.westc.seetacloud.com`，Port: `23011`
3. Connection → SSH → Tunnels:
   - Source port: `8188`
   - Destination: `localhost:8188`
   - 选择 `Local`，点击 `Add`
4. 点击 `Open` 连接

**Windows**（使用 plink.exe，PuTTY 命令行工具）：

```powershell
# 下载 plink.exe: https://www.chiark.greenend.org.uk/~sgtatham/putty/latest.html
plink -ssh -P 23011 -L 8188:localhost:8188 -N root@connect.westc.seetacloud.com
```

### 3.3 验证隧道

隧道建立后，在本地浏览器访问 `http://localhost:8188`，如果看到 ComfyUI 界面，说明隧道成功。

或使用命令行测试：

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:8188/
# 返回 200 表示成功
```

---

## 步骤四：配置 LocalMiniDrama

### 4.1 通过界面配置

1. 启动 LocalMiniDrama（前端 `http://localhost:3013`）
2. 点击右上角 **「AI 配置」**
3. 切换到 **「视频生成」** Tab
4. 点击 **「新增配置」**，填写：
   - **服务商**：`ComfyUI`
   - **名称**：`远程 ComfyUI`
   - **Base URL**：`http://localhost:8188`
   - **接口规范**：`comfyui`
   - **设为默认**：✅ 勾选
5. 点击 **「保存」**
6. 点击 **「测试」** 验证连接

### 4.2 通过数据库直接配置

如果无法通过界面配置，可以直接操作数据库：

```bash
cd /path/to/LocalMiniDrama/backend-node
sqlite3 data/drama_generator.db "
INSERT OR REPLACE INTO ai_service_configs 
(service_type, provider, name, base_url, api_protocol, is_active, is_default, settings) 
VALUES 
('video', 'comfyui', '远程 ComfyUI', 'http://localhost:8188', 'comfyui', 1, 1, '{}');
"
```

### 4.3 验证配置

1. 进入任意项目的 **「制作」** 页面
2. 选择分镜，点击 **「生成视频」**
3. 在弹出的配置中，确认选择了 `远程 ComfyUI`
4. 提交任务，观察是否成功调用远程 ComfyUI

---

## 步骤五：配置开机自启动

如果远程服务器重启，ComfyUI 需要自动启动，否则隧道会连接失败。

### 5.1 方案 A：通过 `.bashrc` 启动（简单）

在服务器上编辑 `/root/.bashrc`，在末尾添加：

```bash
# ComfyUI 开机自启动
if [ -f /root/comfyui_boot.sh ] && ! pgrep -f "comfyui" > /dev/null; then
    nohup bash /root/comfyui_boot.sh > /tmp/comfyui_start.log 2>&1 &
fi
```

> 注意：此方式仅在 **登录 shell** 时触发，某些服务器环境可能不执行。

### 5.2 方案 B：通过 `cron` 启动（推荐）

在服务器上执行：

```bash
# 编辑 crontab
crontab -e

# 在末尾添加（等待 30 秒后启动，确保网络和 GPU 就绪）
@reboot sleep 30 && bash /root/comfyui_boot.sh
```

### 5.3 方案 C：通过 `systemd` 启动（最可靠）

在服务器上创建 `/etc/systemd/system/comfyui.service`：

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
Environment="PATH=/root/miniconda3/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin"

[Install]
WantedBy=multi-user.target
```

启用服务：

```bash
systemctl daemon-reload
systemctl enable comfyui.service
systemctl start comfyui.service

# 检查状态
systemctl status comfyui.service
```

---

## 常见问题

### Q1: SSH 隧道断开后无法重连

**原因**：上次隧道的端口可能还在占用。

**解决**：

```bash
# 查找占用 8188 端口的进程
# Linux / Mac:
lsof -i :8188
# 或
ps aux | grep "ssh.*8188"

# 杀掉进程
kill -9 <PID>
```

### Q2: 连接超时 / 无法访问 ComfyUI

**排查步骤**：

1. **检查远程 ComfyUI 是否运行**：
   ```bash
   ssh -p 23011 root@connect.westc.seetacloud.com "ps aux | grep comfy | grep -v grep"
   ```

2. **检查远程端口是否监听**：
   ```bash
   ssh -p 23011 root@connect.westc.seetacloud.com "netstat -tlnp | grep 8188"
   ```

3. **检查 SSH 隧道是否建立**：
   ```bash
   # 本地执行
   curl -s -o /dev/null -w "%{http_code}" http://localhost:8188/
   ```

### Q3: AutoDL 服务器重启后 IP 变化

**原因**：AutoDL 等云服务器的公网 IP 可能会变化。

**解决**：
- 每次重启后，从 AutoDL 控制台获取新的 SSH 地址
- 或申请固定 IP（需额外付费）

### Q4: ComfyUI 启动很慢 / 卡住

**原因**：模型加载需要时间，特别是大型模型（如 SDXL、LTX-Video）。

**解决**：
- 首次启动可能需要 5-10 分钟，请耐心等待
- 检查服务器内存是否充足：`free -h`
- 检查 GPU 显存：`nvidia-smi`

### Q5: 如何在多台电脑上共享同一台 ComfyUI 服务器？

**方案**：每台电脑都建立自己的 SSH 隧道，指向同一台远程服务器。

**注意**：
- ComfyUI 默认不支持并发请求，多用户同时生成视频可能会排队
- 可以考虑在服务器上部署多个 ComfyUI 实例（不同端口）

---

## 附录：完整部署脚本

以下是一个完整的自动化脚本，可以在新服务器上快速部署 ComfyUI 并配置开机启动。

### A1: 服务器部署脚本

创建 `deploy_comfyui.sh`（在本地执行）：

```bash
#!/bin/bash
# ComfyUI 远程部署脚本

SERVER="connect.westc.seetacloud.com"
PORT="23011"
USER="root"

echo "=== 开始部署 ComfyUI 到远程服务器 ==="

# 1. 安装 ComfyUI
ssh -p $PORT $USER@$SERVER "
  if [ ! -d /root/ComfyUI ]; then
    echo '克隆 ComfyUI...'
    cd /root && git clone https://github.com/comfyanonymous/ComfyUI.git
    cd ComfyUI && pip install -r requirements.txt
  else
    echo 'ComfyUI 已存在，跳过安装'
  fi
"

# 2. 创建启动脚本
ssh -p $PORT $USER@$SERVER "cat > /root/comfyui_boot.sh << 'EOF'
#!/bin/bash
for i in \$(seq 1 30); do
    if ping -c1 -W1 8.8.8.8 >/dev/null 2>&1; then break; fi
    sleep 2
done
for i in \$(seq 1 30); do
    if nvidia-smi >/dev/null 2>&1; then break; fi
    sleep 2
done
export PATH=\"/root/miniconda3/bin:\$PATH\"
export CUDA_VISIBLE_DEVICES=0
fuser -k 8188/tcp 2>/dev/null || true
sleep 2
echo \"[\$(date)] ComfyUI starting...\"
cd /root/ComfyUI
exec python main.py --listen 0.0.0.0 --port 8188
EOF
chmod +x /root/comfyui_boot.sh
"

# 3. 配置 cron 开机启动
ssh -p $PORT $USER@$SERVER "
  (crontab -l 2>/dev/null | grep -v comfyui_boot; echo '@reboot sleep 30 && bash /root/comfyui_boot.sh') | crontab -
  echo 'Cron 配置已添加'
"

# 4. 启动 ComfyUI
ssh -p $PORT $USER@$SERVER "bash /root/comfyui_boot.sh > /tmp/comfyui.log 2>&1 &"
sleep 10

# 5. 验证
ssh -p $PORT $USER@$SERVER "ps aux | grep 'python.*main.py' | grep -v grep && echo '✅ ComfyUI 启动成功'"

echo "=== 部署完成 ==="
echo "接下来请在本地建立 SSH 隧道："
echo "ssh -p $PORT -L 8188:localhost:8188 -N $USER@$SERVER"
```

### A2: 本地 SSH 隧道管理脚本（Windows）

创建 `start_comfyui_tunnel.bat`（Windows）：

```batch
@echo off
set SERVER=connect.westc.seetacloud.com
set PORT=23011
set USER=root

echo 正在建立 ComfyUI SSH 隧道...
ssh -p %PORT% -L 8188:localhost:8188 -N %USER%@%SERVER%
pause
```

---

## 更新日志

| 日期 | 版本 | 说明 |
|------|------|------|
| 2026-06-14 | 1.0 | 初始版本，基于 AutoDL 服务器配置经验 |

---

[← 返回项目主页](../README.md)
