# AGENTS.md

## Cursor Cloud specific instructions

### Project Overview

LocalMiniDrama (本地短剧助手) — an AI-powered local short drama creation tool. Single product, three sub-projects sharing one repo (no monorepo tooling).

### Services

| Service | Directory | Port | Start Command |
|---------|-----------|------|---------------|
| Backend (Express + SQLite) | `backend-node/` | 5679 | `npm run dev` |
| Frontend (Vite + Vue 3) | `frontweb/` | 3013 | `npm run dev` |

Frontend proxies `/api` and `/static` to backend via Vite config.

### Running Tests

```bash
# Backend tests (Node.js built-in test runner)
cd backend-node && npm test        # 35 用例

# Frontend tests (ESM, Node.js built-in test runner)
cd frontweb && npm test
```

> ⚠️ **Node 版本要求**：后端测试必须使用**系统 Node v24.14.0**
> （`D:/Program Files/nodejs/node.exe`）。托管 Node 22 与 `better-sqlite3`
> ABI 不匹配，会产生**假失败**。

> 📌 测试目录是 `test/`（单数）。历史上 `package.json` 曾指向 `tests/`（不存在），
> 导致 `npm test` 跑 0 个用例却 exit=0 —— 已修正，勿改回。

No ESLint or other lint tool is configured in this codebase.

### Building

```bash
cd frontweb && npm run build
```

### Key Development Notes

- Pure JavaScript (no TypeScript) throughout.
- Backend uses `node --watch` for hot reloading in dev mode (`npm run dev`).
- Database is SQLite (embedded via `better-sqlite3`), auto-created in `backend-node/data/`.
- Migrations run automatically on backend startup (`ensureColumns()`); explicit `npm run migrate` only needed for first-time setup or after adding new migration SQL files.
- Config file at `backend-node/configs/config.yaml` already exists in the repo — no need to copy from example.
- AI content generation requires external API keys (configured via the app's "AI 配置" page), but the app fully functions without them for development/testing purposes.
- The backend also serves the built frontend from `frontweb/dist/` at port 5679 when the dist folder exists; during development, use the Vite dev server at port 3013 instead.
