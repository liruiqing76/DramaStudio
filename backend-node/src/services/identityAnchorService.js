// 角色特征锚点服务：AI 提取 + prompt 注入
const aiClient = require('./aiClient');

function setupIdentityAnchorService(db, log) {
  const service = {
    /**
     * 从角色描述提取结构化锚点
     * @param {string} description 角色描述
     * @returns {Promise<object|null>} 锚点对象或 null
     */
    async extractAnchors(description) {
      if (!description || !String(description).trim()) return null;

      const prompt = `从以下角色描述中提取结构化特征，严格返回JSON:
{
  "hair_style": "...",
  "face_shape": "...",
  "body_type": "...",
  "skin_tone": "...",
  "signature_accessory": "...",
  "clothing_style": "...",
  "age_range": "..."
}

角色描述: ${description.trim()}`;

      try {
        // 复用已修好的降级逻辑 - 使用非流式调用
        const response = await aiClient.generateText(db, log, 'text', prompt, undefined, {
          stream: false
        });
        
        if (!response?.body) return null;
        
        // 尝试解析 JSON
        let anchors;
        try {
          anchors = JSON.parse(response.body);
        } catch (e) {
          console.warn('AI 返回的不是有效 JSON:', response.body);
          return null;
        }

        // 验证必需字段
        const required = ['hair_style', 'face_shape', 'body_type', 'skin_tone'];
        const valid = required.every(field => 
          anchors[field] !== undefined && anchors[field] !== null && String(anchors[field]).trim() !== ''
        );
        
        if (!valid) {
          console.warn('锚点提取不完整:', anchors);
          return null;
        }

        return {
          hair_style: String(anchors.hair_style).trim(),
          face_shape: String(anchors.face_shape).trim(),
          body_type: String(anchors.body_type).trim(),
          skin_tone: String(anchors.skin_tone).trim(),
          signature_accessory: String(anchors.signature_accessory || '').trim(),
          clothing_style: String(anchors.clothing_style || '').trim(),
          age_range: String(anchors.age_range || '').trim()
        };
      } catch (err) {
        console.error('extractAnchors 失败:', err.message);
        return null;
      }
    },

    /**
     * 注入锚点到分镜 prompt
     * @param {string} basePrompt 基础 prompt
     * @param {object} outfitAnchors 锚点对象
     * @param {string} angle 角度（front/side/back）
     * @returns {string} 增强后的 prompt
     */
    injectToPrompt(basePrompt, outfitAnchors, angle) {
      if (!basePrompt || !outfitAnchors) return basePrompt || '';

      let anchorStr = `Character features: ${outfitAnchors.hair}, ${outfitAnchors.face}, ${outfitAnchors.body}, ${outfitAnchors.skin}`;
      if (outfitAnchors.signature_accessory) {
        anchorStr += `, distinctive ${outfitAnchors.signature_accessory}`;
      }

      // 根据角度调整描述
      let angleDesc = '';
      switch (angle) {
        case 'front':
          angleDesc = 'front view, facing camera';
          break;
        case 'side':
          angleDesc = 'side profile view';
          break;
        case 'back':
          angleDesc = 'back view, showing back of figure';
          break;
        default:
          angleDesc = 'full body view';
      }

      return `${basePrompt}, ${angleDesc}. ${anchorStr}.`;
    },

    /**
     * 将锚点存到角色表的 identity_anchor_json
     * @param {number} characterId 角色 ID
     * @param {object} anchors 锚点对象
     */
    saveToCharacter(characterId, anchors) {
      if (!characterId || !anchors) return;
      
      const json = JSON.stringify({
        hair_style: anchors.hair_style,
        face_shape: anchors.face_shape,
        body_type: anchors.body_type,
        skin_tone: anchors.skin_tone,
        signature_accessory: anchors.signature_accessory
      });
      
      db.prepare(
        'UPDATE characters SET identity_anchor_json = ? WHERE id = ?'
      ).run(json, Number(characterId));
    },

    /**
     * 从角色表读取锚点
     * @param {number} characterId 角色 ID
     * @returns {object|null} 锚点对象
     */
    loadFromCharacter(characterId) {
      const row = db.prepare(
        'SELECT identity_anchor_json FROM characters WHERE id = ? AND deleted_at IS NULL'
      ).get(Number(characterId));
      
      if (!row || !row.identity_anchor_json) return null;
      
      try {
        return JSON.parse(row.identity_anchor_json);
      } catch (e) {
        return null;
      }
    },

    /**
     * 获取锚点的缺失字段（用于手动填充提示）
     * @param {object} anchors 锚点对象
     * @returns {string[]} 缺失的字段列表
     */
    getMissingFields(anchors) {
      if (!anchors) return ['hair_style', 'face_shape', 'body_type', 'skin_tone'];
      
      const required = ['hair_style', 'face_shape', 'body_type', 'skin_tone'];
      return required.filter(field => 
        !anchors[field] || String(anchors[field]).trim() === ''
      );
    }
  };

  return service;
}

module.exports = { setupIdentityAnchorService };