/**
 * subtitleEditorService.js — 字幕编辑器服务（移植自 autoclip SubtitleProcessor + VideoEditor）
 *
 * 能力：
 *  1. parseSrtToWordLevel  — 把 SRT 解析成"字粒度"数据结构（每个字/词带时间戳）
 *  2. secondsToSrtTime     — 秒 → SRT 时间串
 *  3. buildEditedTimeline  — 根据要删除的字幕段生成保留片段时间轴（相邻合并）
 *  4. editVideoBySubtitle  — 基于字幕删除裁剪视频（ffmpeg 提取/拼接）
 *  5. exportEditedSrt      — 导出编辑后的 SRT
 *  6. getStats             — 字幕统计
 *
 * 依赖：已有的 ffmpegPath 工具 + 纯 Node.js（无第三方库）
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { getFfmpegPath, getFfprobePath } = require('../utils/ffmpegPath');
const crypto = require('crypto');

// 中文标点 + 空白 作为分词分隔符
const WORD_SEPARATORS = /[，。！？；：“”‘’（）【】、\s]+/;

function uuid() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** 秒 → SRT 时间串 (00:00:00,000) */
function secondsToSrtTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  const p2 = (n) => String(n).padStart(2, '0');
  return `${p2(h)}:${p2(m)}:${p2(s)},${String(ms).padStart(3, '0')}`;
}

/** SRT 时间串 → 秒 */
function srtTimeToSeconds(t) {
  const t2 = String(t || '').replace(',', '.').trim();
  const parts = t2.split(':');
  if (parts.length !== 3) return 0;
  const h = parseFloat(parts[0]) || 0;
  const m = parseFloat(parts[1]) || 0;
  const s = parseFloat(parts[2]) || 0;
  return h * 3600 + m * 60 + s;
}

/**
 * 解析 SRT 文件为"字粒度"结构
 * @param {string} srtPath  SRT 文件绝对路径
 * @returns {Array<{id,index,startTime,endTime,text,words:Array<{id,text,startTime,endTime}>}>}
 */
function parseSrtToWordLevel(srtPath) {
  if (!srtPath || !fs.existsSync(srtPath)) return [];
  let raw;
  try {
    raw = fs.readFileSync(srtPath, 'utf8');
  } catch {
    return [];
  }
  if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1); // strip BOM

  // 按空行切块
  const blocks = raw.split(/\r?\n\r?\n/).filter((b) => b.trim());
  const out = [];
  let touched = false;
  for (const block of blocks) {
    const lines = block.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) continue;
    // 第一行可能是序号，也可能直接是时间轴
    let timeLineIdx = 0;
    if (/^\d+$/.test(lines[0])) timeLineIdx = 1;
    if (timeLineIdx >= lines.length) continue;
    const m = lines[timeLineIdx].match(/(\d{1,2}:\d{2}:\d{2}[,.]\d{1,3})\s*-->\s*(\d{1,2}:\d{2}:\d{2}[,.]\d{1,3})/);
    if (!m) continue;
    const start = srtTimeToSeconds(m[1]);
    const end = srtTimeToSeconds(m[2]);
    const text = lines.slice(timeLineIdx + 1).join(' ').trim();
    if (!text) continue;

    const words = splitTextToWords(text, start, end);
    out.push({
      id: uuid(),
      index: out.length + 1,
      startTime: start,
      endTime: end,
      text,
      words,
    });
    touched = true;
  }
  return touched ? out : [];
}

/** 把一段文本按分隔符切成字词，均分时间戳 */
function splitTextToWords(text, startTime, endTime) {
  const clean = (text || '').trim();
  if (!clean) return [];
  const parts = clean.split(WORD_SEPARATORS).map((p) => p.trim()).filter(Boolean);
  if (!parts.length) return [];
  const totalDuration = Math.max(0, (endTime || 0) - (startTime || 0));
  const per = totalDuration / parts.length;
  return parts.map((w, i) => ({
    id: uuid(),
    text: w,
    startTime: (startTime || 0) + i * per,
    endTime: (startTime || 0) + (i + 1) * per,
  }));
}

/** 根据删除的字幕段生成保留片段时间轴（相邻 <0.1s 合并） */
function buildEditedTimeline(subtitleData, deletedSegmentIds) {
  const del = new Set(deletedSegmentIds || []);
  const picks = [];
  for (const seg of subtitleData) {
    if (!del.has(seg.id)) picks.push([seg.startTime, seg.endTime]);
  }
  if (!picks.length) return [];
  const merged = [picks[0]];
  for (let i = 1; i < picks.length; i++) {
    const [cs, ce] = picks[i];
    const [, le] = merged[merged.length - 1];
    if (cs <= le + 0.1) {
      merged[merged.length - 1][1] = Math.max(le, ce);
    } else {
      merged.push([cs, ce]);
    }
  }
  return merged;
}

/** 计算删除总时长 */
function calcDeletedDuration(subtitleData, deletedSegmentIds) {
  const del = new Set(deletedSegmentIds || []);
  return subtitleData
    .filter((s) => del.has(s.id))
    .reduce((acc, s) => acc + Math.max(0, (s.endTime || 0) - (s.startTime || 0)), 0);
}

/** 导出编辑后的 SRT */
function exportEditedSrt(subtitleData, deletedSegmentIds, outputPath) {
  try {
    const del = new Set(deletedSegmentIds || []);
    const keep = subtitleData.filter((s) => !del.has(s.id));
    keep.forEach((s, i) => { s.index = i + 1; });
    const lines = [];
    for (const s of keep) {
      lines.push(String(s.index));
      lines.push(`${secondsToSrtTime(s.startTime)} --> ${secondsToSrtTime(s.endTime)}`);
      lines.push(s.text, '');
    }
    fs.writeFileSync(outputPath, `\uFEFF${lines.join('\n')}\n`, 'utf8');
    return true;
  } catch {
    return false;
  }
}

/** ffprobe 时长 */
function probeDuration(filePath) {
  const bin = getFfprobePath();
  const r = spawnSync(bin, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', filePath], { encoding: 'utf8', maxBuffer: 1024 * 1024 });
  if (r.status !== 0) return null;
  const d = parseFloat(String(r.stdout || '').trim());
  return Number.isFinite(d) && d > 0 ? d : null;
}

/** ffmpeg 路径转义（供 filter 内嵌） */
function escapePathForFilter(absPath) {
  let s = path.resolve(absPath).replace(/\\/g, '/');
  if (/^[A-Za-z]:/.test(s)) s = s.replace(/^([A-Za-z]):/, '$1\\:');
  return s.replace(/'/g, "\\'");
}

/**
 * 基于字幕删除裁剪视频（核心：提取保留片段 → 拼接）
 * @param {string} videoPath       原始视频
 * @param {Array}  subtitleData    字粒度字幕数据
 * @param {Array}  deletedSegmentIds 要删除的段 id
 * @param {string} outputPath      输出 mp4
 * @param {object} log             日志
 * @returns {{success:boolean, error?:string, editedVideoPath?:string, totalDeletedDuration?:number, finalDuration?:number, timeline?:Array}}
 */
function editVideoBySubtitle(videoPath, subtitleData, deletedSegmentIds, outputPath, log) {
  const logger = log || console;
  try {
    const timeline = buildEditedTimeline(subtitleData, deletedSegmentIds);
    if (!timeline.length) return { success: false, error: '没有保留的时间段' };
    const totalDeleted = calcDeletedDuration(subtitleData, deletedSegmentIds);

    const outDir = path.dirname(outputPath);
    fs.mkdirSync(outDir, { recursive: true });

    let ok;
    if (timeline.length === 1) {
      ok = extractSingleSegment(videoPath, timeline[0][0], timeline[0][1], outputPath);
    } else {
      ok = concatMultipleSegments(videoPath, timeline, outputPath, logger);
    }
    if (!ok) return { success: false, error: '视频剪辑失败' };

    const finalDuration = probeDuration(outputPath);
    return {
      success: true,
      editedVideoPath: outputPath,
      totalDeletedDuration: totalDeleted,
      finalDuration,
      timeline,
    };
  } catch (e) {
    logger.error('subtitle edit failed', { error: e.message });
    return { success: false, error: e.message };
  }
}

/** 提取单段 */
function extractSingleSegment(videoPath, start, end, outputPath) {
  const bin = getFfmpegPath();
  const r = spawnSync(bin, [
    '-y', '-i', videoPath,
    '-ss', String(start), '-to', String(end),
    '-c:v', 'libx264', '-c:a', 'aac',
    '-movflags', '+faststart',
    outputPath,
  ], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  return r.status === 0;
}

/** 多段：先逐段提取到 tmp，再 concat demuxer 拼接 */
function concatMultipleSegments(videoPath, timeline, outputPath, logger) {
  const bin = getFfmpegPath();
  const tmpDir = fs.mkdtempSync(path.join(path.dirname(outputPath), '.segs-'));
  const listPath = path.join(tmpDir, 'list.txt');
  const segFiles = [];
  try {
    for (let i = 0; i < timeline.length; i++) {
      const [s, e] = timeline[i];
      const seg = path.join(tmpDir, `seg${i}.mp4`);
      const r = spawnSync(bin, ['-y', '-i', videoPath, '-ss', String(s), '-to', String(e), '-c:v', 'libx264', '-c:a', 'aac', seg], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
      if (r.status !== 0) return false;
      if (fs.existsSync(seg) && fs.statSync(seg).size > 300) segFiles.push(seg);
    }
    if (!segFiles.length) return false;
    const list = segFiles.map((f) => {
      const p = path.resolve(f).replace(/\\/g, '/').replace(/'/g, "\\'");
      return `file '${p}'`;
    }).join('\n');
    fs.writeFileSync(listPath, list, 'utf8');
    const r2 = spawnSync(bin, ['-y', '-f', 'concat', '-safe', '0', '-i', listPath, '-c', 'copy', '-movflags', '+faststart', outputPath], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
    if (r2.status !== 0) {
      // 若 concat copy 失败（编码不一致），退回逐段重新编码拼接
      const r3 = spawnSync(bin, ['-y', '-f', 'concat', '-safe', '0', '-i', listPath, '-c:v', 'libx264', '-c:a', 'aac', '-movflags', '+faststart', outputPath], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
      if (r3.status !== 0) return false;
    }
    return fs.existsSync(outputPath);
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  }
}

/** 字幕统计 */
function getStats(subtitleData) {
  if (!subtitleData || !subtitleData.length) {
    return { totalDuration: 0, wordCount: 0, segmentCount: 0, averageWordsPerSegment: 0 };
  }
  const totalDuration = Math.max(...subtitleData.map((s) => s.endTime)) - Math.min(...subtitleData.map((s) => s.startTime));
  const wordCount = subtitleData.reduce((a, s) => a + (s.words ? s.words.length : 0), 0);
  const segmentCount = subtitleData.length;
  return {
    totalDuration,
    wordCount,
    segmentCount,
    averageWordsPerSegment: segmentCount ? wordCount / segmentCount : 0,
  };
}

module.exports = {
  parseSrtToWordLevel,
  splitTextToWords,
  buildEditedTimeline,
  calcDeletedDuration,
  exportEditedSrt,
  editVideoBySubtitle,
  getStats,
  secondsToSrtTime,
  srtTimeToSeconds,
};