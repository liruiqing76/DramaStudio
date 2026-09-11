/**
 * 媒体处理抽象层（ffmpeg/ffprobe）
 *
 * 把散落各处的 ffmpeg 调用收敛到一个文件，
 * 新增剪辑效果（BGM、cross-fade、字幕描边、色调 LUT 等）只改这里。
 *
 * 核心 API：
 *   - ffprobeDurationSec(filePath)     → 视频/音频时长（秒）
 *   - ffprobeHasAudio(filePath)        → 是否有音轨
 *   - concatVideos(inputs, output, opts)       多段视频硬切拼接
 *   - concatAudios(inputs, output)             多段音频拼接（mp3 list）
 *   - burnSubtitles(video, srtPath, output, opts)    烧录 SRT 字幕
 *   - addBgm(video, bgmPath, output, opts)     混入 BGM 轨道
 *   - addCrossFade(videos, output, opts)       多段视频 cross-fade 过渡
 *   - addSubtitleStyle(outputPath, opts)       字幕样式：描边+安全区
 *   - colorGrade(input, output, opts)          LUT/色调统一
 *
 * 所有方法返回 { ok: boolean, error?: string }，失败时日志由传入的 log 对象记录。
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { getFfmpegPath, getFfprobePath, hasLocalFfmpeg } = require('../../utils/ffmpegPath');

// ── 基础工具 ───────────────────────────────────────────────

/** 用 ffprobe 读视频/音频时长（秒），失败返回 null */
function ffprobeDurationSec(filePath) {
  const probe = getFfprobePath();
  const r = spawnSync(
    probe,
    ['-v', 'error', '-show_entries', 'format=duration',
     '-of', 'default=noprint_wrappers=1:nokey=1', filePath],
    { encoding: 'utf8', maxBuffer: 1024 * 1024 }
  );
  if (r.status !== 0) return null;
  const d = parseFloat(String(r.stdout || '').trim());
  return Number.isFinite(d) && d > 0 ? d : null;
}

/** 是否有音轨 */
function ffprobeHasAudio(filePath) {
  const probe = getFfprobePath();
  const r = spawnSync(
    probe,
    ['-v', 'error', '-select_streams', 'a',
     '-show_entries', 'stream=index', '-of', 'csv=p=0', filePath],
    { encoding: 'utf8', maxBuffer: 1024 * 1024 }
  );
  if (r.status !== 0) return false;
  return String(r.stdout || '').trim().length > 0;
}

/** 转义路径（Windows UNC/中文友好） */
function escapeFfmpegPath(absPath) {
  let s = path.resolve(absPath).replace(/\\/g, '/');
  if (/^[A-Za-z]:/.test(s)) s = s.replace(/^([A-Za-z]):/, '$1\\:');
  return s.replace(/'/g, "\\'");
}

/** 内部 ffmpeg 执行器（同步，复用已有 runFfmpeg 模式） */
function runFfmpeg(args, log, tag) {
  const bin = getFfmpegPath();
  const r = spawnSync(bin, args, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  if (r.error) {
    log.warn('media-ffmpeg: spawn failed', { tag, error: r.error.message });
    return false;
  }
  if (r.status !== 0) {
    log.warn('media-ffmpeg: command failed', {
      tag, stderr: r.stderr?.slice(-1000), exitCode: r.status,
    });
    return false;
  }
  return true;
}

// ── 视频拼接（硬切） ────────────────────────────────────────

/**
 * 多段视频硬切拼接
 * @param {string[]} inputs  - 输入视频列表（按顺序）
 * @param {string}   output  - 输出路径
 * @param {object}   [opts]  - { audio?: boolean } audio=true 保留音频
 */
function concatVideos(inputs, output, opts = {}) {
  if (!Array.isArray(inputs) || inputs.length === 0) {
    return { ok: false, error: 'concatVideos: 输入列表为空' };
  }
  if (inputs.length === 1 && !opts.overwrite) {
    // 单段无需拼接，直接返回原路径
    return { ok: true };
  }
  // 使用 concat demuxer 正确拼接多段（流拷贝；编码不一致时调用方应自行 re-encode）
  const listFile = path.join(require('os').tmpdir(), `concat_list_${Date.now()}.txt`);
  try {
    fs.writeFileSync(listFile, inputs.map((p) => `file '${escapeFfmpegPath(p)}'`).join('\n'), 'utf8');
    const args = ['-y', '-f', 'concat', '-safe', '0', '-i', listFile,
                  '-c', 'copy', '-movflags', '+faststart'];
    if (opts.audio === false) args.push('-an');
    args.push(escapeFfmpegPath(output));
    return { ok: runFfmpeg(args, opts.log, 'concat_videos'), output };
  } finally {
    try { fs.unlinkSync(listFile); } catch (_) {}
  }
}

// ── 音频拼接 ─────────────────────────────────────────────────

/**
 * 多段音频拼接（mp3 list 格式，兼容 narrationVideoPostProcess 的 concatMp3List 逻辑）
 */
function concatAudios(inputs, output, log) {
  if (!Array.isArray(inputs) || inputs.length === 0) {
    return { ok: false, error: 'concatAudios: 输入列表为空' };
  }
  const listFile = path.join(require('os').tmpdir(), `audio_list_${Date.now()}.txt`);
  try {
    fs.writeFileSync(listFile, inputs.map(p => `file '${escapeFfmpegPath(p)}'`).join('\n'), 'utf8');
    const args = ['-y', '-f', 'concat', '-safe', '0', '-i', listFile,
                  '-c', 'copy', output];
    return { ok: runFfmpeg(args, log, 'concat_audios') };
  } finally {
    try { fs.unlinkSync(listFile); } catch (_) {}
  }
}

// ── 字幕烧录（含样式：描边 + 安全区） ───────────────────────────

/**
 * 烧录 SRT 字幕到视频
 * @param {string} video    - 输入视频
 * @param {string} srtPath  - SRT 文件路径
 * @param {string} output   - 输出视频
 * @param {object} [opts]   - { style?: { fontSize, fontName, outline, shadow, safeArea }, log }
 */
function burnSubtitles(video, srtPath, output, opts = {}) {
  const sub = escapeFfmpegPath(srtPath);
  const style = opts.style || {};
  // 默认：黑底白字 + 描边 + 9:16 安全区（下 1/3 位置）
  const styleOpts = {
    fontSize: 28,
    fontName: 'Helvetica',
    outline: 2,
    shadow: 1,
    x: '(w-text_w)/2',
    y: 'h*0.82',           // 安全区：竖屏底部 82%
    forceStyle: '',
  };
  Object.assign(styleOpts, style);

  const vf = `subtitles='${sub}':charenc=UTF-8:force_style='Name=Default,Fontname=${styleOpts.fontName},FontSize=${styleOpts.fontSize},PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,Outline=${styleOpts.outline},Shadow=${styleOpts.shadow},Alignment=2,MarginV=20,MarginL=20,MarginR=20'`;
  const args = [
    '-y', '-i', escapeFfmpegPath(video),
    '-filter_complex', `[0:v]${vf}[v]`,
    '-map', '[v]',
    '-map', '0:a?',
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '23',
    '-c:a', 'aac', '-b:a', '192k',
    '-movflags', '+faststart', '-shortest',
    escapeFfmpegPath(output),
  ];
  return { ok: runFfmpeg(args, opts.log, 'burn_subtitles') };
}

// ── BGM 混入 ─────────────────────────────────────────────────

/**
 * 混入 BGM 音轨（自动降低原音频音量，保持人声清晰）
 * @param {string} video   - 输入视频
 * @param {string} bgmPath - BGM 文件路径（mp3/aac）
 * @param {string} output  - 输出视频
 * @param {object} [opts]  - { bgmVolume?: number, originalVolume?: number, fadeDur?: number, log }
 */
function addBgm(video, bgmPath, output, opts = {}) {
  const {
    bgmVolume = 0.15,      // BGM 默认 -16dB ≈ 0.15 线性
    originalVolume = 1.0,
    fadeDur = 2.0,         // 淡入/淡出秒数
    log,
  } = opts;
  // 淡出应起于视频末尾前 fadeDur 秒，而非第 fadeDur 秒（否则长视频 BGM 只在开头响一下）
  const videoDur = ffprobeDurationSec(video) || 0;
  const fadeOutStart = Math.max(0, videoDur - fadeDur);
  const args = [
    '-y',
    '-i', escapeFfmpegPath(video),
    '-i', escapeFfmpegPath(bgmPath),
    '-filter_complex',
    `[0:a]volume=${originalVolume}[orig];` +
    `[1:a]volume=${bgmVolume},afade=t=in:st=0:d=${fadeDur},afade=t=out:st=${fadeOutStart}[bgm];` +
    `[orig][bgm]amix=inputs=2:duration=first:dropout_transition=2[aout]`,
    '-map', '0:v',
    '-map', '[aout]',
    '-c:v', 'copy',
    '-c:a', 'aac', '-b:a', '192k',
    '-movflags', '+faststart',
    escapeFfmpegPath(output),
  ];
  return { ok: runFfmpeg(args, log, 'add_bgm') };
}

// ── Cross-fade 转场 ─────────────────────────────────────────

/**
 * 多段视频 cross-fade 过渡（每段之间 0.3s 淡入淡出）
 * @param {string[]} inputs  - 输入视频列表
 * @param {string}   output  - 输出视频
 * @param {object}   [opts]  - { duration?: number, log }
 */
function addCrossFade(inputs, output, opts = {}) {
  const duration = Math.min(0.5, Math.max(0.1, opts.duration || 0.3));
  if (!Array.isArray(inputs) || inputs.length < 2) {
    return { ok: false, error: 'addCrossFade: 需要至少 2 段输入' };
  }
  // 探测各段时长，按链式 xfade 计算正确 offset：O_k = 累计前 (k+1) 段时长 - (k+1)*duration
  const durations = inputs.map((p) => ffprobeDurationSec(p) || 0);
  if (durations.some((d) => d <= 0)) {
    return { ok: false, error: 'addCrossFade: 无法探测某段时长' };
  }
  let filterChain = '';
  let cumulative = 0;
  for (let i = 0; i < inputs.length - 1; i++) {
    cumulative += durations[i];
    const offset = Math.max(0, cumulative - (i + 1) * duration);
    const inA = i === 0 ? `[${i}:v]` : `[v${i - 1}]`;
    const inB = `[${i + 1}:v]`;
    const outLabel = i < inputs.length - 2 ? `[v${i}]` : '[vout]';
    filterChain += `${inA}${inB}xfade=transition=fade:duration=${duration}:offset=${offset}${outLabel};`;
  }
  filterChain = filterChain.replace(/;$/, '');
  const args = [
    '-y',
    ...inputs.flatMap(p => ['-i', escapeFfmpegPath(p)]),
    '-filter_complex', filterChain,
    '-map', '[vout]',
    '-map', '0:a?',
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '23',
    '-c:a', 'aac', '-b:a', '192k',
    '-movflags', '+faststart',
    escapeFfmpegPath(output),
  ];
  return { ok: runFfmpeg(args, opts.log, 'crossfade'), output };
}

// ── 彩色校正（跨厂商色调统一） ──────────────────────────────

/**
 * 简单色调校正：暖调偏移 / 冷调偏移 / 饱和度调整
 * @param {string} input  - 输入视频
 * @param {string} output - 输出视频
 * @param {object} [opts]  - { warm?: number, saturation?: number, log }
 */
function colorGrade(input, output, opts = {}) {
  const { warm = 0, saturation = 1.0, log } = opts;
  const filters = [];
  if (saturation !== 1.0) filters.push(`saturation=${saturation}`);
  if (warm !== 0) filters.push(`colorbalance=rs=${warm}`);
  if (filters.length === 0) return { ok: true };
  const filterComplex = `[0:v]${filters.join(',')}[v]`;
  const args = [
    '-y', '-i', escapeFfmpegPath(input),
    '-filter_complex', filterComplex,
    '-map', '[v]',
    '-map', '0:a?',
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '23',
    '-c:a', 'aac', '-b:a', '192k',
    '-movflags', '+faststart',
    escapeFfmpegPath(output),
  ];
  return { ok: runFfmpeg(args, log, 'color_grade') };
}

// ── 导出 ─────────────────────────────────────────────────────

module.exports = {
  ffprobeDurationSec,
  ffprobeHasAudio,
  concatVideos,
  concatAudios,
  burnSubtitles,
  addBgm,
  addCrossFade,
  colorGrade,
  hasLocalFfmpeg,
};
