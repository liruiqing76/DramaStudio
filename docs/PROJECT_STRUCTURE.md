# 项目整理报告

## 目录结构

```
LocalMiniDrama/
├── backend-node/          # 后端服务 (Express + SQLite) - 核心必须
│   ├── src/              # 源代码
│   ├── configs/          # 配置文件 (ComfyUI workflows)
│   ├── migrations/       # 数据库迁移脚本
│   ├── routes/           # API路由
│   ├── services/         # 业务逻辑
│   ├── test/             # 单元测试
│   └── tools/ffmpeg/     # ffmpeg二进制文件
├── frontweb/             # 前端服务 (Vite + Vue 3) - 核心必须
│   ├── src/              # 源代码
│   ├── public/           # 静态资源
│   └── test/             # 单元测试
├── desktop/              # Electron桌面端打包 - 必须
├── scripts/              # 核心实用脚本 - 已精简
│   ├── download_14b_modelscope.py  # ModelScope模型下载脚本
│   ├── fix_comfyui_port.js         # 修复ComfyUI端口配置
│   ├── test_remote_i2v.js          # 远程ComfyUI I2V测试脚本
│   ├── input_image.png             # 测试用参考图
│   └── ref_image.png               # 参考图片
├── test_cases/           # 测试案例归档
│   ├── success/          # 成功案例（可用workflow、脚本）
│   ├── failed/           # 失败案例（无效视频、错误配置）
│   └── README.md         # 案例说明
├── archive/              # 归档文件 - 非必须，可随时删除
│   ├── debug_scripts/    # 调试过程中的临时脚本（~100+个迭代版本）
│   ├── temp_files/       # 临时配置脚本、一次性工具
│   ├── old_workflows/    # 过时的workflow配置
│   └── logs/             # 日志文件
└── [根目录文档]           # 项目文档（README、CHANGELOG等）
```

## 必须保留的核心文件

### 1. 后端核心 (backend-node/)
- `src/` - 所有业务源代码
- `configs/config.yaml` - 主配置文件
- `configs/comfyui_workflows/` - **正在使用的**workflow配置
  - `wan21_fp8_i2v.json` - FP8 I2V 配置（可用）
  - 其他flux/ltx/wan22配置根据需要保留
- `migrations/` - 所有数据库迁移
- `package.json` / `package-lock.json` - 依赖配置
- `tools/ffmpeg/` - ffmpeg可执行文件

### 2. 前端核心 (frontweb/)
- `src/` - 所有Vue源代码
- `public/` - 静态资源（风格预览图等）
- `index.html` / `vite.config.js` / `package.json` - 构建配置

### 3. 桌面端 (desktop/)
- Electron打包配置和脚本

### 4. 核心脚本 (scripts/)
- `test_remote_i2v.js` - 远程ComfyUI测试脚本
- `download_14b_modelscope.py` - ModelScope模型下载
- `fix_comfyui_port.js` - 数据库端口修复工具

## 可以删除/归档的非必须文件

### 1. archive/debug_scripts/ (约100+个文件)
所有版本迭代过程中的临时调试脚本：
- `test_wan21_lightx2v_v1~v5.py` - 重复迭代版本
- `vcheck_*.py` - 各种视频检查脚本
- `query_*.py` / `list_*.py` / `find_*.py` - 查询节点/模型脚本
- `diag_*.py` / `fix_*.py` - 诊断修复补丁
- `*restart*.sh` - 各种重启脚本
- `tunnel*.bat/ps1` - SSH隧道脚本
- `*.exp` - expect自动交互脚本
- `comfyui_patches/` - 各种ComfyUI补丁
- `comfyui_tests/` - 全套自动化测试（保留参考）

### 2. archive/temp_files/
- `add_comfyui_config.py` / `update_comfyui_config.py` - 一次性配置更新脚本
- `setup-ai-config.js` - 初始化配置脚本
- `check_torch.py` - 临时torch检查
- 其他一次性SQL更新脚本

### 3. test_cases/failed/videos/
- 3个无效测试视频（31KB/44KB/50KB），都是显存不足导致的失败产物，可删除

### 4. IDE/Agent缓存（已被.gitignore忽略，本地自动生成）
- `.claude/` - Claude IDE配置
- `.omc/` / `.omo/` / `.evolution/` - Agent状态缓存
- `.open-mem/` / `.reasonix/` - 记忆缓存
- `node_modules/` - 依赖包（可通过npm install重新安装）
- `dist/` - 构建产物
- `backend-node/data/` - SQLite数据库文件（运行时生成）

## workflow配置文件说明

| 文件 | 状态 | 说明 |
|------|------|------|
| `wan21_fp8_lightx2v_720p.json` | ✅ **生产级** | 4步Lightx2v LoRA加速，480p 90s/720p 150s实测通过 |
| `wan21_14b_i2v_official.json` | ✅ 可用 | 14B官方节点配置（参考） |
| `wan21_fp8_i2v.json` | ❌ 画质差 | 20步无LoRA+cfg=3，踩坑配置，已归档 |
| `wan21_gguf_i2v.json` | ❌ reshape bug | GGUF reshape错误，已归档 |
| `flux2_*.json` | 可选 | Flux图像生成配置 |
| `ltx_video_t2v.json` | 可选 | LTX视频生成配置 |
| `wan22_*.json` | ⚠️ 待验证 | Wan2.2版本配置，尚未有卡模式实测 |

## 清理建议

如果需要释放空间，可以安全删除：
1. 整个 `archive/` 目录 - 只是调试历史，不影响项目运行
2. `test_cases/failed/videos/*.mp4` - 失败的测试视频
3. `node_modules/` 目录 - 可通过 `npm install` 重新安装
4. `frontweb/dist/` 和 `desktop/dist/` - 可重新构建