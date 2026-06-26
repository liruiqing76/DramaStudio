const betterSqlite3 = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, '..', 'backend-node', 'data', 'drama_generator.db');
const db = betterSqlite3(dbPath);

// Update video config to use correct workflow file
const newSettings = JSON.stringify({
  workflow_file: 'wan22_gguf_t2v.json',
  workflow: 'wan2.1-t2v',
  timeout: 600,
  poll_interval: 5
});
db.prepare("UPDATE ai_service_configs SET settings = ? WHERE id = 8").run(newSettings);
console.log('Video config updated:', newSettings);

// Verify
const row = db.prepare("SELECT id, name, settings FROM ai_service_configs WHERE id = 8").get();
console.log('Verified:', JSON.stringify(row, null, 2));

db.close();
