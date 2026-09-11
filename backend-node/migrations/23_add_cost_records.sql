-- 成本追踪表：记录每次 AI 调用的 token 消耗和费用
CREATE TABLE IF NOT EXISTS cost_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    drama_id INTEGER,
    episode_id INTEGER,
    storyboard_id INTEGER,
    service_type TEXT NOT NULL,  -- e.g., 'image', 'video', 'tts'
    provider TEXT NOT NULL,      -- e.g., 'wan', 'kling', 'minimax'
    model TEXT,
    prompt_tokens INTEGER DEFAULT 0,
    completion_tokens INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    cost_usd REAL DEFAULT 0.0,   -- 成本（美元）
    cost_cny REAL DEFAULT 0.0,   -- 成本（人民币）
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (drama_id) REFERENCES dramas(id) ON DELETE SET NULL,
    FOREIGN KEY (episode_id) REFERENCES episodes(id) ON DELETE SET NULL,
    FOREIGN KEY (storyboard_id) REFERENCES storyboards(id) ON DELETE SET NULL
);
-- 添加索引以便查询
CREATE INDEX IF NOT EXISTS idx_cost_records_drama ON cost_records(drama_id);
CREATE INDEX IF NOT EXISTS idx_cost_records_episode ON cost_records(episode_id);
CREATE INDEX IF NOT EXISTS idx_cost_records_storyboard ON cost_records(storyboard_id);
CREATE INDEX IF NOT EXISTS idx_cost_records_service_provider ON cost_records(service_type, provider);