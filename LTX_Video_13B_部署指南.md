# LTX Video 13B 模型部署指南

## 一、模型选择

### 推荐模型（按优先级排序）

1. **LTX Video 13B 蒸馏版（推荐）**
   - 模型ID: `LTX-Video/LTX-Video-13B-Distilled`
   - 文件: `ltx-video-13b-distilled.safetensors`
   - 大小: ~13GB
   - 优点: 质量接近全量13B，速度更快
   - 下载命令:
     ```bash
     cd /root/comfyui/models/checkpoints
     modelscope download --model LTX-Video/LTX-Video-13B-Distilled --local_dir ./
     ```

2. **LTX Video 13B 全量版（质量最高）**
   - 模型ID: `LTX-Video/LTX-Video-13B`
   - 文件: `ltx-video-13b.safetensors`
   - 大小: ~26GB
   - 优点: 最高质量
   - 缺点: 下载慢，加载慢
   - 下载命令:
     ```bash
     cd /root/comfyui/models/checkpoints
     modelscope download --model LTX-Video/LTX-Video-13B --local_dir ./
     ```

3. **LTX Video 2B 轻量版（快速测试用）**
   - 模型ID: `LTX-Video/LTX-Video-2B`
   - 文件: `ltx-video-2b.safetensors`
   - 大小: ~8.9GB
   - 优点: 下载快，加载快
   - 缺点: 质量较低
   - 下载命令:
     ```bash
     cd /root/comfyui/models/checkpoints
     modelscope download --model LTX-Video/LTX-Video-2B --local_dir ./
     ```

---

## 二、下载步骤

### 步骤1: SSH登录服务器
```bash
ssh root@116.172.93.163
```

### 步骤2: 检查已有模型
```bash
ls -lh /root/comfyui/models/checkpoints/ | grep -i ltx
```

### 步骤3: 启动下载（推荐13B蒸馏版）
```bash
# 方法1: 前台下载（可看到进度）
cd /root/comfyui/models/checkpoints
modelscope download --model LTX-Video/LTX-Video-13B-Distilled --local_dir ./

# 方法2: 后台下载（推荐，可断开SSH）
cd /root/comfyui/models/checkpoints
nohup modelscope download --model LTX-Video/LTX-Video-13B-Distilled --local_dir ./ > /root/ltx_download.log 2>&1 &

# 查看下载进度
tail -f /root/ltx_download.log
```

### 步骤4: 监控下载进度（本地Windows）
```powershell
# 在Windows上运行监控脚本
powershell -ExecutionPolicy Bypass -File "d:\zmzc-code\ai-drama-refs\LocalMiniDrama\monitor_model_download.ps1"
```

---

## 三、配置LocalMiniDrama使用13B模型

### 方法1: 自动配置（推荐）
运行Python脚本：
```bash
cd d:\zmzc-code\ai-drama-refs\LocalMiniDrama\backend-node
python update_comfyui_ltx.py
```

### 方法2: 手动配置
1. 打开数据库:
   ```bash
   cd d:\zmzc-code\ai-drama-refs\LocalMiniDrama\backend-node\data
   sqlite3 drama_generator.db
   ```

2. 更新配置:
   ```sql
   UPDATE ai_service_configs 
   SET 
       default_model = 'ltx-video-13b-distilled',
       settings = '{"workflow_type":"ltx-video-13b","timeout":900,"poll_interval":5}'
   WHERE provider = 'comfyui';
   ```

3. 退出:
   ```sql
   .exit
   ```

---

## 四、从ComfyUI导出Workflow

### 步骤1: 打开ComfyUI
浏览器访问: `http://116.172.93.163:8188`

### 步骤2: 设计Workflow
1. 右键 → Add Node
2. 添加以下节点:
   - `LTXVideoModelLoader` (加载13B模型)
   - `LTXVideoTextEncode` (文本编码)
   - `LTXVideoSampler` (采样)
   - `LTXVideoDecode` (解码)
   - `VideoCombine` (视频合成)

3. 连接节点:
   ```
   ModelLoader → TextEncode → Sampler → Decode → VideoCombine
   ```

4. 配置参数:
   - Model: `ltx-video-13b-distilled`
   - Steps: `40`
   - CFG: `7.5`
   - Frames: `{{frames}}` (占位符)
   - Width/Height: `{{width}}` / `{{height}}` (占位符)
   - Prompt: `{{prompt}}` (占位符)

### 步骤3: 导出API格式
1. 点击右上角菜单（☰）
2. 选择 "Export (API Format)"
3. 保存JSON文件

### 步骤4: 替换配置
将导出的JSON替换到:
`d:\zmzc-code\ai-drama-refs\LocalMiniDrama\backend-node\configs\comfyui_workflows\ltx_video_t2v.json`

---

## 五、测试视频生成

### 步骤1: 重启后端服务
```bash
# 停止现有服务 (Ctrl+C)
cd d:\zmzc-code\ai-drama-refs\LocalMiniDrama\backend-node
npm run dev
```

### 步骤2: 打开前端页面
浏览器访问: `http://localhost:3013`

### 步骤3: 生成视频
1. 进入"剧集管理" → 选择剧集
2. 点击"制作" → 进入制作页面
3. 选择分镜 → 点击"生成视频"
4. 查看后端日志，确认是否提交到ComfyUI

### 步骤4: 查看ComfyUI执行
1. 打开ComfyUI: `http://116.172.93.163:8188`
2. 查看Queue（右上角）
3. 等待执行完成
4. 查看输出视频

---

## 六、常见问题

### Q1: 模型下载太慢怎么办？
**A**: 使用国内ModelScope镜像，或先在本地下载后上传到服务器。

### Q2: ComfyUI提示"Model not found"？
**A**: 检查模型文件是否在正确目录: `/root/comfyui/models/checkpoints/`

### Q3: 视频生成失败？
**A**: 检查:
1. ComfyUI终端输出（SSH登录后查看）
2. 后端日志
3. Workflow JSON是否正确（节点名称、连接）

### Q4: 如何优化生成速度？
**A**:
1. 使用蒸馏版模型
2. 减少采样步数（Steps: 30 → 20）
3. 减少帧数（Frames: 16 → 8）
4. 降低分辨率（Width/Height）

---

## 七、监控脚本使用

### 启动监控
```powershell
powershell -ExecutionPolicy Bypass -File "d:\zmzc-code\ai-drama-refs\LocalMiniDrama\monitor_model_download.ps1"
```

### 日志位置
`d:\zmzc-code\ai-drama-refs\LocalMiniDrama\model_download_log.txt`

### 停止监控
按 `Ctrl+C`

---

## 八、完成标志

✅ 模型文件已下载到 `/root/comfyui/models/checkpoints/`
✅ 数据库配置已更新（provider='comfyui', default_model='ltx-video-13b-distilled'）
✅ ComfyUI可以加载模型
✅ Workflow已导出并配置占位符
✅ 测试视频生成成功

---

**注意**: 本文档会根据实际情况持续更新。
