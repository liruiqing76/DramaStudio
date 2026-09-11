-- 24_character_wardrobe.sql
-- 角色衣橱系统：衣橱表 + 角色表增强字段

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

CREATE INDEX IF NOT EXISTS idx_outfits_character ON character_outfits(character_id);
CREATE INDEX IF NOT EXISTS idx_outfits_drama ON character_outfits(drama_id);

-- characters 表增强（已有 identity_anchors 字段，用 ALTER 加新列）
ALTER TABLE characters ADD COLUMN default_outfit_id INTEGER;
ALTER TABLE characters ADD COLUMN identity_anchor_json TEXT;  -- JSON: {hair,face,body,skin,accessory}