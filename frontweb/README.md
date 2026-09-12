# LocalMiniDrama 前端（web2）

本地短剧助手的**单页**前端，实现从故事到成片的完整流程，对接 Node 后端 `backend-node`。

**包名：** `LocalMiniDrama-film` · **版本：** `1.2.7`（与仓库根目录 [CHANGELOG](../CHANGELOG.md) 一致）

## 功能流程

1. **故事生成**：输入梗概 + 风格/类型 → 创建项目并保存第一集剧本
2. **剧本生成**：编辑剧本、标题/语言/分镜风格 → 保存
3. **角色生成**：AI 生成角色列表 → 每个角色可「AI 生成」形象（使用下方配置的图片模型）
4. **道具生成**：从剧本提取 / 手动添加 → 每个道具可「AI 生成」图片
5. **场景生成**：从剧本提取场景 → 每个场景可「AI 生成」图片
6. **分镜生成**：根据当前集生成分镜
7. **视频配置**：分辨率、配乐、音效、画质、字幕、水印；**AI 模型配置**（图片生成模型、视频生成模型）
8. **生成视频**：提交合成任务
9. **尾帧衔接**：提取本镜视频末帧设为下一镜首帧，提升镜间连贯
10. **导出分镜表**：导出 HTML 表格，含对白、解说、全能片段与提示词

### 生成能力

- **一键流水线**：角色 → 场景 → 道具 → 分镜图 → 视频 → 合成，全程自动；支持暂停 / 取消
- **就绪度检查**：合成前列出各分镜缺失素材（截图 / 视频）
- **跨集一致性校验**：`GET /dramas/:id/consistency`，检查角色重名、缺身份锚点、场景跨集重复

> 视频模型当前聚焦三家：WAN 3.0 / MiniMax Hailuo-03 / Agnes Video 2.5，
> 详见 [AI 配置指南](../docs/configuration.md)。

## 运行

```bash
# 安装依赖
npm install

# 开发（默认端口 3013，代理到后端 5679）
npm run dev

# 构建
npm run build
```

请先启动 `backend-node`（如 `http://localhost:5679`），并确保 `vite.config.js` 中 proxy 的 target 与后端一致。

```bash
# 测试（Node 原生 test runner）
npm test
```

## 技术栈

- Vue 3 + Vite
- Element Plus
- Pinia
- Vue Router
- Axios
- 纯 JavaScript（无 TypeScript）
