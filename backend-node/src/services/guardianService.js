const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const http = require('http');
const https = require('https');

function setupGuardian(db, log, cfg) {
  let intervals = [];
  let healthStatus = {
    comfyui: { healthy: false, lastCheck: null, error: null },
    disk: { freeSpaceGB: 0, canAcceptVideoTask: true, lastCheck: null },
    tempFileCount: { count: 0, lastCleaned: null },
    timedOutTasks: { count: 0, lastChecked: null }
  };

  const storageRoot = cfg.storage?.local_path 
    ? (path.isAbsolute(cfg.storage.local_path) 
        ? cfg.storage.local_path 
        : path.join(process.cwd(), cfg.storage.local_path))
    : path.join(process.cwd(), 'data', 'storage');
  const tempDir = path.join(storageRoot, 'temp');
  const comfyuiBaseUrl = cfg.comfyui?.base_url || 'http://127.0.0.1:8188';

  // Ensure temp directory exists
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  function cleanTempFiles() {
    try {
      const now = Date.now();
      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
      let count = 0;
      const files = fs.readdirSync(tempDir);
      for (const file of files) {
        const filePath = path.join(tempDir, file);
        const stat = fs.statSync(filePath);
        if (stat.isFile() && (now - stat.mtimeMs) > sevenDaysMs) {
          fs.unlinkSync(filePath);
          count++;
        }
      }
      healthStatus.tempFileCount = {
        count: count,
        lastCleaned: new Date().toISOString()
      };
      if (count > 0) {
        log.info(`Cleaned ${count} temporary files older than 7 days`, { tempDir });
      }
    } catch (error) {
      log.error('Failed to clean temporary files', { error: error.message });
    }
  }

  function checkComfyUIHealth() {
    const options = {
      method: 'GET',
      timeout: 5000,
      headers: { 'Accept': 'application/json' }
    };
    const lib = comfyuiBaseUrl.startsWith('https') ? https : http;
    const req = lib.get(comfyuiBaseUrl + '/system_stats', options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            healthStatus.comfyui = {
              healthy: true,
              lastCheck: new Date().toISOString(),
              error: null
            };
            log.debug('ComfyUI health check passed');
          } else {
            healthStatus.comfyui = {
              healthy: false,
              lastCheck: new Date().toISOString(),
              error: `HTTP ${res.statusCode}`
            };
            log.warn('ComfyUI health check failed', { statusCode: res.statusCode });
          }
        } catch (e) {
          healthStatus.comfyui = {
            healthy: false,
            lastCheck: new Date().toISOString(),
             error: e.message
          };
          log.error('Error parsing ComfyUI health response', { error: e.message });
        }
      });
    });
    req.on('error', (err) => {
      healthStatus.comfyui = {
        healthy: false,
        lastCheck: new Date().toISOString(),
        error: err.message
      };
      log.warn('ComfyUI health check request error', { error: err.message });
    });
    req.setTimeout(options.timeout, () => {
      req.destroy();
      healthStatus.comfyui = {
        healthy: false,
        lastCheck: new Date().toISOString(),
        error: 'Request timeout'
      };
      log.warn('ComfyUI health check timeout');
    });
  }

  function checkDiskSpace() {
    try {
      let freeBytes = 0;
      if (process.platform === 'win32') {
        // Windows: use wmic to get free space for the drive containing storageRoot
        const drive = path.parse(storageRoot).root; // e.g., "C:\\"
        const output = execSync(`wmic logicaldisk where "caption='${drive.replace(/\\/g, '')}'" get freespace`, { encoding: 'utf8' });
        const lines = output.trim().split('\n');
        if (lines.length >= 2) {
          const freespaceStr = lines[1].trim();
          freeBytes = parseInt(freespaceStr, 10);
        }
      } else {
        // Unix-like: use df
        const output = execSync(`df -B1 "${storageRoot}"`, { encoding: 'utf8' });
        const lines = output.trim().split('\n');
        if (lines.length >= 2) {
          const parts = lines[1].trim().split(/\s+/);
          // df -B1 output: Filesystem      1B-blocks        Used Available Use% Mounted on
          freeBytes = parseInt(parts[3], 10); // Available column
        }
      }
      const freeSpaceGB = freeBytes / (1024 ** 3);
      const canAcceptVideoTask = freeSpaceGB >= 5; // threshold 5GB
      healthStatus.disk = {
        freeSpaceGB: Number(freeSpaceGB.toFixed(2)),
        canAcceptVideoTask,
        lastCheck: new Date().toISOString()
      };
      if (!canAcceptVideoTask) {
        log.warn(`Low disk space: ${freeSpaceGB.toFixed(2)} GB free`, { storageRoot });
      }
    } catch (error) {
      log.error('Failed to check disk space', { error: error.message });
      // On error, assume we can still accept tasks to avoid blocking
      healthStatus.disk = {
        freeSpaceGB: 0,
        canAcceptVideoTask: true,
        lastCheck: new Date().toISOString()
      };
    }
  }

  function checkTaskTimeouts() {
    try {
      // SQLite: julianday('now') - julianday(updated_at)) * 86400 > 1800 (30 minutes in seconds)
      const stmt = db.prepare(`
        UPDATE async_tasks
        SET status = 'failed',
            error = 'timed out',
            updated_at = ?
        WHERE status = 'running'
          AND (julianday('now') - julianday(updated_at)) * 86400 > 1800
      `);
      const info = stmt.run(new Date().toISOString());
      const count = info.changes;
      healthStatus.timedOutTasks = {
        count: count,
        lastChecked: new Date().toISOString()
      };
      if (count > 0) {
        log.info(`Marked ${count} tasks as timed out`, { count });
      }
    } catch (error) {
      log.error('Failed to check task timeouts', { error: error.message });
    }
  }

  function start() {
    // Clean temp files every 6 hours
    intervals.push(setInterval(cleanTempFiles, 6 * 60 * 60 * 1000));
    // ComfyUI health check every 5 minutes
    intervals.push(setInterval(checkComfyUIHealth, 5 * 60 * 1000));
    // Disk space check every 15 minutes
    intervals.push(setInterval(checkDiskSpace, 15 * 60 * 1000));
    // Task timeout check every 2 minutes
    intervals.push(setInterval(checkTaskTimeouts, 2 * 60 * 1000));

    // Run once immediately on start
    cleanTempFiles();
    checkComfyUIHealth();
    checkDiskSpace();
    checkTaskTimeouts();

    log.info('Guardian service started');
  }

  function stop() {
    intervals.forEach(id => clearInterval(id));
    intervals = [];
    log.info('Guardian service stopped');
  }

  function getHealthStatus() {
    return {
      comfyui: { ...healthStatus.comfyui },
      disk: { ...healthStatus.disk },
      tempFileCount: { ...healthStatus.tempFileCount },
      timedOutTasks: { ...healthStatus.timedOutTasks }
    };
  }

  return { start, stop, getHealthStatus };
}

module.exports = { setupGuardian };