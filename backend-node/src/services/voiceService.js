// 角色音色服务
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const https = require('https');
const http = require('http');
const aiConfigService = require('./aiConfigService');

/**
 * 使用 MiniMax T2A v2 合成语音（支持 speed/pitch/emotion 参数）
 */
async function synthesizeWithMinimaxEnhanced(text, voiceId, apiKey, groupId, model, speed, pitch, emotion) {
  const body = JSON.stringify({
    model: model || 'speech-02-hd',
    text,
    stream: false,
    voice_setting: {
      voice_id: voiceId || 'female-shaonv',
      speed: parseFloat(speed) || 1.0,
      vol: 1.0,
      pitch: parseInt(pitch) || 0,
      emotion: emotion || null,
    },
    audio_setting: {
      sample_rate: 32000,
      bitrate: 128000,
      format: 'mp3',
      channel: 1,
    },
  });
  const url = `https://api.minimax.chat/v1/t2a_v2?GroupId=${groupId}`;
  return new Promise((resolve, reject) => {
    const reqOpts = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Content-Length': Buffer.byteLength(body),
      },
    };
    const urlObj = new URL(url);
    const client = urlObj.protocol === 'https:' ? https : http;
    const req = client.request(urlObj, reqOpts, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`MiniMax TTS HTTP ${res.statusCode}: ${Buffer.concat(chunks).toString()}`));
          return;
        }
        const data = JSON.parse(Buffer.concat(chunks).toString());
        if (data.base_resp?.status_code !== 0) {
          reject(new Error(`MiniMax TTS error: ${data.base_resp?.status_msg || 'unknown'}`));
          return;
        }
        const audioHex = data.data?.audio;
        if (!audioHex) { reject(new Error('MiniMax TTS 未返回音频')); return; }
        resolve(Buffer.from(audioHex, 'hex'));
      });
    });
    const timer = setTimeout(() => {
      req.destroy();
      reject(new Error('MiniMax TTS 请求超时 (120s)'));
    }, 120000);
    req.on('error', e => { clearTimeout(timer); reject(e); });
    req.write(body);
    req.end();
  });
}

/**
 * 使用 OpenAI TTS API 合成语音（支持 speed 参数）
 */
async function synthesizeWithOpenaiEnhanced(text, voice, apiKey, baseUrl, model, speed) {
  const url = (baseUrl || 'https://api.openai.com/v1').replace(/\/+$/, '') + '/audio/speech';
  const body = JSON.stringify({
    model: model || 'tts-1',
    input: text,
    voice: voice || 'alloy',
    response_format: 'mp3',
    speed: parseFloat(speed) || 1.0,
  });
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const mod = parsed.protocol === 'https:' ? https : http;
    const reqOpts = {
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        ...(apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {}),
      },
    };
    const req = mod.request(reqOpts, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`OpenAI TTS HTTP ${res.statusCode}: ${buf.toString('utf-8').slice(0, 500)}`));
          return;
        }
        resolve(buf);
      });
    });
    const timer = setTimeout(() => { req.destroy(); reject(new Error('OpenAI TTS 请求超时')); }, 120000);
    req.on('error', (e) => { clearTimeout(timer); reject(e); });
    req.on('close', () => clearTimeout(timer));
    req.write(body);
    req.end();
  });
}

/**
 * 创建角色音色配置
 * @param {object} db - database instance
 * @param {number} characterId - 角色ID
 * @param {object} data - 音色数据 {name, provider, voice_id, gender, age_group, speed, pitch, emotion}
 * @returns {object} 创建的音色记录
 */
function createVoice(db, characterId, data) {
  // 验证角色是否存在
  const char = db.prepare('SELECT id FROM characters WHERE id = ?').get(characterId);
  if (!char) {
    throw new Error('角色不存在');
  }

  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO character_voices 
    (character_id, voice_id, provider, name, gender, age_group, speed, pitch, emotion, sample_audio_path, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    characterId,
    data.voice_id || null,
    data.provider || 'minimax',
    data.name || '',
    data.gender || null,
    data.age_group || null,
    data.speed !== undefined ? parseFloat(data.speed) : 1.0,
    data.pitch !== undefined ? parseInt(data.pitch) : 0,
    data.emotion || null,
    data.sample_audio_path || null,
    now,
    now
  );

  const voiceId = db.prepare('SELECT last_insert_rowid() as id').get().id;
  return getVoice(db, voiceId);
}

/**
 * 列出角色所有音色
 * @param {object} db - database instance
 * @param {number} characterId - 角色ID
 * @returns {array} 音色列表
 */
function listVoicesByCharacter(db, characterId) {
  // 验证角色是否存在
  const char = db.prepare('SELECT id FROM characters WHERE id = ?').get(characterId);
  if (!char) {
    throw new Error('角色不存在');
  }

  return db.prepare(`
    SELECT * FROM character_voices 
    WHERE character_id = ?
    ORDER BY created_at DESC
  `).all(characterId);
}

/**
 * 获取单个音色
 * @param {object} db - database instance
 * @param {number} voiceId - 音色ID
 * @returns {object} 音色记录
 */
function getVoice(db, voiceId) {
  const voice = db.prepare(`
    SELECT * FROM character_voices 
    WHERE id = ?
  `).get(voiceId);

  if (!voice) {
    throw new Error('音色不存在');
  }

  return voice;
}

/**
 * 更新音色
 * @param {object} db - database instance
 * @param {number} voiceId - 音色ID
 * @param {object} data - 更新数据 {name, provider, voice_id, gender, age_group, speed, pitch, emotion, sample_audio_path}
 * @returns {object} 更新后的音色记录
 */
function updateVoice(db, voiceId, data) {
  // 检查音色是否存在
  const existing = getVoice(db, voiceId);

  const fields = [];
  const values = [];

  if (data.voice_id !== undefined) {
    fields.push('voice_id = ?');
    values.push(data.voice_id);
  }

  if (data.provider !== undefined) {
    fields.push('provider = ?');
    values.push(data.provider);
  }

  if (data.name !== undefined) {
    fields.push('name = ?');
    values.push(data.name);
  }

  if (data.gender !== undefined) {
    fields.push('gender = ?');
    values.push(data.gender);
  }

  if (data.age_group !== undefined) {
    fields.push('age_group = ?');
    values.push(data.age_group);
  }

  if (data.speed !== undefined) {
    fields.push('speed = ?');
    values.push(parseFloat(data.speed));
  }

  if (data.pitch !== undefined) {
    fields.push('pitch = ?');
    values.push(parseInt(data.pitch));
  }

  if (data.emotion !== undefined) {
    fields.push('emotion = ?');
    values.push(data.emotion);
  }

  if (data.sample_audio_path !== undefined) {
    fields.push('sample_audio_path = ?');
    values.push(data.sample_audio_path);
  }

  if (fields.length === 0) {
    return existing; // 没有更新
  }

  fields.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(voiceId);

  db.prepare(`
    UPDATE character_voices 
    SET ${fields.join(', ')}
    WHERE id = ?
  `).run(...values);

  return getVoice(db, voiceId);
}

/**
 * 删除音色（硬删除，因为表中没有 deleted_at 列）
 * @param {object} db - database instance
 * @param {number} voiceId - 音色ID
 * @returns {boolean} 是否删除成功
 */
function deleteVoice(db, voiceId) {
  const voice = getVoice(db, voiceId);
  if (!voice) {
    return false;
  }

  db.prepare('DELETE FROM character_voices WHERE id = ?').run(voiceId);

  return true;
}

/**
 * 分配声音到故事板台词
 * @param {array} storyboardRows - 故事板行数据
 * @param {object} characterVoices - 角色ID到声音配置的映射 {characterId: {voiceId, emotion}}
 * @returns {array} 分配了voice_id和emotion的故事板行
 */
function assignVoicesToStoryboard(storyboardRows, characterVoices) {
  return storyboardRows.map(row => {
    const characterId = row.character_id;
    const voiceConfig = characterVoices[characterId];

    // 复制行数据以避免修改原始数据
    const assignedRow = { ...row };

    if (voiceConfig) {
      assignedRow.voice_id = voiceConfig.voice_id;
      assignedRow.emotion = voiceConfig.emotion;
    } else {
      // 如果没有分配特定声音，使用null表示使用默认
      assignedRow.voice_id = null;
      assignedRow.emotion = null;
    }

    return assignedRow;
  });
}

/**
 * 生成带声音配置的TTS
 * @param {string} text - 要合成的文本
 * @param {object} voiceConfig - 声音配置 {provider, voice_id, api_key, group_id, model, speed, pitch, emotion, voice}
 * @param {string} outputBasePath - 输出文件基础路径（不含文件名）
 * @returns {Promise<{local_path: string}>} 合成结果
 */
async function generateTTSWithVoice(text, voiceConfig, outputBasePath) {
  if (!text || !text.trim()) {
    throw new Error('text 不能为空');
  }

  const provider = (voiceConfig.provider || 'minimax').toLowerCase();

  let audioBuffer;

  if (provider === 'minimax') {
    const voiceId = voiceConfig.voice_id;
    const apiKey = voiceConfig.api_key;
    const groupId = voiceConfig.group_id;
    const model = voiceConfig.model;

    if (!apiKey || !groupId) {
      throw new Error('MiniMax TTS 需要 api_key 和 group_id');
    }

    const speed = voiceConfig.speed !== undefined ? voiceConfig.speed : 1.0;
    const pitch = voiceConfig.pitch !== undefined ? voiceConfig.pitch : 0;
    const emotion = voiceConfig.emotion || null;

    audioBuffer = await synthesizeWithMinimaxEnhanced(
      text, voiceId, apiKey, groupId, model, speed, pitch, emotion
    );
  } else if (provider === 'openai' || provider === 'openai-compatible') {
    const voice = voiceConfig.voice || voiceConfig.voice_id || 'alloy';
    const apiKey = voiceConfig.api_key;
    const baseUrl = voiceConfig.base_url;
    const model = voiceConfig.model;
    const speed = voiceConfig.speed !== undefined ? voiceConfig.speed : 1.0;

    audioBuffer = await synthesizeWithOpenaiEnhanced(text, voice, apiKey, baseUrl, model, speed);
  } else if (provider === 'edge-tts') {
    throw new Error('edge-tts provider 需要额外安装 edge-tts npm 包，当前未实现');
  } else {
    throw new Error(`不支持的 TTS provider: ${provider}`);
  }

  // 保存到本地
  if (!fs.existsSync(outputBasePath)) {
    fs.mkdirSync(outputBasePath, { recursive: true });
  }
  const filename = `voice_${randomUUID().slice(0, 8)}.mp3`;
  const filePath = path.join(outputBasePath, filename);
  fs.writeFileSync(filePath, audioBuffer);
  const localPath = path.relative(process.cwd(), filePath); // 相对路径

  return { local_path: localPath };
}

/**
 * 生成5秒试用音频
 * @param {object} db - database instance
 * @param {number} voiceId - 音色ID
 * @returns {Promise<{local_path: string}>} 试用音频路径
 */
async function previewVoice(db, voiceId) {
  const voice = getVoice(db, voiceId);

  // 加载主配置以获取存储路径
  const loadConfig = require('../config').loadConfig;
  const cfg = loadConfig();

  // 获取默认 TTS 配置
  const ttsConfigs = aiConfigService.listConfigs(db, 'tts');
  const activeConfigs = ttsConfigs.filter(c => c.is_active);
  const ttsConfig = activeConfigs.find(c => c.is_default) || activeConfigs[0];

  if (!ttsConfig) {
    throw new Error('未配置 TTS 模型，请在「AI 配置」中添加 service_type=tts 的配置');
  }

  // 解析 TTS 配置
  let ttsSettings = {};
  try { ttsSettings = JSON.parse(ttsConfig.settings || '{}'); } catch (_) {}

  // 构建 voiceConfig 用于 generateTTSWithVoice
  const voiceConfig = {
    provider: ttsConfig.provider || 'minimax',
    voice_id: voice.voice_id || ttsConfig.voice_id || ttsSettings.voice_id,
    api_key: ttsConfig.api_key,
    group_id: ttsConfig.group_id || ttsSettings.group_id,
    model: ttsConfig.default_model || (Array.isArray(ttsConfig.model) ? ttsConfig.model[0] : ttsConfig.model) || ttsSettings.model,
    speed: voice.speed !== undefined ? voice.speed : (ttsSettings.speed || 1.0),
    pitch: voice.pitch !== undefined ? voice.pitch : (ttsSettings.pitch || 0),
    emotion: voice.emotion || ttsSettings.emotion
  };

  // 生成试用文本（5秒左右的中文文本）
  const sampleText = "这是一个声音试用样本，用于展示该音色的音质和语调。音色试用，音色试用。";

  // 确定存储路径（audio/ 预览目录）
  const storagePath = (() => {
    const raw = cfg.storage?.local_path || './data/storage';
    return path.isAbsolute(raw) ? raw : path.join(process.cwd(), raw);
  })();
  const previewPath = path.join(storagePath, 'audio', 'previews');

  // 调用 TTS 合成
  const result = await generateTTSWithVoice(sampleText, voiceConfig, previewPath);

  return result;
}

module.exports = {
  createVoice,
  listVoicesByCharacter,
  getVoice,
  updateVoice,
  deleteVoice,
  assignVoicesToStoryboard,
  generateTTSWithVoice,
  previewVoice
};