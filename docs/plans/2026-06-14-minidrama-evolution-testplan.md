# MiniDrama 8周进化计划 — 测试计划

> 日期: 2026-06-14  
> 范围: 覆盖 Week 1-8 全部新增功能  
> 策略: 后端单元测试 + 集成测试 + 前端 E2E 冒烟测试

---

## 测试基础设施

### 测试框架

| 层 | 工具 | 说明 |
|-----|------|------|
| 后端单元测试 | vitest + supertest | 纯 JS/TS，零外部依赖 |
| 数据库测试 | SQLite 临时文件 | 每个测试用例独立 `:memory:` 或临时文件 |
| 前端冒烟 | Playwright / 手动 checklist | 轻量 E2E，不做全量覆盖率 |
| CI | GitHub Actions（可选） | 每次 commit 自动跑后端测试 |

### 测试目录结构

```
backend-node/
├── __tests__/
│   ├── unit/
│   │   ├── outfitService.test.js
│   │   ├── identityAnchorService.test.js
│   │   ├── agentScheduler.test.js
│   │   ├── promptTemplateEngine.test.js
│   │   ├── guardianService.test.js
│   │   └── gridImageService.test.js
│   └── integration/
│       ├── api-outfits.test.js
│       ├── api-timeline.test.js
│       ├── api-agent.test.js
│       ├── api-voice.test.js
│       └── api-lipsync.test.js
```

### 测试数据原则
- 不依赖外部 API（AI 调用全部 mock）
- 不依赖 ComfyUI（videoClient mock）
- 使用固定 seed 的测试图片/视频文件

---

## Week 1 — 角色衣橱系统 测试用例

### 后端单元测试

#### TC1.1 身份锚点提取
| 项目 | 内容 |
|------|------|
| 描述 | 给定角色描述文本，AI 提取结构化锚点 |
| 输入 | `"30岁冷酷将军，长发，国字脸，高大健壮，小麦肤色，左眼有刀疤"` |
| 期望 | 返回 `{hair:"长发", face:"国字脸", body:"高大健壮", skin:"小麦肤色", accessory:"左眼刀疤"}` |
| Mock | aiClient.generateText → 固定 JSON 响应 |

#### TC1.2 三视图并行生成
| 项目 | 内容 |
|------|------|
| 描述 | 一个角色调用三次 imageClient 生成正面/侧面/背面 |
| 输入 | `character_id + outfit_id + 锚点数据` |
| 期望 | `outfit.front_image_path / side_image_path / back_image_path` 均有值 |
| Mock | imageClient → 伪造本地图片路径 |

#### TC1.3 衣橱 CRUD
| 项目 | 内容 |
|------|------|
| 描述 | 创建/查询/更新/删除造型 |
| 输入 | 各种 CRUD 操作 |
| 期望 | 数据库正确读写，造型可关联角色 |

#### TC1.4 分镜 prompt 锚点注入
| 项目 | 内容 |
|------|------|
| 描述 | 分镜生成时，选择的衣橱锚点注入到 prompt |
| 输入 | `storyboard prompt + outfit_id` |
| 期望 | 输出 prompt 包含 `{hair_style}, {body_type}, {signature_accessory}` 等 |

### API 集成测试

#### TC1.5 POST /api/v1/outfits
| 项目 | 内容 |
|------|------|
| 请求 | `POST /api/v1/characters/:id/outfits` — JSON body 含 name, description, anchors |
| 期望 | 201 Created, 返回 outfit 对象 |

#### TC1.6 POST /api/v1/outfits/generate-views
| 项目 | 内容 |
|------|------|
| 请求 | 触发三视图生成 |
| 期望 | 200 + task_id，轮询后三视图路径填回 |

#### TC1.7 GET /api/v1/characters/:id/outfits
| 项目 | 内容 |
|------|------|
| 请求 | 查询角色全部衣橱 |
| 期望 | 200 + 数组，含图片路径和锚点数据 |

### 前端冒烟测试

- [ ] 角色详情页出现「衣橱」Tab
- [ ] 点击添加造型 → 输入名称 + 描述 → 保存
- [ ] 点击生成三视图 → 看到进度 → 三张预览图出现
- [ ] 分镜页面选择角色时可选衣橱中的具体造型

---

## Week 2 — 视频时间线编辑器 测试用例

### 后端单元测试

#### TC2.1 segments_json 拼接逻辑
| 项目 | 内容 |
|------|------|
| 描述 | 给定 segments_json，ffmpeg concat 参数生成正确 |
| 输入 | `[{clipId:1, start:0, end:5, transition:"fade"}, ...]` |
| 期望 | ffmpeg 命令参数包含 `-ss 0 -to 5` 和 fade filter |

#### TC2.2 视频元数据提取
| 项目 | 内容 |
|------|------|
| 描述 | 获取分镜视频的时长和缩略图 |
| 输入 | `video_path` |
| 期望 | 返回 `{duration: 5.2, thumbnail_path: "..."}` |

### API 集成测试

#### TC2.3 GET /api/v1/dramas/:id/merge/preview
| 项目 | 内容 |
|------|------|
| 请求 | 查询可合并的分镜视频列表 |
| 期望 | 200 + 数组，每项含 `id, video_path, duration, thumbnail` |

#### TC2.4 POST /api/v1/dramas/:id/merge/execute
| 项目 | 内容 |
|------|------|
| 请求 | 提交 segments_json（含排序/裁剪/转场） |
| 期望 | 200 + task_id, 轮询后返回合并视频路径 |

### 前端冒烟测试

- [ ] 时间线页面加载，分镜卡片按序排列
- [ ] 拖拽卡片到新位置，顺序变化
- [ ] 拖动裁剪手柄，显示新起止时间
- [ ] 点击卡片在预览区播放视频
- [ ] 选择转场类型（淡入淡出/黑场）
- [ ] 点击合成 → 等待进度 → 下载成品

---

## Week 3-4 — AI Agent 工作流 测试用例

### 后端单元测试

#### TC3.1 DAG 依赖解析
| 项目 | 内容 |
|------|------|
| 描述 | Pipeline JSON 解析为可执行步骤序列 |
| 输入 | `full-production` pipeline 定义 |
| 期望 | 生成拓扑排序的正确执行顺序，并行步骤识别正确 |

#### TC3.2 步骤执行器
| 项目 | 内容 |
|------|------|
| 描述 | 单个步骤调用对应 service |
| 输入 | `{service:"characterGeneration", params:{...}}` |
| 期望 | 正确路由到 `characterGenerationService`，mock 返回成功 |

#### TC3.3 并行执行
| 项目 | 内容 |
|------|------|
| 描述 | 无依赖步骤（generate-chars 和 generate-scenes）并行执行 |
| 输入 | Pipeline 含两个无依赖 step |
| 期望 | 两类 service 被同时调用（通过时间戳判断） |

#### TC3.4 错误处理 — 单步失败重试
| 项目 | 内容 |
|------|------|
| 描述 | 某步骤失败后自动重试，3 次后标为 FAILED |
| 输入 | Mock service 前 2 次抛错，第 3 次成功 |
| 期望 | 最终状态 SUCCESS，重试次数 = 2 |

#### TC3.5 错误处理 — 跳过失败
| 项目 | 内容 |
|------|------|
| 描述 | 某步骤 FAILED 后，用户请求跳过，继续后续步骤 |
| 输入 | 标记失败步骤为 SKIPPED |
| 期望 | 后续依赖步骤正常执行 |

#### TC3.6 状态机转换
| 项目 | 内容 |
|------|------|
| 描述 | 验证所有状态转换合法性 |
| 输入 | 各种状态转换尝试 |
| 期望 | PENDING→RUNNING→SUCCESS ✅ / FAILED→RUNNING ✅ / SUCCESS→RUNNING ❌ |

### API 集成测试

#### TC3.7 POST /api/v1/dramas/:id/pipeline/start
| 项目 | 内容 |
|------|------|
| 请求 | 启动 full-production pipeline |
| 期望 | 201 + pipeline_id, DAG 步骤全部创建 |

#### TC3.8 GET /api/v1/dramas/:id/pipeline/:pid/status
| 项目 | 内容 |
|------|------|
| 请求 | 查询流水线状态 |
| 期望 | 返回各步骤状态 + 当前进度百分比 |

#### TC3.9 POST /api/v1/dramas/:id/pipeline/:pid/steps/:sid/retry
| 项目 | 内容 |
|------|------|
| 请求 | 重试失败步骤 |
| 期望 | 步骤状态重置为 PENDING，重新执行 |

#### TC3.10 POST /api/v1/dramas/:id/pipeline/:pid/steps/:sid/skip
| 项目 | 内容 |
|------|------|
| 请求 | 跳过失败步骤 |
| 期望 | 步骤标记 SKIPPED，后续步骤开始执行 |

### 前端冒烟测试

- [ ] 项目页面出现「一键生成」按钮
- [ ] 点击后弹出流水线面板
- [ ] 步骤卡片依次变绿（等待 → 执行 → 完成）
- [ ] 并行步骤同时进行
- [ ] 失败步骤显示红色 + 「重试」「跳过」按钮
- [ ] 全部完成后显示「生成完成」

---

## Week 5 — 剧本专业化模板 测试用例

### 后端单元测试

#### TC5.1 题材模板加载
| 项目 | 内容 |
|------|------|
| 描述 | 从 YAML 文件加载题材模板 |
| 输入 | `romance-boss.yaml` |
| 期望 | 返回模板对象含角色原型/经典桥段/结构引导 |

#### TC5.2 三幕结构注入
| 项目 | 内容 |
|------|------|
| 描述 | 在 story prompt 中注入三幕结构约束 |
| 输入 | `genre: "revenge" + story_concept` |
| 期望 | 生成 prompt 包含 "第一幕:建置 → 第二幕:对抗 → 第三幕:解决" |

#### TC5.3 节奏曲线生成
| 项目 | 内容 |
|------|------|
| 描述 | 根据分镜数量生成紧张度曲线 |
| 输入 | `25 个分镜` |
| 期望 | 返回 25 个 1-10 的紧张度值，符合三幕结构趋势 |

#### TC5.4 五维质量评分
| 项目 | 内容 |
|------|------|
| 描述 | AI 对生成的剧本进行五维评分 |
| 输入 | `完整剧本 JSON（角色 + 分镜）` |
| 期望 | 返回 `{identity:8, logic:7, rhythm:9, dialogue:6, thrill:8}` |
| Mock | aiClient.generateText → 固定评分 JSON |

### API 集成测试

#### TC5.5 GET /api/v1/templates
| 项目 | 内容 |
|------|------|
| 请求 | 获取全部题材模板 |
| 期望 | 200 + 数组，含 10 个题材 |

#### TC5.6 POST /api/v1/stories/generate?template_id=revenge
| 项目 | 内容 |
|------|------|
| 请求 | 用复仇模板生成故事 |
| 期望 | 201 + 故事含三幕结构，quality_score 有值 |

### 前端冒烟测试

- [ ] 创建项目时出现「题材选择」下拉（10 个选项）
- [ ] 选霸总题材 → 生成的故事有霸总味道
- [ ] 分镜列表页面可看到节奏曲线图
- [ ] 生成完成后显示五维评分雷达图

---

## Week 6-7 — TTS 增强 + 唇形同步 测试用例

### 后端单元测试

#### TC6.1 多角色音色分配
| 项目 | 内容 |
|------|------|
| 描述 | 分镜生成后为每个角色分配不同 voice_id |
| 输入 | `storyboard 含 3 个角色对白` |
| 期望 | 每个角色获得不同 voice_id，男性角色=男声，女性=女声 |

#### TC6.2 情感参数转换
| 项目 | 内容 |
|------|------|
| 描述 | 台词情感标签映射为 TTS 参数 |
| 输入 | `{emotion:"angry", text:"你背叛了我！"}` |
| 期望 | TTS 调用参数含 `speed:1.2, pitch:+5, emotion:"angry"` |

#### TC6.3 MiniMax 声音克隆请求
| 项目 | 内容 |
|------|------|
| 描述 | 上传参考音频 → 调用 MiniMax 克隆 API |
| 输入 | `10 秒 wav + character_id` |
| 期望 | 返回 `voice_id`，存入 `character_voices` |

#### TC6.4 唇形同步任务
| 项目 | 内容 |
|------|------|
| 描述 | 视频 + 音频 → 请求远程 Wav2Lip |
| 输入 | `video_path + audio_path` |
| 期望 | 返回 `lipsync_task_id`，轮询后获得 `output_video_path` |
| Mock | Wav2Lip API → 复制输入视频为输出 |

### API 集成测试

#### TC6.5 POST /api/v1/characters/:id/voice
| 项目 | 内容 |
|------|------|
| 请求 | 配置角色音色参数 |
| 期望 | 201 + voice 对象 |

#### TC6.6 POST /api/v1/characters/:id/voice/clone
| 项目 | 内容 |
|------|------|
| 请求 | 上传参考音频文件 |
| 期望 | 异步任务返回 voice_id |

#### TC6.7 POST /api/v1/videos/:id/lipsync
| 项目 | 内容 |
|------|------|
| 请求 | 对已有视频执行唇形同步 |
| 期望 | 201 + task_id |

#### TC6.8 GET /api/v1/videos/:id/lipsync/status
| 项目 | 内容 |
|------|------|
| 请求 | 查询唇形同步进度 |
| 期望 | 返回 status + 完成后含 output_video_path |

### 前端冒烟测试

- [ ] 角色页面出现「音色」Tab → 可选预设音色/试听
- [ ] 上传音频文件 → 音色克隆 → 进度条 → 可用新音色
- [ ] 分镜 TTS 生成时自动分配角色音色
- [ ] 视频生成后可选择「唇形同步」→ 等待处理 → 播放带口型视频

---

## Week 8 — 运维守护 + 宫格图 测试用例

### 后端单元测试

#### TC8.1 临时文件清理
| 项目 | 内容 |
|------|------|
| 描述 | 清理 `output/temp/` 超 7 天文件 |
| 输入 | temp 目录含 5 个文件（3 个超 7 天 + 2 个 1 天内） |
| 期望 | 只删除 3 个旧文件，保留 2 个新文件 |

#### TC8.2 ComfyUI 健康检查
| 项目 | 内容 |
|------|------|
| 描述 | Ping ComfyUI → 状态更新 |
| 输入 | Mock: 成功 / 失败 |
| 期望 | 成功时状态=healthy，失败时状态=unhealthy + 日志告警 |

#### TC8.3 磁盘空间监控
| 项目 | 内容 |
|------|------|
| 描述 | 检查 temp 目录所在磁盘空间 |
| 输入 | Mock: 剩余 3GB（低于阈值） |
| 期望 | 触发告警，`canAcceptVideoTask()` 返回 false |

#### TC8.4 任务超时兜底
| 项目 | 内容 |
|------|------|
| 描述 | 超过 30 分钟的异步任务自动标记失败 |
| 输入 | `async_tasks` 表中 1 条超过 30 分钟的 running 记录 |
| 期望 | 状态变为 failed，error_msg = "timed out" |

#### TC8.5 宫格图合成
| 项目 | 内容 |
|------|------|
| 描述 | 4 张 512×512 图合成 2×2 宫格图 |
| 输入 | 4 张测试图片 |
| 期望 | 输出 1024×1024 宫格图，排列正确 |

#### TC8.6 宫格视频切分
| 项目 | 内容 |
|------|------|
| 描述 | 1 个视频包含 4 段 → 按时间等分切回 4 段 |
| 输入 | `48 秒视频，12 秒/段` |
| 期望 | 输出 4 个 12 秒视频 |

### API 集成测试

#### TC8.7 GET /api/v1/health/comfyui
| 项目 | 内容 |
|------|------|
| 请求 | 查询 ComfyUI 健康状态 |
| 期望 | 200 + `{healthy: true/false}` |

#### TC8.8 POST /api/v1/grids/compose
| 项目 | 内容 |
|------|------|
| 请求 | 对连续 4 个分镜启用宫格模式（传入 4 个 image 路径） |
| 期望 | 201 + 宫格图路径，输出 1024×1024 的 2×2 拼接图 |

#### TC8.9 POST /api/v1/grids/decompose
| 项目 | 内容 |
|------|------|
| 请求 | 对宫格图生成的视频进行裁切（传入 video 路径 + segmentCount=4） |
| 期望 | 200 + 4 个分镜视频路径数组 |

#### TC8.10 协议透明 — 宫格图→任意视频协议
| 项目 | 内容 |
|------|------|
| 描述 | 宫格图作为普通图片提交给当前项目配置的视频协议（ComfyUI/Kling/Vidu） |
| 输入 | 1 张宫格图 + 项目配置的 protocol |
| 期望 | 视频生成成功，与普通 I2V 行为一致，无需新增协议分支 |

### 前端冒烟测试

- [ ] 设置页面出现「系统状态」面板（ComfyUI 状态/磁盘空间）
- [ ] ComfyUI 离线时顶部显示红色 Badge
- [ ] 磁盘低时弹出提示 + 禁止新视频任务
- [ ] 分镜页面可选「宫格模式」→ 合成宫格图 → 下拉选择视频协议 → 提交生成
- [ ] 宫格视频生成后自动裁切回各分镜
- [ ] 宫格图提交协议与普通 I2V 使用相同流程（不新增特殊按钮/入口）

---

## 回归测试清单（每个 Phase 完成后执行）

### 回归范围
每次新 Phase 上线前，必须确认以下核心流程不受影响：

- [ ] 创建项目 → 手动生成角色 → 生成场景 → 生成分镜
- [ ] 图片生成（至少 3 种协议: dashscope / volcengine / openai）
- [ ] 视频生成（至少 2 种协议: kling / seedance）
- [ ] TTS 语音合成（MiniMax）
- [ ] ffmpeg 视频合并
- [ ] AI 配置增删改查 + 连接测试
- [ ] 文件上传下载

### 自动化回归
- 每个 Phase 的集成测试文件 `api-*.test.js` 包含核心 API 的冒烟用例
- `npm test` 跑全部后端测试（不超过 60 秒）
