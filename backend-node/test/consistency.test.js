const test = require('node:test');
const assert = require('node:assert');
const Database = require('better-sqlite3');
const { checkDramaConsistency } = require('../src/services/consistencyService');

function makeDb() {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE episodes (id INTEGER PRIMARY KEY AUTOINCREMENT, drama_id INTEGER, episode_number INTEGER, title TEXT, deleted_at TEXT);
    CREATE TABLE characters (id INTEGER PRIMARY KEY AUTOINCREMENT, drama_id INTEGER, name TEXT, identity_anchors TEXT, appearance TEXT, ref_image TEXT, polished_prompt TEXT, deleted_at TEXT);
    CREATE TABLE scenes (id INTEGER PRIMARY KEY AUTOINCREMENT, drama_id INTEGER, episode_id INTEGER, location TEXT, time TEXT, deleted_at TEXT);
    CREATE TABLE storyboards (id INTEGER PRIMARY KEY AUTOINCREMENT, episode_id INTEGER, deleted_at TEXT);
  `);
  return db;
}

test('consistency: 标记缺锚点角色 / 重名 / 跨集重复场景', () => {
  const db = makeDb();
  db.prepare('INSERT INTO episodes (drama_id, episode_number) VALUES (1,1)').run();
  db.prepare("INSERT INTO characters (drama_id, name, identity_anchors) VALUES (1, '阿澈', '{\"bone\":\"高颧骨\"}')").run();
  db.prepare("INSERT INTO characters (drama_id, name, appearance) VALUES (1, '无锚点', '')").run();
  db.prepare("INSERT INTO characters (drama_id, name, identity_anchors) VALUES (1, '阿澈', '{\"bone\":\"高颧骨\"}')").run();
  db.prepare("INSERT INTO scenes (drama_id, episode_id, location, time) VALUES (1,1,'溜冰场','夜')").run();
  db.prepare("INSERT INTO scenes (drama_id, episode_id, location, time) VALUES (1,2,'溜冰场','日')").run();

  const out = checkDramaConsistency(db, 1);
  const codes = out.findings.map((f) => f.code);
  assert.ok(codes.includes('char_no_anchor'), '应检测到缺锚点角色');
  assert.ok(codes.includes('char_dup_name'), '应检测到重名角色');
  assert.ok(codes.includes('scene_cross_episode'), '应检测到跨集重复场景');
});

test('consistency: 健康剧本不产生告警', () => {
  const db = makeDb();
  db.prepare('INSERT INTO episodes (drama_id, episode_number) VALUES (1,1)').run();
  db.prepare("INSERT INTO characters (drama_id, name, identity_anchors) VALUES (1, '阿澈', '{\"bone\":\"高颧骨\"}')").run();
  db.prepare("INSERT INTO scenes (drama_id, episode_id, location, time) VALUES (1,1,'溜冰场','夜')").run();

  const out = checkDramaConsistency(db, 1);
  assert.ok(out.ok, '健康剧本应 ok=true');
  assert.ok(out.findings.every((f) => f.severity !== 'warning'), '不应有告警级发现');
});