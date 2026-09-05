// 角色衣橱服务：CRUD + 三视图并行生成
const path = require('path');
const fs = require('fs');
const imageService = require('./imageService');
const imageClient = require('./imageClient');
const storageLayout = require('./storageLayout');

function setupOutfitService(db, log) {
  const service = {
    /** 创建造型 */
    create(characterId, dramaId, data = {}) {
      const { name, description, hairStyle, faceShape, bodyType, skinTone, accessory } = data;
      if (!name || !String(name).trim()) throw new Error('造型名称必填');

      const char = db.prepare(
        'SELECT id FROM characters WHERE id = ? AND deleted_at IS NULL'
      ).get(Number(characterId));
      if (!char) throw new Error('角色不存在');

      const now = new Date().toISOString();
      const maxRow = db.prepare(
        'SELECT MAX(sort_order) as maxSort FROM character_outfits WHERE character_id = ?'
      ).get(Number(characterId));
      const sortOrder = (maxRow?.maxSort ?? 0) + 1;

      const info = db.prepare(`
        INSERT INTO character_outfits
        (character_id, drama_id, name, description, hair_style, face_shape, body_type, skin_tone, signature_accessory, sort_order, is_default, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        Number(characterId), Number(dramaId), String(name).trim(), description || null,
        hairStyle || null, faceShape || null, bodyType || null, skinTone || null,
        accessory || null, sortOrder, 1, now, now
      );

      return this.get(info.lastInsertRowid);
    },

    /** 获取单个造型 */
    get(outfitId) {
      const row = db.prepare(`
        SELECT o.*, c.name as character_name, c.identity_anchor_json
        FROM character_outfits o
        LEFT JOIN characters c ON o.character_id = c.id
        WHERE o.id = ? AND o.deleted_at IS NULL
      `).get(Number(outfitId));
      return row ? rowToItem(row) : null;
    },

    /** 列出角色所有造型 */
    listByCharacter(characterId) {
      const rows = db.prepare(`
        SELECT * FROM character_outfits
        WHERE character_id = ? AND deleted_at IS NULL
        ORDER BY is_default DESC, sort_order ASC
      `).all(Number(characterId));
      return rows.map(rowToItem);
    },

    /** 列出剧本下所有角色的造型 */
    listByDrama(dramaId) {
      const rows = db.prepare(`
        SELECT o.*, c.name as character_name
        FROM character_outfits o
        JOIN characters c ON o.character_id = c.id
        WHERE o.drama_id = ? AND o.deleted_at IS NULL
        ORDER BY c.name, o.is_default DESC, o.sort_order ASC
      `).all(Number(dramaId));
      return rows.map(rowToItem);
    },

    /** 更新造型 */
    update(outfitId, data) {
      const existing = this.get(outfitId);
      if (!existing) throw new Error('造型不存在');

      const allowed = ['name', 'description', 'hair_style', 'face_shape', 'body_type', 'skin_tone',
                       'signature_accessory', 'front_image_path', 'side_image_path', 'back_image_path',
                       'is_default', 'sort_order'];
      const updates = {};
      for (const key of allowed) {
        if (data[key] !== undefined) updates[key] = data[key];
      }
      updates.updated_at = new Date().toISOString();

      if (updates.is_default === 1) {
        db.prepare(`UPDATE character_outfits SET is_default = 0 WHERE character_id = ?`).run(existing.character_id);
      }

      const setClauses = Object.entries(updates).map(([k]) => `${k} = ?`).join(', ');
      const values = [...Object.values(updates), outfitId];
      db.prepare(`UPDATE character_outfits SET ${setClauses} WHERE id = ?`).run(...values);

      return this.get(outfitId);
    },

    /** 删除造型（默认造型不可删，除非是最后一个） */
    remove(outfitId) {
      const existing = this.get(outfitId);
      if (!existing) throw new Error('造型不存在');

      const totalForChar = db.prepare(
        'SELECT COUNT(*) as cnt FROM character_outfits WHERE character_id = ? AND deleted_at IS NULL'
      ).get(existing.character_id);

      if (existing.is_default === 1 && totalForChar.cnt > 1) {
        throw new Error('无法删除唯一的默认造型');
      }

      cleanupOutfitFiles(existing);

      const now = new Date().toISOString();
      db.prepare(
        'UPDATE character_outfits SET deleted_at = ? WHERE id = ?'
      ).run(now, Number(outfitId));
      return true;
    },

    /** 设为默认造型 */
    setDefault(outfitId) {
      const existing = this.get(outfitId);
      if (!existing) throw new Error('造型不存在');

      db.prepare(
        'UPDATE character_outfits SET is_default = 0 WHERE character_id = ?'
      ).run(existing.character_id);

      db.prepare(
        'UPDATE characters SET default_outfit_id = ? WHERE id = ?'
      ).run(Number(outfitId), existing.character_id);

      db.prepare(
        'UPDATE character_outfits SET is_default = 1, updated_at = ? WHERE id = ?'
      ).run(new Date().toISOString(), Number(outfitId));

      return this.get(outfitId);
    },

    /** 获取角色的默认造型 */
    getDefault(characterId) {
      const row = db.prepare(`
        SELECT o.*, c.name as character_name
        FROM character_outfits o
        JOIN characters c ON o.character_id = c.id
        WHERE o.character_id = ? AND o.is_default = 1 AND o.deleted_at IS NULL
      `).get(Number(characterId));
      return row ? rowToItem(row) : null;
    },

    /**
     * 三视图并行生成（异步，返回 task_id，前端轮询）
     * 不传 character_id 给 createAndGenerateImage，避免覆盖角色主图
     */
    generateThreeViews(outfitId, options = {}) {
      const outfit = this.get(outfitId);
      if (!outfit) throw new Error('造型不存在');

      const anchors = buildAnchors(outfit);

      // 构造三个角度的 prompt
      const prompts = {
        front: imageService.buildFullBodyPrompt(anchors, 'full-body front view, facing camera'),
        side:  imageService.buildFullBodyPrompt(anchors, 'full-body side profile view, left side'),
        back:  imageService.buildFullBodyPrompt(anchors, 'full-body back view, showing back of hair'),
      };

      // 获取图片配置
      const loadConfig = require('../config').loadConfig;
      const cfg = loadConfig();
      const imageConfig = imageClient.getDefaultImageConfig(db, options.model || null, null, 'image');
      const provider = imageConfig ? imageConfig.provider : 'openai';

      // 并行创建三个图片生成任务（不传 character_id，避免覆盖角色主图）
      const views = ['front', 'side', 'back'];
      const tasks = views.map(view => {
        const imageGen = imageClient.createAndGenerateImage(db, log, {
          drama_id: outfit.drama_id,
          prompt: prompts[view],
          model: options.model || undefined,
          size: options.size || '1024x1024',
          quality: options.quality || 'standard',
          provider,
        });
        return { view, image_gen_id: imageGen.id, task_id: imageGen.task_id };
      });

      // 将三个 image_gen_id 存到 outfit 临时字段（复用 description 字段标记）
      // 改用内存映射：记录 task_id → view → outfit_id，供 syncOutfitViews 查询
      const taskIdMap = {};
      tasks.forEach(t => { taskIdMap[t.task_id] = { view: t.view, outfit_id: outfitId }; });
      _pendingTaskMap.set('outfit_' + outfitId, taskIdMap);

      if (log) log.info('[衣橱] 三视图生成任务已提交', { outfit_id: outfitId, tasks });

      return {
        outfit_id: Number(outfitId),
        tasks,
        status: 'pending',
      };
    },

    /**
     * 同步三视图状态：检查 pending 的图片生成任务是否完成，
     * 完成则把 local_path 回写到 outfit 的 front/side/back_image_path
     */
    syncOutfitViews(outfitId) {
      const key = 'outfit_' + outfitId;
      const taskMap = _pendingTaskMap.get(key);
      if (!taskMap) return { status: 'no_pending' };

      const viewFieldMap = { front: 'front_image_path', side: 'side_image_path', back: 'back_image_path' };
      const updates = {};
      let allDone = true;

      for (const [taskId, info] of Object.entries(taskMap)) {
        // 直接从 async_tasks 查状态与结果
        const taskRow = db.prepare('SELECT status, result FROM async_tasks WHERE id = ?').get(taskId);
        if (!taskRow || taskRow.status === 'pending' || taskRow.status === 'processing') {
          allDone = false;
          continue;
        }
        if (taskRow.status === 'success') {
          try {
            const result = JSON.parse(taskRow.result || '{}');
            const field = viewFieldMap[info.view];
            if (result.local_path) updates[field] = result.local_path;
            else if (result.image_url) updates[field] = result.image_url;
          } catch (_) {}
          // 从 pending map 中移除
          delete taskMap[taskId];
        }
      }

      if (Object.keys(updates).length > 0) {
        updates.updated_at = new Date().toISOString();
        const setClauses = Object.entries(updates).map(([k]) => `${k} = ?`).join(', ');
        db.prepare(`UPDATE character_outfits SET ${setClauses} WHERE id = ?`).run(
          ...Object.values(updates), outfitId
        );
      }

      if (Object.keys(taskMap).length === 0) {
        _pendingTaskMap.delete(key);
      }

      return {
        status: allDone ? 'completed' : 'pending',
        updated_fields: Object.keys(updates),
        outfit: this.get(outfitId),
      };
    },

    /** 解析造型的锚点 */
    parseAnchors(outfitId) {
      const outfit = this.get(outfitId);
      if (!outfit) return null;
      return buildAnchors(outfit);
    },

    /** 从描述提取锚点并保存 */
    async extractAnchors(outfitId, description) {
      const anchorService = require('./identityAnchorService');
      const anchors = await anchorService.extractAnchors(description);

      if (!anchors) return null;

      const updateData = {
        hair_style: anchors.hair_style,
        face_shape: anchors.face_shape,
        body_type: anchors.body_type,
        skin_tone: anchors.skin_tone,
        signature_accessory: anchors.signature_accessory,
        updated_at: new Date().toISOString()
      };

      const setClauses = Object.entries(updateData).map(([k]) => `${k} = ?`).join(', ');
      db.prepare(`UPDATE character_outfits SET ${setClauses} WHERE id = ?`).run(
        ...Object.values(updateData), outfitId
      );

      return this.get(outfitId);
    }
  };

  return service;
}

// 内存映射：outfit_id → { task_id → { view, outfit_id } }
const _pendingTaskMap = new Map();

/** 将行数据转为响应格式 */
function rowToItem(row) {
  const {
    id, character_id, drama_id, name, description,
    hair_style, face_shape, body_type, skin_tone, signature_accessory,
    front_image_path, side_image_path, back_image_path,
    is_default, sort_order, created_at, updated_at,
    character_name
  } = row;
  return {
    id, character_id, drama_id, name, description,
    hair_style, face_shape, body_type, skin_tone, signature_accessory,
    front_image_path, side_image_path, back_image_path,
    is_default: Boolean(is_default), sort_order,
    character_name,
    created_at, updated_at
  };
}

/** 构造锚点对象 */
function buildAnchors(outfit) {
  return {
    hair: outfit.hair_style || '',
    face: outfit.face_shape || '',
    body: outfit.body_type || '',
    skin: outfit.skin_tone || '',
    accessory: outfit.signature_accessory || ''
  };
}

/** 清理造型关联的图片文件 */
function cleanupOutfitFiles(outfit) {
  const fields = ['front_image_path', 'side_image_path', 'back_image_path'];
  for (const field of fields) {
    const p = outfit[field];
    if (p && fs.existsSync(p)) {
      try { fs.unlinkSync(p); } catch (_) {}
    }
  }
}

module.exports = { setupOutfitService, buildAnchors };
