# MiniDrama 8周进化计划 — 设计文档 (v2)

> 日期: 2026-06-14  
> 策略: 全覆盖 MVP，按用户感知节奏分阶段交付  
> 原则: 不破坏 API、后端增量、SQLite 不动、每周独立可测、无重依赖  
> 基准代码: `backend-node/src/` (46 个 service, 14 个 route 文件)

---

## 总体路线图

```
Week 1      角色一致性衣橱系统 ──────── ［用户最感知］
Week 2      视频时间线编辑器   ──────── ［后期能力质变］  
Week 3-4    AI Agent 工作流    ──────── ［自动化核心］
Week 5      剧本专业化模板     ──────── ［内容质量提升］
Week 6-7    TTS增强 + 唇形同步 ──────── ［成品专业度］
Week 8      运维守护 + 宫格图  ──────── ［稳定性收尾］
```

---

## Week 1 — 角色一致性衣橱系统

### 问题
同角色多次生成图片时长相/服装不一致。现有 `characters` 表只有 `image_path` 一个字段，无法支撑一致性。

### 设计方案

三层协同：

| 层 | 功能 | 用户感知 |
|----|------|---------|
| L1 多视图 | 正面/侧面/背面三视图并行生成 | 生成角色时一下看到三个角度 |
| L2 衣橱 | 同角色多套造型（日常装/战斗装等） | 角色页切换 Tab 换装 |
| L3 锚点 | 结构化特征（发型/脸型/体型/肤色/配饰）→ prompt 自动注入 | 无感，生成质量自动变好 |

### 第1步：Migration SQL

```sql
-- 001_character_wardrobe.sql

-- 新表：角色造型衣橱
CREATE TABLE IF NOT EXISTS character_outfits (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  character_id      INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  drama_id          INTEGER REFERENCES dramas(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,           -- 如 "日常装" / "战斗装"
  description       TEXT,                    -- 造型描述
  -- L3 锚点字段（生成 prompt 时自动注入）
  hair_style        TEXT,                    -- 发型
  face_shape        TEXT,                    -- 脸型
  body_type         TEXT,                    -- 体型
  skin_tone         TEXT,                    -- 肤色
  signature_accessory TEXT,                  -- 标志性配饰（眼镜/耳环/刀疤等）
  -- L1 三视图（可选，为空表示未生成）
  front_image_path  TEXT,
  side_image_path   TEXT,
  back_image_path   TEXT,
  -- 元数据
  is_default        INTEGER NOT NULL DEFAULT 0,  -- 默认造型
  sort_order        INTEGER NOT NULL DEFAULT 0,
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_outfits_character ON character_outfits(character_id);
CREATE INDEX idx_outfits_drama ON character_outfits(drama_id);

-- characters 表增强（已有 identity_anchor_json？用 ALTER 加）
-- 注意: SQLite ALTER TABLE 不支持 IF NOT EXISTS，需在代码中 try-catch
ALTER TABLE characters ADD COLUMN default_outfit_id INTEGER REFERENCES character_outfits(id);
ALTER TABLE characters ADD COLUMN identity_anchor_json TEXT;  -- JSON: {hair,face,body,skin,accessory}
```

### 第2步：新增/修改文件

| 操作 | 文件 | 职责 |
|------|------|------|
| **新增** | `src/services/outfitService.js` | 衣橱 CRUD + 三视图并行生成调度 |
| **新增** | `src/services/identityAnchorService.js` | AI 提取锚点 + prompt 注入 |
| **新增** | `src/routes/outfits.js` | REST API 路由 |
| **修改** | `src/routes/index.js` | `app.use('/api/v1', outfitsRouter)` |
| **修改** | `src/services/characterLibraryService.js` | 分镜 prompt 构建时注入 outfit 锚点 |
| **修改** | `src/services/imageService.js` | 角色图生成时支持三视图模式 |

### 第3步：outfitService.js 核心设计

```js
// module.exports = { setupOutfitService(db) }

function setupOutfitService(db) {
  return {
    // 创建造型，至少填 name + description
    create: (characterId, dramaId, { name, description, hairStyle, faceShape, bodyType, skinTone, accessory }) => {
      // INSERT INTO character_outfits ... RETURNING *
    },

    // 列出角色所有造型
    listByCharacter: (characterId) => {
      // SELECT * FROM character_outfits WHERE character_id = ? ORDER BY sort_order
    },

    // 更新造型
    update: (outfitId, fields) => { /* UPDATE SET ... */ },

    // 删除造型（默认造型不可删，除非是最后一个）
    remove: (outfitId) => { /* DELETE，清理关联图片文件 */ },

    // 三视图并行生成（核心！）
    // 调用 imageClient 三次（正面/侧面/背面），prompt 从锚点构造
    generateThreeViews: async (outfitId, options) => {
      // 1. 读 outfit 锚点
      // 2. 对每个角度构造 prompt：
      //    front:  "full-body front view, facing camera, {hair}, {face}, {body}, {skin}, {accessory}"
      //    side:   "full-body side profile view, {same anchors}"
      //    back:   "full-body back view, showing back of {hair}, {body}"
      // 3. Promise.all 并行调用 imageService.processImageGeneration()
      // 4. 结果写入 outfit.front/side/back_image_path
      // 5. 返回 {front, side, back}
    },

    // 设为默认造型
    setDefault: (characterId, outfitId) => {  /* 先清其他，再设 */ }
  };
}
```

### 第4步：identityAnchorService.js 核心设计

```js
function setupIdentityAnchorService(db, aiClient) {
  return {
    // AI 提取锚点 → 结构化 JSON
    // 调用 aiClient.generateText({ stream: false })  --- 复用已修好的降级逻辑
    extractAnchors: async (characterDescription) => {
      const prompt = `从以下角色描述中提取结构化特征，严格返回JSON:
{
  "hair_style": "...",
  "face_shape": "...",
  "body_type": "...",
  "skin_tone": "...",
  "signature_accessory": "...",
  "clothing_style": "...",
  "age_range": "..."
}
角色描述: ${characterDescription}`;
      const resp = await aiClient.generateText(prompt);
      return JSON.parse(resp);  // try-catch 包裹，失败返回 null
    },

    // 注入锚点到分镜 prompt（在 storyboard 生成时调用）
    // 会修改传入的 storyboardContext 对象的 prompt 字段
    injectToPrompt: (basePrompt, outfitAnchors, angle) => {
      // 将 {hair, face, body, skin, accessory} 拼接到原 prompt 末尾
      // 同时根据 angle (正面/侧面/俯视) 调整描述
      let anchorStr = `Character features: ${outfitAnchors.hair}, ${outfitAnchors.face}, ${outfitAnchors.body}, ${outfitAnchors.skin}`;
      if (outfitAnchors.signature_accessory) {
        anchorStr += `, distinctive ${outfitAnchors.signature_accessory}`;
      }
      return `${basePrompt}. ${anchorStr}.`;
    },

    // 将锚点存到 characters 表的 identity_anchor_json
    saveToCharacter: (characterId, anchors) => {
      db.prepare('UPDATE characters SET identity_anchor_json = ? WHERE id = ?')
        .run(JSON.stringify(anchors), characterId);
    }
  };
}
```

### 第5步：路由设计 — routes/outfits.js

```js
// 挂载在 /api/v1（通过 routes/index.js）
const router = express.Router();

// 衣橱 CRUD
router.get(   '/characters/:characterId/outfits',        getOutfits );      // 列出
router.post(  '/characters/:characterId/outfits',        createOutfit );    // 创建
router.put(   '/outfits/:outfitId',                      updateOutfit );    // 更新
router.delete('/outfits/:outfitId',                      deleteOutfit );    // 删除

// 三视图生成（异步，返回 task_id，前端轮询）
router.post(  '/outfits/:outfitId/generate-views',       generateViews );

// 设为默认
router.put(   '/characters/:characterId/outfits/:outfitId/default', setDefaultOutfit );

// 锚点（可与现有 characters 路由整合）
router.post(  '/characters/:characterId/extract-anchors',  extractAnchors );

module.exports = router;
```

### 第6步：前端改动

| 文件 | 改动 |
|------|------|
| `frontweb/src/views/CharacterDetail.vue`（或等价页面） | 新增「衣橱」Tab，展示造型列表 + 三视图预览 |
| `frontweb/src/components/OutfitCard.vue` | 造型卡片（名称/描述/三张小图/默认标记） |
| `frontweb/src/components/OutfitEditor.vue` | 造型编辑弹窗（名称/描述/锚点手动编辑） |
| `分镜生成组件` | 选择角色时下拉可指定造型，默认取 default_outfit |

### 验收标准

- [ ] 创建角色 → 填写描述 → AI 提取锚点成功（降级后仍可用）
- [ ] 点击「生成三视图」→ 三张图并行生成 → 显示在衣橱中
- [ ] 角色可创建多个造型并切换
- [ ] 分镜生成 prompt 中自动包含所选造型锚点
- [ ] 不破坏现有角色生成流程（无 wardrobe 时走老逻辑）

---

## Week 2 — 视频时间线编辑器

### 问题
现有 `videoMergeService.js` 通过 ffmpeg concat 直接拼视频，无预览/裁剪/调序。

### 设计方案

不重写 `videoMergeService`，在它之上加一层编排能力。

### 第1步：数据模型

```sql
-- 002_timeline_segments.sql
-- 在现有 video_merges 表加字段
ALTER TABLE video_merges ADD COLUMN segments_json TEXT;
-- segments_json 格式:
-- [
--   { "clip_id": 1, "order": 0, "start_sec": 0, "end_sec": 5.2, "transition": "fade" },
--   { "clip_id": 3, "order": 1, "start_sec": 1.0, "end_sec": 6.0, "transition": "cut"  }
-- ]
-- transition 枚举: "cut" | "fade" | "black"
```

### 第2步：修改 videoMergeService.js

```js
// 现有: mergeVideoFiles(videoPaths, outputPath, dramaId)
// 新增: mergeWithTimeline(segments, outputPath, dramaId)
//   segments = [{ videoPath, startSec, endSec, transition }, ...]

function mergeWithTimeline(segments, outputPath, dramaId) {
  // 1. 为每个 segment 用 ffmpeg -ss startSec -to endSec 生成临时裁剪文件
  //    - 硬切(cut):  直接保留裁剪片段
  //    - 淡入淡出(fade): 尾部加 ffmpeg fade=out:st=2:d=0.5
  //    - 黑场(black): 裁剪段之间插入 0.5s 黑场片段
  // 2. 用 ffmpeg concat demuxer 将处理后片段 + 黑场合并
  // 3. 清理临时文件
  // 4. 返回 outputPath
}
```

### 第3步：路由

```js
// 在现有 drama.js 或 videoMerge.js 路由中新增:
GET  /api/v1/dramas/:id/merge/preview      // 返回可合并视频列表 + 时长/缩略图
POST /api/v1/dramas/:id/merge/execute       // body: { segments: [...] } → 异步任务
GET  /api/v1/dramas/:id/merge/status/:tid   // 查询进度
```

### 第4步：前端组件

| 组件 | 依赖 | 说明 |
|------|------|------|
| `TimelineEditor.vue` | SortableJS (npm install sortablejs) | 时间线主容器 |
| `ClipCard.vue` | — | 分镜卡片：缩略图 + 裁切 Marker + 时长标签 |
| `PreviewPanel.vue` | `<video>` 原生标签 | 点击卡片播放对应视频 |
| `TransitionMenu.vue` | el-select | 转场下拉：硬切/淡入淡出/黑场 |

### 验收标准

- [ ] 拖拽卡片重排分镜顺序
- [ ] 拖动裁剪 Marker 设置视频起止时间（显示在卡片上）
- [ ] 点击卡片在预览区播放
- [ ] 选择转场 → 合成 → ffmpeg 输出包含转场效果
- [ ] 无 segments_json 时走原 merge 逻辑向后兼容

---

## Week 3-4 — AI Agent 工作流

### 问题
生成短剧需用户手动点 5-8 个步骤，每个等几分钟，体验断裂。

### 设计方案

**不引入 Mastra/LangChain**。实现一个轻量 DAG 调度器，所有"步骤"本质上是调用现有 service 函数的异步任务。

### 第1步：数据模型

```sql
-- 003_agent_pipelines.sql
CREATE TABLE IF NOT EXISTS pipelines (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  drama_id   INTEGER NOT NULL REFERENCES dramas(id) ON DELETE CASCADE,
  type       TEXT NOT NULL DEFAULT 'full-production',  -- pipeline 类型
  status     TEXT NOT NULL DEFAULT 'pending',          -- pending/running/success/failed/partial/paused
  progress   REAL NOT NULL DEFAULT 0,                   -- 0.0 - 1.0
  config_json TEXT,                                     -- Pipeline 定义 JSON（运行时快照）
  error_msg  TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS pipeline_steps (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  pipeline_id INTEGER NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
  step_id     TEXT NOT NULL,             -- 逻辑 ID: "extract-characters" 等
  status      TEXT NOT NULL DEFAULT 'pending',  -- pending/running/success/failed/skipped
  retry_count INTEGER NOT NULL DEFAULT 0,
  input_json  TEXT,                      -- 步骤输入参数快照
  output_json TEXT,                      -- 步骤输出快照
  error_msg   TEXT,
  started_at  TEXT,
  finished_at TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_pipeline_steps_pipeline ON pipeline_steps(pipeline_id);
```

### 第2步：agentScheduler.js 核心设计

```js
// src/services/agentScheduler.js

const PIPELINE_DEFINITIONS = {
  'full-production': {
    steps: [
      { id: 'extract-characters',  run: 'characterGeneration', depends: [] },
      { id: 'extract-scenes',      run: 'sceneExtraction',      depends: [] },
      { id: 'generate-chars',      run: 'imageGeneration',      depends: ['extract-characters'] },
      { id: 'generate-scenes',     run: 'imageGeneration',      depends: ['extract-scenes'] },
      { id: 'storyboard',          run: 'storyboardGeneration', depends: ['extract-characters', 'extract-scenes'] },
      { id: 'generate-video',      run: 'videoGeneration',      depends: ['storyboard', 'generate-chars', 'generate-scenes'] },
      { id: 'generate-audio',      run: 'ttsGeneration',        depends: ['storyboard'] },
      { id: 'merge-video',         run: 'videoMerge',            depends: ['generate-video', 'generate-audio'] },
    ]
  },
  // 可选：更多模板
  'image-only': { steps: [...] },
  'video-from-existing': { steps: [...] }
};

class AgentScheduler {
  constructor(db, serviceRegistry) {
    this.db = db;
    this.services = serviceRegistry;  // { characterGeneration, imageGeneration, videoGeneration, ... }
    this.MAX_RETRIES = 3;
  }

  // 启动 pipeline
  async startPipeline(dramaId, type = 'full-production') { ... }

  // 执行单个步骤（由状态机驱动）
  async executeStep(pipelineId, stepId) { ... }

  // 重试失败步骤
  async retryStep(pipelineId, stepId) { ... }

  // 跳过失败步骤
  skipStep(pipelineId, stepId) { ... }

  // 获取可并行执行的下一步骤列表（DAG 拓扑）
  getReadySteps(pipelineId) { ... }

  // 内部：状态机驱动
  // pending → (所有 depends 都 success/skipped?) → running
  // running → (函数返回) → success | (抛错且 retry<3) → running | (抛错且 retry>=3) → failed
  _transition(step, newStatus, error = null) { ... }
}
```

### 第3步：服务注册表

```js
// src/services/serviceRegistry.js（新建）
// 将现有 service 函数映射到 pipeline step 可用的 handler

const serviceRegistry = {
  characterGeneration: async (db, params) => {
    const { dramaId } = params;
    // 调用现有 characterGenerationService 的逻辑
  },
  sceneExtraction: async (db, params) => {
    // 调用现有 sceneService 提取场景
  },
  imageGeneration: async (db, params) => {
    // 调用 imageService.processImageGeneration()
    // 区分 generate-chars 和 generate-scenes 通过 params.type
  },
  storyboardGeneration: async (db, params) => { /* ... */ },
  videoGeneration: async (db, params) => { /* ... */ },
  ttsGeneration: async (db, params) => { /* ... */ },
  videoMerge: async (db, params) => { /* ... */ },
};

module.exports = serviceRegistry;
```

### 第4步：路由

```js
// src/routes/agent.js
POST /api/v1/dramas/:id/pipeline/start               // 启动 → 201 + pipeline_id
GET  /api/v1/dramas/:id/pipeline/:pid/status          // 查询各步骤状态
POST /api/v1/dramas/:id/pipeline/:pid/pause           // 暂停
POST /api/v1/dramas/:id/pipeline/:pid/resume          // 恢复
POST /api/v1/dramas/:id/pipeline/:pid/steps/:sid/retry // 重试
POST /api/v1/dramas/:id/pipeline/:pid/steps/:sid/skip  // 跳过
```

### 第5步：前端 PipelinePanel.vue

```
┌─────────────────────────────────────────────┐
│  [一键生成]       进度: ████████░░ 80%       │
├─────────────────────────────────────────────┤
│  ✅ 角色提取   ✅ 场景提取                      │
│  ✅ 角色图生成  ✅ 场景图生成  (并行)            │
│  ✅ 分镜生成                                     │
│  ⏳ 视频生成...  ⏳ TTS生成...  (并行)          │
│  ⏸️ 视频合成  (等待中)                            │
│                                    [暂停] [取消]  │
└─────────────────────────────────────────────┘
```

每个步骤卡片可 hover 看详情，失败步骤变红 + 出现 [重试] [跳过] 按钮。

### 验收标准

- [ ] 点击一键生成 → 流水线面板出现 → 步骤依序执行
- [ ] `generate-chars` 和 `generate-scenes` 并行执行（确认两个同时 running）
- [ ] `generate-video` 和 `generate-audio` 在 storyboard 完成后并行
- [ ] 某步骤 mock 失败 → 自动重试 3 次 → 标记 failed → 用户可手动重试/跳过
- [ ] 暂停 → 当前步骤继续跑完 → 后续不触发
- [ ] 恢复 → 从断点继续
- [ ] 不破坏现有手动单步操作

---

## Week 5 — 剧本专业化模板

### 问题
现有 `storyGenerationService.js` 靠自由 prompt，缺乏结构。

### 设计方案

在现有故事生成入口增加「题材模板」层，不改 API 签名，模板作为可选参数传入。

### 第1步：模板文件

```
backend-node/src/templates/           ← 新建目录
├── index.js                          ← 模板加载/搜索
├── romance-boss.yaml                 ← 霸总
├── sweet-pet.yaml                    ← 甜宠
├── revenge.yaml                      ← 复仇
├── time-travel.yaml                  ← 穿越
├── suspense.yaml                     ← 悬疑
├── ancient-costume.yaml              ← 古装
├── urban.yaml                        ← 都市
├── sci-fi.yaml                       ← 科幻
├── fantasy.yaml                      ← 奇幻
└── campus.yaml                       ← 校园
```

### 第2步：模板 YAML 格式

```yaml
# romance-boss.yaml
id: romance-boss
name: 霸总甜宠
name_en: Boss Romance
description: 霸道总裁与灰姑娘的甜蜜爱情故事
character_archetypes:
  male: 冷酷霸道总裁，28-35岁，西装革履，气场强大
  female: 善良坚韧女主，22-28岁，清新淡雅
  support: [ 痴情男二, 心机女配, 忠犬助理 ]
classic_tropes:
  - 契约婚姻
  - 意外同居
  - 英雄救美
  - 真相大白
three_act_structure:
  act1: 男女主命运般相遇，产生冲突或契约关系
  act2: 感情升温中遭遇误会/阻碍，关系起伏
  act3: 误会解除，真相大白，圆满结局
rhythm_pattern: [3,5,7,8,9,6,8,10,7,5,8,9,10,8,7,6,8,9,10,9,8,7,6,8,10]  # 25个分镜紧张度参考
```

### 第3步：promptTemplateEngine.js

```js
// src/services/promptTemplateEngine.js
module.exports = { setupTemplateEngine }

function setupTemplateEngine(templatesDir) {
  return {
    // 加载所有模板
    listAll: () => { /* 读 YAML → 返回数组 */ },

    // 获取单个模板
    get: (templateId) => { /* 读 YAML → 返回对象 */ },

    // 用模板构建 story prompt
    buildStoryPrompt: (template, userConcept) => {
      // 返回增强后的 prompt，包含三幕结构 + 角色原型
      return `你是一位短剧编剧。请按以下模板创作剧本：
  
【题材】${template.name}
【角色原型】男主: ${template.character_archetypes.male} / 女主: ${template.character_archetypes.female}
【经典桥段】${template.classic_tropes.join('、')}
【三幕结构】
  第一幕: ${template.three_act_structure.act1}
  第二幕: ${template.three_act_structure.act2}
  第三幕: ${template.three_act_structure.act3}
  
用户构思: ${userConcept}

请输出结构化剧本...`;
    },

    // 五维质量评分（调用 AI 生成后评估）
    scoreQuality: async (storyJson, aiClient) => {
      // 调用 aiClient.generateText({ stream: false })
      const prompt = `评估以下短剧剧本的五个维度（1-10分），仅返回JSON:
{ "character_consistency": N, "plot_logic": N, "rhythm_control": N, "dialogue_naturalness": N, "thrill_density": N }`;
      return JSON.parse(await aiClient.generateText(prompt + '\n' + JSON.stringify(storyJson)));
    }
  };
}
```

### 第4步：数据模型

```sql
-- 004_story_templates.sql
ALTER TABLE dramas ADD COLUMN genre TEXT;
ALTER TABLE dramas ADD COLUMN template_id TEXT;
ALTER TABLE dramas ADD COLUMN rhythm_curve_json TEXT;
ALTER TABLE dramas ADD COLUMN quality_score_json TEXT;
-- rhythm_curve_json: [3,5,7,8,...]  紧张度数组，长度=分镜数
-- quality_score_json: {"character_consistency":8,"plot_logic":7,...}
```

### 第5步：路由（在现有 drama.js 中）

```js
GET  /api/v1/templates                          // 列出 10 个题材模板
POST /api/v1/dramas/:id/generate-with-template  // body: { template_id, concept } → 生成故事
GET  /api/v1/dramas/:id/quality-score           // 获取五维评分
```

### 验收标准

- [ ] 创建项目时可选题材模板（下拉选 10 个）
- [ ] 选模板后生成的故事符合题材特征（示例：霸总有霸总台词风格）
- [ ] 故事中包含三幕结构标记
- [ ] 分镜页面可看到节奏曲线（简单折线图）
- [ ] 生成完成后显示五维评分（雷达图或柱状图）
- [ ] 不选模板时走原自由 prompt 流程

---

## Week 6-7 — TTS 增强 + 唇形同步

### Week 6 — TTS 增强

#### 第1步：数据模型

```sql
-- 005_character_voices.sql
CREATE TABLE IF NOT EXISTS character_voices (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  character_id    INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  voice_id        TEXT,                     -- MiniMax voice_id 或边缘 TTS voice name
  provider        TEXT NOT NULL DEFAULT 'minimax',  -- minimax / edge-tts / custom
  name            TEXT,                     -- 音色名称（如 "温柔女声"）
  gender          TEXT,                     -- male / female
  age_group       TEXT,                     -- youth / adult / elder
  speed           REAL NOT NULL DEFAULT 1.0,
  pitch           INTEGER NOT NULL DEFAULT 0,
  emotion         TEXT,                     -- happy/sad/angry/nervous/neutral
  sample_audio_path TEXT,                   -- 克隆用参考音频路径
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_voices_character ON character_voices(character_id);
```

#### 第2步：修改 ttsService.js

```js
// 现有 ttsService.js 已有 generateTTS(text, options)
// 增强：支持多角色音色分配 + 情感参数

// 新增函数
function assignVoicesToStoryboard(storyboardRows, characterVoices) {
  // 遍历 storyboard 台词，匹配角色 → 分配对应 voice_id + emotion
  // 返回 enrichedRows（每行多了 voice_id, emotion 字段）
}

function generateTTSWithVoice(text, voiceConfig, outputPath) {
  // 调用 MiniMax TTS API 或 edge-tts，附加 speed/pitch/emotion 参数
  // MiniMax: 透传 voice_id, speed, pitch, emotion
  // edge-tts: voice name + express-as + rate
}
```

#### 第3步：路由

```js
POST /api/v1/characters/:id/voice           // 配置角色音色
POST /api/v1/characters/:id/voice/clone     // 上传音频 → MiniMax 克隆 → 返回 voice_id
GET  /api/v1/characters/:id/voices          // 列出角色所有音色
DELETE /api/v1/voices/:voiceId             // 删除音色
POST /api/v1/voices/:id/preview             // 生成 5 秒试用音频
```

### Week 7 — 唇形同步

#### 第1步：MVP 策略

- 调用**远程 ComfyUI Wav2Lip workflow**（复用现有 `videoClient.js` 的 ComfyUI 分发）
- 不在本地安装 Wav2Lip（模型依赖太重）
- 作为视频后处理可选步骤

#### 第2步：数据模型

```sql
-- 006_video_lipsyncs.sql
CREATE TABLE IF NOT EXISTS video_lipsyncs (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  video_generation_id INTEGER REFERENCES video_generations(id) ON DELETE CASCADE,
  drama_id            INTEGER REFERENCES dramas(id),
  audio_path          TEXT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'pending',  -- pending/processing/done/failed
  output_video_path   TEXT,
  error_msg           TEXT,
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at        TEXT
);
```

#### 第3步：ComfyUI Wav2Lip workflow 模板

```json
// configs/comfyui_wav2lip_config.json（新建）
{
  "workflow": {
    "1": { "class_type": "LoadVideo", ... },
    "2": { "class_type": "LoadAudio", ... },
    "3": { "class_type": "Wav2Lip", ... },
    "4": { "class_type": "VHS_VideoCombine", ... }
  }
}
```

> ⚠️ 注意: Wav2Lip ComfyUI 节点需先确认远程 ComfyUI 已装。若未装，此功能标记为"待 ComfyUI 环境准备后启用"，路由返回 503 + 提示。

#### 第4步：路由

```js
POST /api/v1/videos/:id/lipsync              // 请求唇形同步 → 201 + lipsync_id
GET  /api/v1/videos/:id/lipsyncs              // 列出视频的所有唇形同步任务
GET  /api/v1/lipsyncs/:lid                    // 查询唇形同步状态/结果
```

### 验收标准

- [ ] 角色页面配置音色（性别/年龄/情感）并保存
- [ ] 分镜生成 TTS 时自动匹配对应角色音色
- [ ] 音频克隆：上传 10s wav → 生成 voice_id
- [ ] 唇形同步任务提交流程走通（ComfyUI 有/无两种情况都要有提示）
- [ ] 不破坏现有 TTS 流程（无 voice 配置时走默认）

---

## Week 8 — 运维守护 + 宫格图

### Week 8A — 运维守护进程

#### guardianService.js

```js
// src/services/guardianService.js
// 纯 setInterval 实现，不引入进程管理

function setupGuardian(config = {}) {
  const intervals = [];

  function start() {
    // 1. 临时文件清理：每 6 小时执行
    intervals.push(setInterval(cleanTempFiles, 6 * 3600 * 1000));

    // 2. ComfyUI 健康检查：每 5 分钟
    intervals.push(setInterval(checkComfyUIHealth, 5 * 60 * 1000));

    // 3. 磁盘监控：每 15 分钟
    intervals.push(setInterval(checkDiskSpace, 15 * 60 * 1000));

    // 4. 任务超时兜底：每 2 分钟
    intervals.push(setInterval(checkTaskTimeouts, 2 * 60 * 1000));
  }

  function stop() { intervals.forEach(clearInterval); }

  async function cleanTempFiles() {
    // 遍历 output/temp/ 目录
    // fs.stat 每个文件，mtime > 7天 → fs.unlink
    // 日志记录清理数量
  }

  async function checkComfyUIHealth() {
    // axios.get(comfyuiBaseUrl + '/system_stats', { timeout: 5000 })
    // 成功 → status.healthy = true
    // 失败 → status.healthy = false，logger.warn
  }

  async function checkDiskSpace() {
    // check-disk-space npm 包 或 child_process.exec('wmic logicaldisk')
    // 剩余 < 5GB → flag canAcceptVideoTask = false
  }

  function checkTaskTimeouts() {
    // SELECT * FROM async_tasks WHERE status='running'
    //   AND (julianday('now') - julianday(updated_at)) * 86400 > 1800
    // UPDATE status='failed', error_msg='timed out'
  }

  // 暴露状态查询
  function getHealthStatus() {
    return {
      comfyui: { healthy: boolean, lastCheck: ISO8601 },
      disk: { freeGB: number, thresholdGB: 5, canAcceptVideo: boolean },
      tempFileCount: number,
      timedOutTasks: number
    };
  }

  return { start, stop, getHealthStatus };
}
```

#### 路由

```js
GET /api/v1/system/health   // 返回 getHealthStatus() 结果
```

### Week 8B — 宫格图模式（协议无关）

#### 设计原则

宫格图是**纯图片处理策略**，不绑定任何视频模型。工作层：

```
图片层: 4 张分镜图 → sharp 合成 2×2 宫格图（纯本地）
视频层: 宫格图作为普通 I2V 提交 → 复用现有 videoClient 任意协议
后处理: 视频 → ffmpeg 按时间等分裁切回 4 段（纯本地）
```

#### gridImageService.js

```js
// src/services/gridImageService.js
// 依赖: sharp (npm install sharp)

function setupGridImageService(outputDir) {
  return {
    // 合成 2×2 宫格图
    // images: [{ path: string, label?: string }]  ← 最多 4 张
    // → 返回宫格图绝对路径
    composeGrid: async (images, cols = 2, rows = 2) => {
      // 1. sharp 读取每张图 → resize 到统一尺寸 (512×512)
      // 2. sharp.composite 拼合到 1024×1024 画布
      //    位置: (0,0) (512,0) (0,512) (512,512)
      // 3. 输出到 output/grids/grid_${timestamp}.png
      // 4. 返回 { gridPath, segmentMapping: [{ index, originalPath, gridX, gridY }] }
    },

    // 切分宫格视频回各分镜
    // videoPath: 宫格视频路径
    // segmentCount: 分几段（默认 4）
    // → 返回 [{ segmentIndex, videoPath }]
    decomposeVideo: async (videoPath, segmentCount = 4) => {
      // 1. ffprobe 获取总时长 totalDuration
      // 2. segmentDuration = totalDuration / segmentCount
      // 3. ffmpeg -ss {i * segDur} -to {(i+1) * segDur} 循环裁剪
      // 4. 返回裁切后的分段视频路径数组
    }
  };
}
```

#### videoClient.js — 无需改动

宫格图就是一张普通图片，走现有的 `image-to-video` 协议分发（`normalizeProtocol` → ComfyUI/Kling/Vidu/...），完全透明。

#### 前端交互

- 分镜页面：勾选 2-4 个分镜 → 点击「合成为宫格图」→ 宫格图出现
- 宫格图提交：选择视频协议下拉 → 点生成 → 走常规 I2V 流程
- 视频生成完成：自动触发 `decomposeVideo` → 分镜视频拆回各分镜行

### 验收标准

- [ ] 临时文件清理：创建超 7 天文件 → 6 小时后被清理
- [ ] ComfyUI 离线时 `/system/health` 返回 healthy=false + 前端 Badge 变红
- [ ] 磁盘 < 5GB 时新视频任务被拒绝 + 前端提示
- [ ] 超时任务被自动标记 failed
- [ ] 4 张 512×512 图 → 1024×1024 宫格图排列正确
- [ ] 48s 宫格视频 → 4 个 12s 分镜视频
- [ ] 宫格图提交任意视频协议均可工作（不新增协议分支）

---

## 架构原则（全周期遵守）

| # | 原则 | 检验方法 |
|---|------|---------|
| 1 | **不破坏 API** — 现有路由入参/返回值不变 | 跑现有回归测试 |
| 2 | **增量挂载** — 新 service 不修改已有 service 的核心逻辑，只在入口加钩子 | code review |
| 3 | **SQLite 不动** — 只 ALTER TABLE 加列 + CREATE TABLE 新表，不改已有列类型 | migration 幂等 |
| 4 | **阶段隔离** — 每周完成后可独立部署，不依赖后续周 | 只启用本周路由 |
| 5 | **零重依赖** — npm install 只加 sortablejs / sharp / js-yaml，不装 Mastra 等框架 | package.json diff |

---

## 参考项目对照

| 本计划能力 | 参考来源 |
|-----------|---------|
| 角色衣橱系统 | BigBanana 衣橱 + moyin-creator 锚点 + AIComicBuilder 四视图 |
| 视频时间线 | BigBanana CutOS 风格 |
| AI Agent 工作流 | huobao-drama Agent + Toonflow 三层体系 |
| 剧本模板 | short-drama 题材模板 + 五维评分 |
| TTS 增强 | DramaBox 情感 TTS |
| 唇形同步 | LingGuo-Drama Wav2Lip (ComfyUI 方式) |
| 运维守护 | waoowaoo 守护进程 |
| 宫格图 | huobao-drama 宫格图切分 (协议无关) |
