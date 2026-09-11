const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { getFfmpegPath, getFfprobePath } = require('../utils/ffmpegPath');
const { loadConfig } = require('../config/index.js');

function setupGridImageService(db, log) {
  function getStorageRoot() {
    try {
      const cfg = loadConfig();
      const localPath = cfg.storage?.local_path;
      if (localPath) {
        return path.isAbsolute(localPath)
          ? localPath
          : path.join(process.cwd(), localPath);
      }
    } catch (e) {
      // fallback to default
    }
    return path.join(process.cwd(), 'data', 'storage');
  }

  async function composeGrid(images, cols = 2, rows = 2, outputPath) {
    if (!Array.isArray(images) || images.length === 0) {
      throw new Error('images must be a non-empty array');
    }
    const total = cols * rows;
    // Use only first total images, or repeat if fewer? We'll use as many as provided, up to total.
    const selected = images.slice(0, total);
    // If fewer than total, we can duplicate the last image to fill? For simplicity, we'll just use what we have and let sharp composite handle missing? Better to replicate.
    // We'll replicate the last image to fill remaining slots.
    while (selected.length < total) {
      selected.push(selected[selected.length - 1] || images[0]);
    }

    // Ensure output directory exists
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Process each image: read, resize to 512x512 (assuming we want uniform size)
    const tileWidth = 512;
    const tileHeight = 512;
    const canvasWidth = tileWidth * cols;
    const canvasHeight = tileHeight * rows;

    // Create a composite image
    const composite = sharp({
      create: {
        width: canvasWidth,
        height: canvasHeight,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      }
    });

    const tileImages = [];
    const segmentMapping = [];

    for (let i = 0; i < selected.length; i++) {
      const imgPath = selected[i];
      if (!fs.existsSync(imgPath)) {
        log.warn(`Image not found for grid: ${imgPath}`);
        continue;
      }
      const col = i % cols;
      const row = Math.floor(i / cols);
      const left = col * tileWidth;
      const top = row * tileHeight;

      tileImages.push({
        input: await sharp(imgPath)
          .resize(tileWidth, tileHeight, { fit: 'cover' })
          .toBuffer(),
        left,
        top
      });

      segmentMapping.push({
        index: i,
        originalPath: imgPath,
        gridX: col,
        gridY: row
      });
    }

    // Composite all tiles onto the canvas
    let current = composite;
    for (const tile of tileImages) {
      current = current.composite([{ input: tile.input, left: tile.left, top: tile.top }]);
    }

    await current.toFile(outputPath);

    return {
      gridPath: outputPath,
      segmentMapping
    };
  }

  async function decomposeVideo(videoPath, segmentCount = 4, outputDir) {
    if (!fs.existsSync(videoPath)) {
      throw new Error(`Video file not found: ${videoPath}`);
    }
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Get video duration using ffprobe
    const probePath = getFfprobePath();
    const probeResult = spawnSync(
      probePath,
      ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', videoPath],
      { encoding: 'utf8', maxBuffer: 1024 * 1024 }
    );
    if (probeResult.status !== 0) {
      throw new Error(`ffprobe failed: ${probeResult.stderr}`);
    }
    const duration = parseFloat(probeResult.stdout.trim());
    if (!duration || duration <= 0) {
      throw new Error(`Could not determine video duration`);
    }

    const segmentDuration = duration / segmentCount;
    const segments = [];

    for (let i = 0; i < segmentCount; i++) {
      const startTime = i * segmentDuration;
      const endTime = (i + 1) * segmentDuration;
      const outputFile = path.join(outputDir, `segment_${i + 1}.mp4`);
      const ffmpegPath = getFfmpegPath();
      const args = [
        '-y', // overwrite output
        '-ss', startTime.toString(),
        '-i', videoPath,
        '-t', segmentDuration.toString(),
        '-c:v', 'libx264',
        '-c:a', 'aac',
        '-movflags', '+faststart',
        outputFile
      ];
      const result = spawnSync(ffmpegPath, args, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
      if (result.status !== 0) {
        log.error(`ffmpeg failed for segment ${i + 1}`, { error: result.stderr });
        throw new Error(`ffmpeg failed for segment ${i + 1}: ${result.stderr}`);
      }
      segments.push({
        segmentIndex: i,
        videoPath: outputFile
      });
    }

    return segments;
  }

  return { composeGrid, decomposeVideo };
}

module.exports = { setupGridImageService };