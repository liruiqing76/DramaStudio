const path = require('path');
const fs = require('fs');
const guardianService = require('../services/guardianService');
const gridImageService = require('../services/gridImageService');
const response = require('../response');

function routes(db, cfg, log) {
  const guardian = guardianService.setupGuardian(db, log, cfg);
  const gridImage = gridImageService.setupGridImageService(db, log);

  // Compute storage root from config
  const storageRoot = cfg.storage?.local_path
    ? (path.isAbsolute(cfg.storage.local_path)
        ? cfg.storage.local_path
        : path.join(process.cwd(), cfg.storage.local_path))
    : path.join(process.cwd(), 'data', 'storage');

  async function getHealth(req, res) {
    try {
      const status = guardian.getHealthStatus();
      response.success(res, status);
    } catch (err) {
      log.error('Failed to get guardian health status', { error: err.message });
      response.internalError(res, err.message);
    }
  }

  async function composeGrid(req, res) {
    try {
      const { imagePaths, cols = 2, rows = 2 } = req.body || {};
      if (!Array.isArray(imagePaths) || imagePaths.length === 0) {
        return response.badRequest(res, 'imagePaths must be a non-empty array');
      }
      // Ensure image paths are absolute or relative to storage root? We'll assume they are absolute or relative to process.cwd()
      // Convert to absolute if needed
      const absolutePaths = imagePaths.map(p => {
        if (path.isAbsolute(p)) return p;
        return path.join(process.cwd(), p);
      });
      // Generate output filename
      const outputDir = path.join(storageRoot, 'grids');
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      const outputPath = path.join(outputDir, `grid_${Date.now()}_${Math.floor(Math.random() * 10000)}.png`);
      const result = await gridImage.composeGrid(absolutePaths, cols, rows, outputPath);
      response.success(res, result);
    } catch (err) {
      log.error('Failed to compose grid image', { error: err.message });
      response.internalError(res, err.message);
    }
  }

  async function decomposeVideo(req, res) {
    try {
      const { videoPath, segmentCount = 4 } = req.body || {};
      if (!videoPath || typeof videoPath !== 'string') {
        return response.badRequest(res, 'videoPath is required');
      }
      const absVideoPath = path.isAbsolute(videoPath) ? videoPath : path.join(process.cwd(), videoPath);
      if (!fs.existsSync(absVideoPath)) {
        return response.badRequest(res, `Video file not found: ${videoPath}`);
      }
      const outputDir = path.join(storageRoot, 'video_segments', Date.now().toString());
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      const segments = await gridImage.decomposeVideo(absVideoPath, segmentCount, outputDir);
      // Return relative paths for easier consumption? We'll return absolute paths.
      response.success(res, { segments });
    } catch (err) {
      log.error('Failed to decompose video', { error: err.message });
      response.internalError(res, err.message);
    }
  }

  return {
    getHealth,
    composeGrid,
    decomposeVideo
  };
}

// Export the routes function directly for use in setupRouter
module.exports = routes;