const path = require('path');
const dbPath = path.resolve(__dirname, '../backend-node/data/drama_generator.db');
console.log('dbPath:', dbPath);
const db = require(path.resolve(__dirname, '../backend-node/node_modules/better-sqlite3'))(dbPath);

// Fix base_url port from 18188 to 8188 for all comfyui video configs
const fix = db.prepare("UPDATE ai_service_configs SET base_url='http://localhost:8188' WHERE provider='comfyui' AND service_type='video'").run();
console.log('Updated base_url rows:', fix.changes);

// Update workflow_file for wan2.1 i2v (id=14) to use GGUF workflow
const config = db.prepare("SELECT * FROM ai_service_configs WHERE id=14").get();
const newSettings = JSON.parse(config.settings);
console.log('Old workflow_file:', newSettings.workflow_file);
newSettings.workflow_file = 'wan21_gguf_i2v.json';
newSettings.description = 'Wan2.1 I2V 14B GGUF single-step generation';
const updateStmt = db.prepare("UPDATE ai_service_configs SET settings=? WHERE id=14").run(JSON.stringify(newSettings));
console.log('Updated workflow_file for id=14:', updateStmt.changes);

// Verify
const updated = db.prepare("SELECT * FROM ai_service_configs WHERE id=14").get();
console.log('Updated config:', JSON.stringify({id:updated.id, name:updated.name, base_url:updated.base_url, settings:JSON.parse(updated.settings)}, null, 2));

// Show all comfyui configs
const allComfyui = db.prepare("SELECT id, name, base_url, default_model, settings FROM ai_service_configs WHERE provider='comfyui' AND service_type='video'").all();
console.log('\nAll ComfyUI video configs:');
allComfyui.forEach(c => console.log(`  [${c.id}] ${c.name} | ${c.base_url} | default_model: ${c.default_model} | workflow: ${JSON.parse(c.settings).workflow_file}`));

db.close();
