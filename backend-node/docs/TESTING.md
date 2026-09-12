# 测试指南

## 快速开始

```bash
# 在 backend-node 目录下
npm test                # 跑全部测试（test/ 下 *.test.js 与 *.spec.js）
npm run test:unit       # 同上（当前未分子目录，等价）
npm run test:integration# 仅端到向测试（当前为 merge_e2e.test.js）
npm run test:coverage   # 带覆盖率
```

> ⚠️ **历史坑**：早期脚本指向 `tests/`（复数），但该目录从未建立，
> 导致 `npm test` 跑 **0 个用例却返回 exit=0**（假绿）。现已修正为 `test/`。

## 测试结构

实际目录为 `test/`（单数，非 `tests/`），当前 9 个测试文件、35 个用例：

```
backend-node/test/
├── agnesModelArray.test.js      # Agnes 模型数组解析（config.model 非字符串的修复）
├── agnesRateLimiter.test.js     # Agnes 官方 RPM 限流、档位归一化、429 冷却
├── consistency.test.js          # 跨集一致性校验
├── deepseekConfig.test.js       # DeepSeek 配置
├── jimengMaterialHub.test.js    # 即梦素材 Hub
├── libraryDedup.test.js         # 素材库去重
├── merge_e2e.test.js            # 视频合成端到端
├── rateLimitRetry.test.js       # 限流重试
└── vlmQualityService.test.js    # VLM 质量评估
```

前端另有 `frontweb/test/modelSelection.test.js`。

## 测试框架

- **Node.js 原生 `node:test`** — 零依赖
- **better-sqlite3** — 内存数据库（`:memory:`），与生产同引擎
- 断言使用 Node 内置 `node:assert`

## 运行要求（重要）

> ⚠️ **必须使用系统 Node v24.14.0**（`D:/Program Files/nodejs/node.exe`）。
> 托管 Node 22 与 better-sqlite3 的 ABI 不匹配，会产生**假失败**。

```bash
# 推荐用系统 Node 显式执行
"D:/Program Files/nodejs/node.exe" --test test/*.test.js
```

## 编写约定

- 数据库相关测试用 `:memory:` 建库，自建最小表结构（参考 `consistency.test.js`）
- 不依赖外部 API Key：所有 AI 调用在测试中应被 mock 或仅测纯函数
- 文件名以 `.test.js`（单元）或 `*_e2e.test.js`（端到端）结尾

## 覆盖率现状

| 层级 | 目标 | 当前 |
|------|:----:|:----:|
| utils 纯函数 | ≥ 95% | agnesRateLimiter ✅ |
| service 层 | ≥ 80% | consistency ✅、vlmQuality ✅ |
| routes 层 | ≥ 70% | 待补 |
| E2E | 主链路 3 场景 | merge_e2e 部分 |
