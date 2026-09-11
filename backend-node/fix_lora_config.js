const Database = require('better-sqlite3');
const db = new Database('./data/drama_generator.db');

const existing = db.prepare("SELECT id FROM ai_service_configs WHERE name='ComfyUI-Wan2.1-LoRA-I2V-720P'").get();
if (existing) {
  console.log('LoRA config already exists, id=' + existing.id);
  db.prepare("UPDATE ai_service_configs SET is_default=1 WHERE id=?").run(existing.id);
} else {
  const settings = JSON.stringify({
    workflow_file: 'wan21_fp8_lightx2v_720p.json',
    steps: 4,
    cfg: 1.0,
    fps: 16,
    default_duration: 2.5,
    timeout: 600,
    poll_interval: 10
  });
  db.prepare(`INSERT INTO ai_service_configs
    (name, provider, service_type, api_protocol, base_url, api_key,
     model, default_model, endpoint, query_endpoint,
     is_default, is_active, settings, created_at, updated_at)
    VALUES ('ComfyUI-Wan2.1-LoRA-I2V-720P', 'comfyui', 'video', 'comfyui',
     'http://127.0.0.1:8188', '',
     '["wan21-i2v-14b-lora"]', 'wan21-i2v-14b-lora',
     '/prompt', '/history/{prompt_id}',
     1, 1, ?, datetime('now'), datetime('now'))`).run(settings);
  console.log('LoRA config inserted');
}

db.prepare("UPDATE ai_service_configs SET is_default=0, updated_at=datetime('now') WHERE service_type='video' AND provider='comfyui' AND name != 'ComfyUI-Wan2.1-LoRA-I2V-720P'").run();
console.log('Other configs set to non-default');

const rows = db.prepare("SELECT id, name, is_default, settings FROM ai_service_configs WHERE service_type='video' AND provider='comfyui'").all();
for (const r of rows) console.log(r.id, r.name, 'default:'+r.is_default, 'settings:', r.settings);
db.close();
