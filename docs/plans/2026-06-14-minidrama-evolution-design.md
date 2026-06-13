# MiniDrama 8周进化计划 — 设计文档

> 日期: 2026-06-14  
> 策略: 全覆盖 MVP，按用户感知节奏分阶段交付  
> 原则: 不破坏现有 API，后端优先增量，SQLite 不动，每周独立可测

---

## 总体路线图

```
Week 1      角色一致性衣橱系统 ──────── ［用户最感知］
Week 2      视频时间线编辑器   ──────── ［后期能力质变］
Week 3-4    AI Agent 工作流    ──────── ［自动化核心］
Week 5      剧本专业化模板     ──────── ［内容质量提升］
Week 6-7    唇形同步 + TTS增强 ──────── ［成品专业度］
Week 8      运维守护 + 宫格图  ──────── ［稳定性收尾］
```

---

## Week 1 — 角色一致性衣橱系统 (P0)

### 目标
解决多次生成同角色长相/服装不一致的问题。

### 三层设计

| 层级 | 功能 | 说明 |
|------|------|------|
| L1 多视图 | 正面/侧面/背面三视图 | 一次生成 3 张参考图，确保角色立体一致 |
| L2 衣橱 | 多套造型切换 | 同一角色定义「日常装」「战斗装」等，分镜按场景选 |
| L3 身份锚点 | 结构化特征描述 | 发型/脸型/体型/肤色/标志性配饰，生成 prompt 自动注入 |

### 数据模型

```sql
-- character_outfits
CREATE TABLE character_outfits (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  character_id    INTEGER NOT NULL REFERENCES characters(id),
  name            TEXT NOT NULL,
  description     TEXT,
  hair_style      TEXT,
  face_shape      TEXT,
  body_type       TEXT,
  skin_tone       TEXT,
  signature_accessory TEXT,
  front_image_path  TEXT,
  side_image_path   TEXT,
  back_image_path   TEXT,
  created_at      TEXT DEFAULT (datetime('now')),
  updated_at      TEXT DEFAULT (datetime('now'))
);

-- character 增强
ALTER TABLE characters ADD COLUMN identity_anchor_json TEXT;
```

### 生成流程变化

```
旧: 用户输入描述 → 一张图
新: 用户输入描述 → AI 提取锚点 → 并行生成三视图 → 存入衣橱
     ↓
   分镜生成时: 选择角色 → 选择衣橱造型 → prompt 自动注入锚点
```

### 后端新增
- `src/services/outfitService.js` — 衣橱 CRUD
- `src/services/identityAnchorService.js` — 锚点提取与注入
- `src/routes/outfits.js` — 衣橱 API

### 前端新增
- `CharacterWardrobe.vue` — 角色衣橱面板（三视图 + 多造型切换）
- 角色详情页增加「衣橱」Tab

---

## Week 2 — 视频时间线编辑器 (P0)

### 目标
从「盲合 ffmpeg」升级到「可视预览 + 拖拽排序 + 裁剪 + 转场」。

### 能力矩阵

| 能力 | 实现方式 |
|------|---------|
| 拖拽排序 | SortableJS 拖拽分镜卡片 |
| 裁剪 | 前端 Marker 拖动 → 传 `start/end` 给 ffmpeg `-ss -to`（秒级无重编码） |
| 预览 | `<video>` 标签直接播放分镜文件 |
| 转场 | 预设 3 种: 硬切 / 淡入淡出 / 黑场过渡 |
| 合成 | 后端 ffmpeg concat demuxer |

### 前端组件
```
TimelineEditor.vue
├── TimelineTrack.vue         # 横向滚动轨道
│   ├── ClipCard.vue          # 分镜卡片（可拖拽 + 裁剪手柄 + 时长标签）
├── PreviewPanel.vue          # 视频预览区
├── TransitionMenu.vue        # 转场下拉选择
└── ExportButton.vue          # 合成导出
```

### 后端接口
```
GET  /api/v1/dramas/:id/merge/preview      — 分镜视频列表（含时长/缩略图）
POST /api/v1/dramas/:id/merge/execute      — 提交合成任务（含 segments_json）
GET  /api/v1/dramas/:id/merge/status/:tid  — 查询进度
```

### 数据模型
`video_merges` 表增加: `segments_json TEXT`（裁剪起止/转场/排序）

---

## Week 3-4 — AI Agent 工作流 (P1)

### 目标
从「每步手动点」升级到「一键生成全流程」，DAG 依赖自动并行。

### 架构

```
AgentScheduler (src/services/agentScheduler.js)
├── Pipeline Definition     # 流程定义 JSON（步骤 + DAG 依赖）
├── Step Executor           # 单步执行器，调用现有 service
├── State Manager           # 状态机 + 进度上报
└── Error Handler           # 失败重试/跳过/人工介入
```

### Pipeline 示例

```json
{
  "name": "full-production",
  "steps": [
    { "id": "extract-characters", "service": "characterGeneration", "depends": [] },
    { "id": "extract-scenes",     "service": "sceneExtraction",    "depends": [] },
    { "id": "generate-chars",     "service": "imageGeneration",    "depends": ["extract-characters"] },
    { "id": "generate-scenes",    "service": "imageGeneration",    "depends": ["extract-scenes"] },
    { "id": "storyboard",         "service": "storyboardGeneration","depends": ["extract-characters","extract-scenes"] },
    { "id": "generate-video",     "service": "videoGeneration",    "depends": ["storyboard","generate-chars","generate-scenes"] },
    { "id": "generate-audio",     "service": "ttsGeneration",      "depends": ["storyboard"] },
    { "id": "merge-video",        "service": "videoMerge",         "depends": ["generate-video","generate-audio"] }
  ]
}
```

### 状态机

```
PENDING → RUNNING → (SUCCESS | FAILED | PARTIAL)
                ↘ PAUSED（人工介入）
```

### 前端

- `PipelinePanel.vue` — 流水线面板，实时显示各步骤状态
- 每项目一个「一键生成」按钮
- 失败步骤可单独重试或跳过

### 不引入新依赖
纯 TypeScript 实现，不用 Mastra/LangChain。

---

## Week 5 — 剧本专业化模板 (P1)

### 目标
从「自由 prompt」升级到「结构化剧本」，有题材模板、节奏约束、质量评分。

### 能力

| 能力 | 说明 |
|------|------|
| 10 题材预设 | 霸总/甜宠/复仇/穿越/悬疑/古装/都市/科幻/奇幻/校园 |
| 三幕结构约束 | 开局(建置)→冲突(对抗)→高潮(解决) |
| 节奏曲线提示 | 分镜附带紧张度曲线(1-10) |
| 五维质量评分 | 人物一致性/情节逻辑/节奏控制/对话自然度/爽点密度 |

### 实现

```
PromptTemplateEngine (src/services/promptTemplateEngine.js)
├── templates/               # YAML 题材模板
│   ├── romance-boss.yaml
│   ├── revenge.yaml
│   └── ...
├── structureInjector        # 三幕结构注入
├── rhythmAnalyzer           # 节奏分析
└── qualityScorer           # 五维评分
```

### 数据模型
`stories` 表增加: `genre`, `template_id`, `rhythm_curve_json`, `quality_score_json`

---

## Week 6-7 — TTS 增强 + 唇形同步 (P2)

### Week 6 — TTS 增强

| 能力 | 说明 |
|------|------|
| 多角色音色分配 | 分镜生成时为每个角色分配独立音色（男/女/青年/老年） |
| 情感参数控制 | 音量/语速/音调 + 5 种情感标签 |
| MiniMax 声音克隆 | 上传 10 秒参考音频 → 克隆音色 |
| 音色预览 | 角色页面可试听 TTS 音色 |

### Week 7 — 唇形同步

- 后端调用远程 Wav2Lip API（或 ComfyUI Wav2Lip workflow）
- 作为视频生成的后处理步骤，可选开启
- 不集成本地模型（避免依赖爆炸）

### 数据模型

```sql
CREATE TABLE character_voices (
  id, character_id, voice_id, provider,
  speed, pitch, emotion, sample_audio_path, created_at
);

CREATE TABLE video_lipsyncs (
  id, video_generation_id, audio_path,
  status, output_video_path,
  created_at, completed_at
);
```

### 接口

```
POST   /api/v1/characters/:id/voice          — 配置角色音色
POST   /api/v1/characters/:id/voice/clone    — 上传音频克隆
POST   /api/v1/videos/:id/lipsync            — 请求唇形同步
GET    /api/v1/videos/:id/lipsync/status     — 查询进度
```

---

## Week 8 — 运维守护 + 宫格图模式 (P2)

### Week 8A — 运维守护

| 能力 | 说明 |
|------|------|
| 媒体文件自动清理 | 每天凌晨清理 `output/temp/` 超 7 天临时文件 |
| ComfyUI 健康检查 | 每 5 分钟 ping `/system_stats`，挂了前端 Badge 告警 |
| 磁盘空间监控 | 剩余 < 5GB 时前端提示 + 停止新视频任务 |
| 任务超时兜底 | 超 30 分钟自动标记失败 |

实现: `src/services/guardianService.js`，通过 `setInterval` 运行。

### Week 8B — 宫格图模式（协议无关）

#### 设计原则

宫格图是**纯图片处理策略**，不绑定任何特定视频模型或协议。它工作在「图片→图片」层，与下游视频生成协议解耦：

```
4 张分镜图 → sharp 合成 2×2 宫格图 → 可选提交任意视频协议 → sharp 裁切回 4 段视频
                         ↓
              ComfyUI / Kling / Vidu / LTX / ... 任选
```

#### 两层架构

| 层 | 职责 | 协议绑定 |
|------|------|---------|
| **合成层** (gridImageService) | sharp 拼接 4 图→1 宫格、sharp 裁切 1 视频→4 段 | **无**（纯本地 ffmpeg + sharp） |
| **分发层** (videoClient) | 将宫格图提交给任意已配置的视频协议 | **透明**（复用现有 `normalizeProtocol` + 协议分发） |

#### 数据流

```
用户选择「宫格模式」勾选 4 个连续分镜
  → gridImageService.composeGrid(images[])  → 1 张 2×2 宫格图存入 output/grids/
  → 用户选择视频协议（如 ComfyUI LTX / Kling / Vidu）
  → videoClient.generateVideo(gridImage, protocol)  → 复用现有流程，不加新分支
  → 拿到视频后 gridImageService.decomposeVideo(video, segmentCount=4)
  → ffmpeg 按时间等分裁切 → 4 个独立分镜视频 → 入库
```

#### 关键实现

```js
// src/services/gridImageService.js
class GridImageService {
  // 纯 sharp 拼接，4 张 512x512 → 1 张 1024x1024
  async composeGrid(images, cols = 2, rows = 2) { ... }
  
  // 纯 ffmpeg 裁切，48s 视频 → 4 段各 12s
  async decomposeVideo(videoPath, segmentCount, outputDir) { ... }
}

// videoClient.js — 无需新增协议！复用现有分发
// 宫格图就是一张普通图片，走现有的 image-to-video 协议
```

#### 前端交互

- 分镜列表增加「宫格模式」多选（勾选连续 2-4 个分镜）
- 勾选后出现「合成宫格图」按钮
- 生成后可选择**任意已配置的视频协议**提交（下拉选择器，默认走当前项目配置的协议）
- 视频生成完成后自动裁切回各分镜

实现: `src/services/gridImageService.js`（sharp 拼接 + ffmpeg 裁切）

---

## 架构原则

1. **不破坏现有** — 新功能增量挂载，现有 API 不变
2. **后端优先** — 核心逻辑在 `services/`，前端贴合
3. **SQLite 不动** — 新表通过 migration 加入
4. **每阶段独立可测** — 明确验收条件 + 自动化测试
5. **无新重依赖** — 不引入 Mastra/LangChain/Wav2Lip 本地等

---

## 参考项目对照

| 本计划能力 | 参考来源 |
|-----------|---------|
| 角色衣橱系统 | BigBanana 衣橱 + moyin-creator 6层锚点 + AIComicBuilder 四视图 |
| 视频时间线 | BigBanana CutOS 风格 |
| AI Agent 工作流 | huobao-drama Mastra Agent + Toonflow 三层体系 |
| 剧本模板 | short-drama 13题材 + 五维评分 |
| TTS 增强 | DramaBox 情感TTS |
| 唇形同步 | LingGuo-Drama Wav2Lip |
| 运维守护 | waoowaoo 四进程架构 |
| 宫格图 | huobao-drama 宫格图切分 |
