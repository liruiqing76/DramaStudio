/**
 * subtitles.js — 字幕编辑路由（移植自 autoclip subtitle_editor API）
 *
 * 能力：
 *  GET  /api/v1/subtitles/parse            — 解析 SRT 为字粒度数据
 *  POST /api/v1/subtitles/render           — 基于字幕删除裁剪视频
 *  POST /api/v1/subtitles/export           — 导出编辑后的 SRT
 *  GET  /api/v1/subtitles/file            — 读取某视频的 SRT（或清单）
 *
 * 存储：config.storage.local_path（默认 ./data/storage），和 LMD 现有资产同构。
 */
const fs = require('fs');
const path = require('path');
const response = require('../response');
const subtitleEditor = require('../services/subtitleEditorService');

function routes(cfg, log) {
  const storageRoot = path.resolve(process.cwd(), cfg?.storage?.local_path || './data/storage');

  function resolveStorage(...segs) {
    const p = path.join(storageRoot, ...segs);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    return p;
  }

  return {
    /** POST /subtitles/parse { srtPath } → 字粒度数据+统计 */
    parseSrt: (req, res) => {
      try {
        const { srtPath } = req.body || {};
        if (!srtPath || !fs.existsSync(srtPath)) {
          return response.badRequest(res, 'srtPath 不存在');
        }
        const data = subtitleEditor.parseSrtToWordLevel(srtPath);
        const stats = subtitleEditor.getStats(data);
        response.success(res, { segments: data, stats });
      } catch (err) {
        log.error('subtitles parse', { error: err.message });
        response.internalError(res, err.message);
      }
    },

    /** POST /subtitles/render { videoPath, srtPath, deletedSegmentIds, outName? } → 裁剪后的视频 */
    render: (req, res) => {
      try {
        const { videoPath, srtPath, deletedSegmentIds, outName } = req.body || {};
        if (!videoPath || !fs.existsSync(videoPath)) return response.badRequest(res, 'videoPath 不存在');
        if (!srtPath || !fs.existsSync(srtPath)) return response.badRequest(res, 'srtPath 不存在');
        if (!Array.isArray(deletedSegmentIds)) return response.badRequest(res, 'deletedSegmentIds 必须是数组');

        const data = subtitleEditor.parseSrtToWordLevel(srtPath);
        if (!data.length) return response.badRequest(res, 'SRT 无可解析字幕');

        const safeName = (outName || `edited_${Date.now()}.mp4`).replace(/[^a-zA-Z0-9._-]/g, '_');
        const outPath = resolveStorage('subtitles', 'edited', safeName);
        const result = subtitleEditor.editVideoBySubtitle(videoPath, data, deletedSegmentIds, outPath, log);
        if (!result.success) return response.badRequest(res, result.error || '裁剪失败');

        const relative = path.relative(storageRoot, result.editedVideoPath).replace(/\\/g, '/');
        response.success(res, { ...result, localPath: result.editedVideoPath, url: `/static/${relative}` });
      } catch (err) {
        log.error('subtitles render', { error: err.message });
        response.internalError(res, err.message);
      }
    },

    /** POST /subtitles/export { videoPath, srtPath, deletedSegmentIds, outName? } → 只导出编辑后的 SRT */
    exportSrt: (req, res) => {
      try {
        const { srtPath, deletedSegmentIds, outName } = req.body || {};
        if (!srtPath || !fs.existsSync(srtPath)) return response.badRequest(res, 'srtPath 不存在');
        if (!Array.isArray(deletedSegmentIds)) return response.badRequest(res, 'deletedSegmentIds 必须是数组');

        const data = subtitleEditor.parseSrtToWordLevel(srtPath);
        const safeName = (outName || `edited_${Date.now()}.srt`).replace(/[^a-zA-Z0-9._-]/g, '_');
        const outPath = resolveStorage('subtitles', 'edited', safeName);
        const ok = subtitleEditor.exportEditedSrt(data, deletedSegmentIds, outPath);
        if (!ok) return response.internalError(res, '导出 SRT 失败');

        const relative = path.relative(storageRoot, outPath).replace(/\\/g, '/');
        response.success(res, { localPath: outPath, url: `/static/${relative}` });
      } catch (err) {
        log.error('subtitles export', { error: err.message });
        response.internalError(res, err.message);
      }
    },

    /** GET /subtitles/file?path=xxx&download=1 → 读取/下载 SRT */
    file: (req, res) => {
      try {
        const p = req.query.path;
        if (!p || !fs.existsSync(p)) return response.notFound(res, '文件不存在');
        const ext = path.extname(p).toLowerCase();
        if (ext === '.srt') {
          res.setHeader('Content-Type', 'text/plain; charset=utf-8');
          res.send(fs.readFileSync(p, 'utf8'));
        } else {
          res.setHeader('Content-Type', 'application/octet-stream');
          res.send(fs.readFileSync(p));
        }
      } catch (err) {
        log.error('subtitles file', { error: err.message });
        response.internalError(res, err.message);
      }
    },
  };
}

module.exports = routes;