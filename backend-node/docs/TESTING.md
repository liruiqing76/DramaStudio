# 测试指南

## 快速开始

```bash
# 在 backend-node 目录下
npm test              # 跑全部测试
npm run test:unit     # 仅单元测试
npm run test:integration  # 仅集成测试
npm run test:coverage # 带覆盖率
```

## 测试结构

```
tests/
├── helpers/
│   └── testDb.js          # 内存 SQLite + 迁移容错辅助
├── unit/                  # 单元测试（纯函数，无 IO 依赖）
│   ├── safeJson.test.js          # JSON 解析修复链（33 用例）
│   ├── storageLayout.test.js     # 存储路径生成（17 用例）
│   ├── videoMerge.test.js        # 视频合成 CRUD（4 用例）
│   ├── promptI18n.test.js        # 双语提示词（6 用例）
│   ├── mediaAspectRatioSpec.test.js  # 画幅比例归一化（5 用例）
│   └── angleService.test.js      # 96种视角组合（18 用例）
├── integration/           # 集成测试（HTTP + DB）
│   └── security.spec.js          # API 安全基线（6 用例）
└── e2e/                   # E2E 测试（待补）
```

## 测试框架

- **Node.js 原生 `node:test`** — 零依赖，Node 18+ 内置
- **supertest** — HTTP 接口测试（devDependency）
- **better-sqlite3** — 内存数据库，与生产同引擎

## 已知 Bug（测试已标记 TODO）

| # | 文件 | Bug 描述 | 测试用例 |
|---|------|---------|---------|
| 1 | `src/utils/safeJson.js` | `repairTruncatedJsonArray` 嵌套数组截断：内层 `]` 误计 depth | `repairTruncatedJsonArray: 嵌套数组截断` |
| 2 | `src/app.js` | JSON body 限制 10MB 但错误提示写 16MB | `P0-Security: JSON body 限制` |
| 3 | `src/services/videoMergeService.js` | API 签名不统一（list 无 log 参数） | `videoMergeService: create + getById` |

## 覆盖率目标

| 层级 | 目标 | 当前 |
|------|:----:|:----:|
| 纯函数 utils | ≥ 95% | safeJson ✅、mediaAspectRatioSpec ✅、angleService ✅ |
| service 层 | ≥ 80% | storageLayout ✅、videoMerge 部分 |
| routes 层 | ≥ 70% | 待补 |
| E2E | 主链路 3 场景 | 待补 |
