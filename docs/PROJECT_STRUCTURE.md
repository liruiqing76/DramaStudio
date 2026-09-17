# 项目结构说明

> 本文件描述 DramaStudio 的实际目录结构与关键路径。
> 最后更新：2026-09-12

---

## 顶层结构

```
DramaStudio/
├── backend-node/          # 后端服务（Express + SQLite）— 核心
├── frontweb/              # 前端服务（Vite + Vue 3）— 核心
├── desktop/               # Electron 桌面端打包
├── docs/                  # 项目文档
├── start.bat              # 一键启动前后端（Windows）
├── run_dev.bat / .ps1     # 开发环境启动脚本
├── AGENTS.md              # 开发规范 / 运行说明
├── CHANGELOG.md           # 版本演进记录
└── README.md              # 项目总览
```

---

## backend-node/（后端）

```
backend-node/
├── src/
│   ├── server.js / app.js     # 应用入口与 Express 装配
│   ├── adapters/              # 各 AI 供应商适配器
│   ├── config/                # 配置加载（YAML）
│   ├── constants/             # 常量定义
│   ├── db/                    # SQLite 连接、迁移入口（migrate.js）
│   ├── middleware/            # Express 中间件
│   ├── routes/                # REST API 路由
│   ├── services/              # 业务逻辑（生成服务、AI 客户端、导出导入等）
│   ├── templates/             # 题材模板（YAML）
│   └── utils/                 # 工具（含 agnesRateLimiter.js 限流器）
├── skills/                    # 提示词模板（单一来源，外置 Markdown）
├── configs/                   # config.yaml、SQL 配置样例
├── migrations/                # 数据库迁移 SQL
├── scripts/                   # 管线脚本（run_pipeline.js）
├── test/                      # 单元测试（Node.js 内置 test runner）
├── tools/ffmpeg/              # ffmpeg 二进制
└── data/                      # SQLite 数据库与素材（运行时生成，不入库）
```

### 关键路径说明

| 路径 | 作用 |
|------|------|
| `src/services/videoClient.js` | 视频生成客户端，含三家主力模型协议实现 |
| `src/services/imageClient.js` | 图片生成客户端 |
| `src/services/aiClient.js` | 文本生成客户端（含 Agnes 限流包装） |
| `src/utils/agnesRateLimiter.js` | Agnes 官方 RPM 全局限流器 |
| `src/services/promptI18n.js` | 提示词装配（中英双语，读取 skills/） |
| `src/services/storyTemplateMatcher.js` | 题材模板关键词匹配 |
| `skills/*.md` | **提示词权威来源**，用户可在 UI 覆盖（存 `prompt_overrides` 表） |
| `configs/config.yaml` | 主配置文件（已随仓库提供，无需从 example 复制） |

### 提示词架构（重要）

提示词**不在代码里硬编码**，而是外置为 `skills/*.md`：

- frontmatter 声明 `key / label / description`
- 正文 = `default_body`
- `<!-- @locked -->` 之后 = `locked_suffix`（不可被用户覆盖部分）

读取入口：`skillService.getDefaultBody(key)` / `getLockedSuffix(key)`。
用户覆盖存 DB 表 `prompt_overrides`，通过「高级设置」页管理。

---

## frontweb/（前端）

```
frontweb/
├── src/
│   ├── main.js / App.vue
│   ├── api/           # 后端 API 封装
│   ├── components/    # 组件（含 AIConfigContent.vue — AI 配置页）
│   ├── composables/   # 组合式函数
│   ├── constants/     # 常量
│   ├── i18n/          # 国际化
│   ├── router/        # 路由
│   ├── stores/        # Pinia 状态管理
│   ├── styles/        # 全局样式（主题变量）
│   ├── utils/         # 工具
│   └── views/         # 页面（FilmList / DramaDetail / FilmCreate）
├── public/            # 静态资源
├── test/              # 单元测试
└── vite.config.js     # 构建配置（代理 /api、/static 到后端）
```

**模型列表定义位置**：`src/components/AIConfigContent.vue` → `providerConfigs`

---

## desktop/（Electron 桌面端）

```
desktop/
├── main.js                    # Electron 主进程
├── backend-app/               # 打包进 exe 的后端副本
├── frontweb-dist/             # 打包进 exe 的前端构建产物
├── ffmpeg-mac/                # macOS 平台 ffmpeg
├── electron-builder*.json     # 打包配置（标准版 / Lite / mac）
└── dist*.bat / .sh            # 打包脚本
```

---

## 技术栈

| 层 | 技术 |
|----|------|
| 前端 | Vue 3 + Vite + Element Plus + Pinia + Axios |
| 后端 | Node.js + Express + SQLite（better-sqlite3） |
| 桌面 | Electron 28 + electron-builder |
| 语言 | 纯 JavaScript（无 TypeScript） |

---

## 开发与运行

| 服务 | 端口 | 命令 |
|------|------|------|
| 后端 | 5679 | `cd backend-node && npm run dev` |
| 前端 | 3013 | `cd frontweb && npm run dev` |

```bash
# 后端测试
cd backend-node && node --test test/*.test.js

# 前端测试
cd frontweb && node --test test/*.test.js

# 前端构建
cd frontweb && npm run build
```

数据库迁移在后端启动时自动执行（`ensureColumns()`），
首次部署或新增迁移文件后需跑 `npm run migrate`。

> ⚠️ 后端测试需使用**系统 Node v24.14.0**；托管 Node 22 与
> better-sqlite3 ABI 不匹配会产生假失败。

---

## 版本控制

**入库**：源码、文档、配置、`.workbuddy-ai/`（工作区记忆）

**不入库**：
- `.claude/` `.omc/` `.omo/` `.open-mem/` `.evolution/` `.reasonix/` — AI 工具运行时目录
- `node_modules/` — 依赖包（`npm install` 重建）
- `dist/` — 构建产物
- `backend-node/data/` — SQLite 数据库与素材（运行时生成）
