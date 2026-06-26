const path = require('path');
console.log('__dirname:', __dirname);
console.log('cwd:', process.cwd());
const dbPath = path.resolve(__dirname, '../backend-node/data/drama_generator.db');
console.log('dbPath:', dbPath);
const db = require(path.resolve(__dirname, '../backend-node/node_modules/better-sqlite3'))(dbPath);
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r => r.name);
console.log('Tables:', tables.join(', '));

// Check ai_service_configs table
const configs = db.prepare("SELECT id, service_type, provider, name, base_url, model, default_model, is_default FROM ai_service_configs WHERE is_active=1").all();
console.log('AI Service Configs:', JSON.stringify(configs, null, 2));

// Check settings
const settings = db.prepare("SELECT name, value FROM settings").all().filter(r => r.name.includes('comfyui') || r.name.includes('wan') || r.name.includes('autodl'));
console.log('Relevant settings:', JSON.stringify(settings, null, 2));

db.close();
