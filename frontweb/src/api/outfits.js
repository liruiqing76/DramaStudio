import request from '@/utils/request'

/** 角色衣橱（造型）API：对接后端 outfits 路由 */
export const outfitAPI = {
  /** 列出角色的所有造型 GET /characters/:characterId/outfits */
  listByCharacter(characterId) {
    return request.get(`/characters/${characterId}/outfits`).then((r) => r?.outfits ?? r ?? [])
  },
  /** 创建造型 POST /characters/:characterId/outfits */
  create(characterId, data) {
    return request.post(`/characters/${characterId}/outfits`, data || {})
  },
  /** 列出剧本下所有造型 GET /dramas/:dramaId/outfits */
  listByDrama(dramaId) {
    return request.get(`/dramas/${dramaId}/outfits`).then((r) => r?.outfits ?? r ?? [])
  },
  /** 获取单个造型 GET /outfits/:outfitId */
  get(outfitId) {
    return request.get(`/outfits/${outfitId}`).then((r) => r?.outfit ?? r)
  },
  /** 更新造型 PUT /outfits/:outfitId */
  update(outfitId, data) {
    return request.put(`/outfits/${outfitId}`, data || {})
  },
  /** 删除造型 DELETE /outfits/:outfitId */
  remove(outfitId) {
    return request.delete(`/outfits/${outfitId}`)
  },
  /** 设为默认造型 PUT /characters/:characterId/outfits/:outfitId/default */
  setDefault(characterId, outfitId) {
    return request.put(`/characters/${characterId}/outfits/${outfitId}/default`)
  },
  /** 提交三视图生成 POST /outfits/:outfitId/generate-views */
  generateViews(outfitId, options = {}) {
    return request.post(`/outfits/${outfitId}/generate-views`, options)
  },
  /** 同步三视图生成状态 GET /outfits/:outfitId/generate-views/status */
  generateViewsStatus(outfitId) {
    return request.get(`/outfits/${outfitId}/generate-views/status`)
  },
  /** AI 提炼造型锚点 POST /outfits/:outfitId/extract-anchors */
  extractAnchors(outfitId, description) {
    return request.post(`/outfits/${outfitId}/extract-anchors`, { description })
  },
}