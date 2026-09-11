# MiniDrama 8周进化计划 — 测试计划 (v2)

> 日期: 2026-06-14  
> 配合设计文档 v2，覆盖 Week 1-8 全部新增功能

---

## 测试策略

| 层 | 工具 | 覆盖范围 |
|----|------|---------|
| 后端单元 | vitest | 每个新增 service 的核心函数 |
| API 集成 | vitest + supertest | 每个路由的正向/异常/边界 |
| 数据库 | SQLite `:memory:` 临时库 | migration 幂等 + CRUD |
| 前端 E2E | 手动 checklist | 关键用户路径冒烟 |
| Mock 策略 | 所有 AI/外部 API 调用 mock | 确保测试无外部依赖 |

### 测试目录

```
backend-node/__tests__/
├── unit/
│   ├── outfitService.test.js
│   ├── identityAnchorService.test.js
│   ├── timelineMerge.test.js
│   ├── agentScheduler.test.js
│   ├── promptTemplateEngine.test.js
│   ├── guardianService.test.js
│   └── gridImageService.test.js
└── integration/
    ├── api-outfits.test.js
    ├── api-timeline.test.js
    ├── api-agent.test.js
    ├── api-templates.test.js
    ├── api-voice.test.js
    ├── api-lipsync.test.js
    └── api-grid.test.js
```

---

## Week 1 — 角色衣橱系统

### 单元测试

#### TC1.1 锚点提取 — 正常
| 项目 | 内容 |
|------|------|
| 文件 | `identityAnchorService.test.js` |
| 输入 | 角色描述: `"30岁冷酷将军，长发，国字脸，高大健壮，小麦肤色，左眼有刀疤"` |
| Mock | `aiClient.generateText` → 固定 JSON `{hair_style:"长发",face_shape:"国字脸",body_type:"高大健壮",skin_tone:"小麦肤色",signature_accessory:"左眼刀疤"}` |
| 期望 | 返回结构化锚点对象，5 个字段均有值 |

#### TC1.2 锚点提取 — AI 返回格式异常
| 项目 | 内容 |
|------|------|
| 输入 | AI 返回非 JSON 文本 |
| 期望 | 捕获异常，返回 null，不抛错 |

#### TC1.3 衣橱 CRUD — 创建
| 文件 | `outfitService.test.js` |
| 输入 | `characterId=1, dramaId=1, {name:"战斗装", description:"铠甲战袍"}` |
| 期望 | INSERT 成功，返回 outfit 对象含 id |

#### TC1.4 衣橱 CRUD — 列表
| 输入 | `characterId=1`（已有 3 个造型） |
| 期望 | 返回 3 条，默认造型排最前 |

#### TC1.5 衣橱 CRUD — 删除默认造型
| 输入 | 该造型是 default + 角色只有 1 个造型 |
| 期望 | 返回 403 错误，不可删除最后一个造型 |

#### TC1.6 三视图生成 — 并行
| 输入 | `outfitId=1`（锚点已填） |
| Mock | `imageService.processImageGeneration` → 3 次调用均返回固定路径 |
| 期望 | 3 次 image 调用并发，output 含 front/side/back 路径 |

#### TC1.7 锚点注入 — prompt 增强
| 输入 | `basePrompt="武侠打斗场景"+ outfitAnchors={hair:"长发",face:"国字脸",...}` |
| 期望 | 输出 prompt 末尾包含 `"Character features: 长发, 国字脸, ..."` |

### API 集成测试

#### TC1.8 POST /api/v1/characters/:id/outfits
| 请求 | `{ name:"日常装", description:"便服" }` |
| 期望 | 201 + outfit 对象 |

#### TC1.9 GET /api/v1/characters/:id/outfits
| 请求 | 无参数 |
| 期望 | 200 + 数组，含图片路径和锚点 |

#### TC1.10 POST /api/v1/outfits/:id/generate-views
| Mock | imageService 全 mock |
| 期望 | 201 + `{ task_id }`，轮询后三图路径填回 |

#### TC1.11 POST /api/v1/characters/:id/extract-anchors
| 请求 | body: `{ description: "..." }` |
| 期望 | 200 + 锚点 JSON |

### 前端冒烟

- [ ] 角色详情页出现「衣橱」Tab
- [ ] 添加造型 → 输入名称/描述 → 保存
- [ ] 点击「提取锚点」→ 锚点字段自动填充
- [ ] 点击「生成三视图」→ 进度 + 三张预览图
- [ ] 分镜页选择角色时可选衣橱具体造型
- [ ] 无衣橱时老流程不受影响

---

## Week 2 — 视频时间线编辑器

### 单元测试

#### TC2.1 ffmpeg segments 拼接命令生成
| 文件 | `timelineMerge.test.js` |
| 输入 | `segments=[{videoPath:"a.mp4",startSec:0,endSec:5,transition:"fade"},{videoPath:"b.mp4",startSec:2,endSec:8,transition:"cut"}]` |
| 期望 | 验证生成的 ffmpeg 命令包含 `-ss 0 -to 5`、fade filter、concat demuxer 列表文件 |

#### TC2.2 视频元数据提取
| 输入 | 测试视频文件（1-3 秒） |
| 期望 | 返回 `{ duration: N, thumbnailPath: "..." }` |

#### TC2.3 空 segments 回退
| 输入 | `segments_json = null` |
| 期望 | 走原 `mergeVideoFiles` 逻辑 |

### API 集成测试

#### TC2.4 GET /api/v1/dramas/:id/merge/preview
| 期望 | 200 + 数组，每项含 id/videoPath/duration/thumbnail |

#### TC2.5 POST /api/v1/dramas/:id/merge/execute
| 请求 | body: `{ segments: [有序列表] }` |
| 期望 | 201 + task_id，轮询后返回合并视频路径 |

#### TC2.6 无 segments 时 POST /api/v1/dramas/:id/merge/execute
| 请求 | body: `{}`（无 segments） |
| 期望 | 走老逻辑合并，200 + task_id |

### 前端冒烟

- [ ] 时间线页面加载，分镜卡片按序排列
- [ ] 拖拽卡片 → 顺序变化
- [ ] 裁剪 Marker 拖动 → 卡片上显示新起止时间
- [ ] 点击卡片 → 预览区播放
- [ ] 选择转场 → 合成 → 成品含转场效果
- [ ] 不排版直接合成 → 走老逻辑

---

## Week 3-4 — AI Agent 工作流

### 单元测试

#### TC3.1 DAG 拓扑排序
| 文件 | `agentScheduler.test.js` |
| 输入 | `full-production` pipeline 定义（8 steps） |
| 期望 | 拓扑排序正确，`generate-chars` 和 `generate-scenes` 同一层级 |

#### TC3.2 就绪步骤计算
| 输入 | pipeline 状态: extract-characters=success, extract-scenes=success, 其他=pending |
| 期望 | `getReadySteps()` 返回 `[generate-chars, generate-scenes, storyboard]` |

#### TC3.3 步骤执行
| 输入 | `executeStep(pipelineId, "extract-characters")` |
| Mock | `serviceRegistry.characterGeneration` → 成功 |
| 期望 | step 状态: running → success，output_json 有值 |

#### TC3.4 并行执行验证
| 输入 | 同时调用 `executeStep(pipelineId, "generate-chars")` 和 `executeStep(pipelineId, "generate-scenes")` |
| Mock | 两个 service 都 latency 500ms |
| 期望 | 总耗时 < 600ms（证明并行），两步都 success |

#### TC3.5 重试机制
| 输入 | step 第一次失败 + 第二次失败 + 第三次成功 |
| 期望 | retry_count=2, 最终 status=success |

#### TC3.6 重试耗尽
| 输入 | step 连续失败 3 次以上 |
| 期望 | status=failed, retry_count=3, error_msg 有值 |

#### TC3.7 跳过失败步骤
| 输入 | step=failed, 手动 skip |
| 期望 | status=skipped, 后续 depends 可执行 |

#### TC3.8 状态机非法转换
| 输入 | status 从 success 尝试变 running |
| 期望 | 抛错或拒绝 |

#### TC3.9 暂停/恢复
| 输入 | pipeline 状态 running → pause → resume |
| 期望 | 暂停后不触发新 step，恢复后从断点继续 |

### API 集成测试

#### TC3.10 POST /api/v1/dramas/:id/pipeline/start
| 期望 | 201 + pipeline_id, 8 个 step 创建 |

#### TC3.11 GET /api/v1/dramas/:id/pipeline/:pid/status
| 期望 | 200 + { status, progress, steps: [{step_id, status, retry_count}...] } |

#### TC3.12 POST .../pipeline/:pid/steps/:sid/retry
| 期望 | 步骤状态重置为 pending → 重新执行 |

#### TC3.13 POST .../pipeline/:pid/steps/:sid/skip
| 期望 | 步骤标记 skipped，后续步骤启动 |

### 前端冒烟

- [ ] 项目页「一键生成」按钮出现
- [ ] 点击 → PipelinePanel 弹出 → 步骤依次变绿
- [ ] generate-chars 和 generate-scenes 同时 running
- [ ] 失败步骤红色 + [重试] [跳过]
- [ ] 暂停/恢复功能正常
- [ ] 全部完成 → 面板显示完成状态

---

## Week 5 — 剧本专业化模板

### 单元测试

#### TC5.1 模板加载 — 正常
| 文件 | `promptTemplateEngine.test.js` |
| 输入 | `listAll()` |
| 期望 | 返回 10 个题材模板，每个含 id/name/character_archetypes/classic_tropes/three_act_structure |

#### TC5.2 模板加载 — 单模板
| 输入 | `get("revenge")` |
| 期望 | 返回复仇模板完整 YAML 内容 |

#### TC5.3 模板加载 — 不存在
| 输入 | `get("nonexistent")` |
| 期望 | 返回 null 或抛 NotFound |

#### TC5.4 故事 prompt 构建
| 输入 | `buildStoryPrompt(romanceBossTemplate, "灰姑娘遇上霸道总裁")` |
| 期望 | 输出含三幕结构 + 角色原型 + 桥段 的完整 prompt |

#### TC5.5 五维评分
| 输入 | 剧本 JSON |
| Mock | `aiClient.generateText` → `{"character_consistency":8,...}` |
| 期望 | 返回 5 个维度的评分，每个 1-10 |

#### TC5.6 评分 AI 异常
| 输入 | AI 返回非 JSON |
| 期望 | 捕获异常，返回 null 或默认评分 |

### API 集成测试

#### TC5.7 GET /api/v1/templates
| 期望 | 200 + 10 个模板简要信息 |

#### TC5.8 POST /api/v1/dramas/:id/generate-with-template
| 请求 | `{ template_id:"romance-boss", concept:"..." }` |
| Mock | AI 全 mock |
| 期望 | 201 + 故事含三幕标记 |

#### TC5.9 GET /api/v1/dramas/:id/quality-score
| 期望 | 200 + 五维评分 JSON |

### 前端冒烟

- [ ] 创建项目页出现题材下拉（10 选项）
- [ ] 选霸总 → 生成故事有霸道总裁味
- [ ] 分镜页显示节奏曲线（折线图）
- [ ] 五维评分展示（雷达图或柱状图）
- [ ] 不选模板时走自由模式

---

## Week 6-7 — TTS 增强 + 唇形同步

### 单元测试

#### TC6.1 多角色音色分配
| 文件 | mock `ttsService` |
| 输入 | storyboard 含 3 个角色对白 |
| 期望 | 每个角色分配不同 voice_id，性别匹配 |

#### TC6.2 情感参数映射
| 输入 | `{emotion:"angry", text:"..."}` |
| 期望 | TTS 调用参数含 `speed:1.2, pitch:+5` |

#### TC6.3 唇形同步任务创建
| 输入 | `{ videoGenerationId:1, audioPath:"..." }` |
| 期望 | INSERT video_lipsyncs，status=pending |

#### TC6.4 唇形同步 — ComfyUI 不可用时
| Mock | ComfyUI ping 失败 |
| 期望 | 返回 503 + `{ error: "lipsync_unavailable", message: "ComfyUI not connected" }` |

### API 集成测试

#### TC6.5 POST /api/v1/characters/:id/voice
| 请求 | `{ voice_id:"...", speed:1.0, pitch:0, emotion:"neutral" }` |
| 期望 | 201 + voice 对象 |

#### TC6.6 POST /api/v1/characters/:id/voice/clone
| 请求 | multipart upload 10s wav |
| Mock | MiniMax clone API |
| 期望 | 202 + `{ voice_id }` |

#### TC6.7 POST /api/v1/voices/:id/preview
| 期望 | 200 + 5s 音频文件 |

#### TC6.8 POST /api/v1/videos/:id/lipsync
| Mock | ComfyUI 成功 |
| 期望 | 201 + `{ lipsync_id }` |

#### TC6.9 GET /api/v1/lipsyncs/:id
| 期望 | 200 + `{ status, output_video_path }` |

### 前端冒烟

- [ ] 角色页「音色」Tab → 可选预设音色 → 试听
- [ ] 上传音频 → 音色克隆进度 → 新音色可用
- [ ] 分镜 TTS 自动匹配角色音色
- [ ] 视频生成后可选唇形同步按钮
- [ ] ComfyUI 离线时唇形同步按钮灰色 + 提示

---

## Week 8 — 运维守护 + 宫格图

### 单元测试

#### TC8.1 临时文件清理
| 文件 | `guardianService.test.js` |
| 准备 | temp 目录: 3 个文件 mtime>7天 + 2 个文件 mtime=1天 |
| 期望 | 只删 3 个旧文件，新文件保留 |

#### TC8.2 ComfyUI 健康检查
| Mock | axios.get → 成功 / 失败 |
| 期望 | healthy=true / false + 状态变化日志 |

#### TC8.3 磁盘空间监控
| Mock | 剩余 3GB（< 5GB 阈值） |
| 期望 | `canAcceptVideoTask()` = false |

#### TC8.4 任务超时
| 准备 | DB 中 1 条 async_task，status=running，updated_at > 30 分钟前 |
| 期望 | 状态变为 failed，error_msg = "timed out" |

#### TC8.5 宫格图合成 — 基础
| 文件 | `gridImageService.test.js` |
| 输入 | 4 张 512×512 测试图片 |
| 期望 | 输出 1024×1024，sharp metadata 确认 4 区域正确 |

#### TC8.6 宫格图合成 — 不足 4 张
| 输入 | 2 张图 |
| 期望 | 输出 1024×1024，左上+右上有图，下方空白无错 |

#### TC8.7 宫格视频切分
| 输入 | 48s 视频，segmentCount=4 |
| 期望 | 输出 4 个视频，各约 12s，ffprobe 验证时长 |

#### TC8.8 宫格视频切分 — 奇数时长
| 输入 | 47s 视频，segmentCount=4 |
| 期望 | 4 个视频，时长接近 11.75s，总时长=47s（无丢失） |

### API 集成测试

#### TC8.9 GET /api/v1/system/health
| 期望 | 200 + `{ comfyui:{healthy}, disk:{freeGB,canAcceptVideo}, tempFileCount, timedOutTasks }` |

#### TC8.10 POST /api/v1/grids/compose
| 请求 | `{ imagePaths: [4个路径], cols:2, rows:2 }` |
| 期望 | 201 + `{ gridPath, segmentMapping }` |

#### TC8.11 POST /api/v1/grids/decompose
| 请求 | `{ videoPath, segmentCount:4 }` |
| 期望 | 200 + `{ segments: [{index, path}] }` |

#### TC8.12 宫格图 via 任意协议
| 场景 | 宫格图作为 image → videoClient.generateVideo(imagePath, "comfyui") |
| 期望 | 与普通 I2V 行为完全一致 |

### 前端冒烟

- [ ] 设置页「系统状态」面板
- [ ] ComfyUI 离线 → 红色 Badge
- [ ] 磁盘不足 → 弹提示 + 禁止新视频
- [ ] 分镜页勾选 2-4 个 → 「合成宫格图」
- [ ] 宫格图生成 → 下拉选协议 → 提交 → 自动裁切

---

## 回归测试（每 Phase 上线前跑）

### 核心流程

- [ ] 创建项目 → 手动生成角色 → 生成场景 → 生成分镜
- [ ] 图片生成（dashscope / volcengine / openai 至少 3 协议）
- [ ] 视频生成（kling / comfyui 至少 2 协议）
- [ ] TTS 语音合成（MiniMax / edge-tts）
- [ ] ffmpeg 视频合并
- [ ] AI 配置增删改查 + 连接测试
- [ ] 文件上传下载
- [ ] 前端路由不 404
- [ ] `npm run dev` 零报错启动

### 运行命令

```bash
cd backend-node
npm test                    # 跑全部后端测试（目标 <60s）
npm test -- --coverage     # 含覆盖率报告
```
