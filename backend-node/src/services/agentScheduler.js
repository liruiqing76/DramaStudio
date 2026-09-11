// AI Agent 工作流调度器：轻量 DAG 调度，状态机驱动
const { spawn } = require('child_process');

// Pipeline 定义：步骤依赖关系
const PIPELINE_DEFINITIONS = {
  'full-production': {
    steps: [
      { id: 'extract-characters', run: 'characterGeneration', depends: [] },
      { id: 'extract-scenes', run: 'sceneExtraction', depends: [] },
      { id: 'generate-chars', run: 'imageGeneration', depends: ['extract-characters'], params: { type: 'character' } },
      { id: 'generate-scenes', run: 'imageGeneration', depends: ['extract-scenes'], params: { type: 'scene' } },
      { id: 'storyboard', run: 'storyboardGeneration', depends: ['extract-characters', 'extract-scenes'] },
      { id: 'generate-video', run: 'videoGeneration', depends: ['storyboard', 'generate-chars', 'generate-scenes'] },
      { id: 'generate-audio', run: 'ttsGeneration', depends: ['storyboard'] },
      { id: 'merge-video', run: 'videoMerge', depends: ['generate-video', 'generate-audio'] },
    ]
  },
  'image-only': {
    steps: [
      { id: 'extract-characters', run: 'characterGeneration', depends: [] },
      { id: 'extract-scenes', run: 'sceneExtraction', depends: [] },
      { id: 'generate-chars', run: 'imageGeneration', depends: ['extract-characters'], params: { type: 'character' } },
      { id: 'generate-scenes', run: 'imageGeneration', depends: ['extract-scenes'], params: { type: 'scene' } },
    ]
  },
  'video-from-existing': {
    steps: [
      { id: 'storyboard', run: 'storyboardGeneration', depends: [] },
      { id: 'generate-video', run: 'videoGeneration', depends: ['storyboard'] },
      { id: 'generate-audio', run: 'ttsGeneration', depends: ['storyboard'] },
      { id: 'merge-video', run: 'videoMerge', depends: ['generate-video', 'generate-audio'] },
    ]
  },
};

const MAX_RETRIES = 3;

class AgentScheduler {
  constructor(db, log, cfg, serviceRegistry) {
    this.db = db;
    this.log = log || console;
    this.cfg = cfg;
    this.services = serviceRegistry;
    this.runningPipelines = new Map(); // pipelineId → running step ids
  }

  /** 启动 pipeline */
  async startPipeline(dramaId, type = 'full-production', config = {}) {
    const def = PIPELINE_DEFINITIONS[type];
    if (!def) throw new Error(`未知 pipeline 类型: ${type}`);

    const now = new Date().toISOString();
    const configJson = JSON.stringify({ type, ...config });

    const info = this.db.prepare(`
      INSERT INTO pipelines (drama_id, type, status, progress, config_json, created_at, updated_at)
      VALUES (?, ?, 'running', 0, ?, ?, ?)
    `).run(Number(dramaId), type, configJson, now, now);

    const pipelineId = info.lastInsertRowid;

    // 创建所有步骤
    for (const step of def.steps) {
      this.db.prepare(`
        INSERT INTO pipeline_steps (pipeline_id, step_id, status, input_json, created_at)
        VALUES (?, ?, 'pending', ?, ?)
      `).run(pipelineId, step.id, JSON.stringify(step.params || {}), now);
    }

    this.log.info('[Pipeline] 已创建', { pipeline_id: pipelineId, drama_id: dramaId, type, steps: def.steps.length });

    // 异步驱动
    setImmediate(() => this._drive(pipelineId));

    return { pipeline_id: pipelineId, steps: def.steps.length, status: 'running' };
  }

  /** 获取就绪步骤（所有依赖已 success/skipped） */
  getReadySteps(pipelineId) {
    const def = this._getPipelineDef(pipelineId);
    if (!def) return [];

    const steps = this.db.prepare(
      'SELECT step_id, status FROM pipeline_steps WHERE pipeline_id = ?'
    ).all(pipelineId);

    const statusMap = {};
    steps.forEach(s => { statusMap[s.step_id] = s.status; });

    return def.steps.filter(step => {
      if (statusMap[step.id] !== 'pending') return false;
      return step.depends.every(dep =>
        statusMap[dep] === 'success' || statusMap[dep] === 'skipped'
      );
    });
  }

  /** 执行单个步骤 */
  async executeStep(pipelineId, stepId) {
    const stepDef = this._getStepDef(pipelineId, stepId);
    if (!stepDef) throw new Error(`步骤不存在: ${stepId}`);

    const stepRow = this.db.prepare(
      'SELECT * FROM pipeline_steps WHERE pipeline_id = ? AND step_id = ?'
    ).get(pipelineId, stepId);
    if (!stepRow) throw new Error(`步骤记录不存在: ${stepId}`);

    // 状态检查
    if (stepRow.status === 'running') throw new Error('步骤正在执行中');
    if (stepRow.status === 'success') throw new Error('步骤已完成');

    const now = new Date().toISOString();
    this.db.prepare(
      'UPDATE pipeline_steps SET status = ?, started_at = ? WHERE pipeline_id = ? AND step_id = ?'
    ).run('running', now, pipelineId, stepId);

    // 标记 pipeline 为 running
    this.db.prepare('UPDATE pipelines SET status = ?, updated_at = ? WHERE id = ?')
      .run('running', now, pipelineId);

    try {
      const handler = this.services[stepDef.run];
      if (!handler) throw new Error(`服务处理器不存在: ${stepDef.run}`);

      const pipeline = this.db.prepare('SELECT * FROM pipelines WHERE id = ?').get(pipelineId);
      const input = stepRow.input_json ? JSON.parse(stepRow.input_json) : {};
      const params = { ...stepDef.params, ...input, drama_id: pipeline.drama_id, pipeline_id: pipelineId };

      const output = await handler(this.db, this.log, this.cfg, params);

      const finishTime = new Date().toISOString();
      this.db.prepare(
        'UPDATE pipeline_steps SET status = ?, output_json = ?, finished_at = ? WHERE pipeline_id = ? AND step_id = ?'
      ).run('success', JSON.stringify(output || {}), finishTime, pipelineId, stepId);

      this.log.info('[Pipeline] 步骤完成', { pipeline_id: pipelineId, step_id: stepId });
      return { ok: true, output };

    } catch (err) {
      const stepRow2 = this.db.prepare(
        'SELECT retry_count FROM pipeline_steps WHERE pipeline_id = ? AND step_id = ?'
      ).get(pipelineId, stepId);
      const retryCount = (stepRow2?.retry_count || 0) + 1;
      const finishTime = new Date().toISOString();

      if (retryCount < MAX_RETRIES) {
        this.db.prepare(
          'UPDATE pipeline_steps SET status = ?, retry_count = ?, error_msg = ?, finished_at = ? WHERE pipeline_id = ? AND step_id = ?'
        ).run('pending', retryCount, err.message, finishTime, pipelineId, stepId);
        this.log.warn('[Pipeline] 步骤失败，将重试', { pipeline_id: pipelineId, step_id: stepId, error: err.message, retry: retryCount });
      } else {
        this.db.prepare(
          'UPDATE pipeline_steps SET status = ?, retry_count = ?, error_msg = ?, finished_at = ? WHERE pipeline_id = ? AND step_id = ?'
        ).run('failed', retryCount, err.message, finishTime, pipelineId, stepId);
        this.log.error('[Pipeline] 步骤失败（重试耗尽）', { pipeline_id: pipelineId, step_id: stepId, error: err.message });
      }
      return { ok: false, error: err.message, retry_count: retryCount };
    }
  }

  /** 重试失败步骤 */
  async retryStep(pipelineId, stepId) {
    const now = new Date().toISOString();
    this.db.prepare(
      'UPDATE pipeline_steps SET status = ?, retry_count = 0, error_msg = NULL, started_at = NULL, finished_at = NULL WHERE pipeline_id = ? AND step_id = ?'
    ).run('pending', pipelineId, stepId);

    this.db.prepare('UPDATE pipelines SET status = ?, updated_at = ? WHERE id = ?')
      .run('running', now, pipelineId);

    setImmediate(() => this._drive(pipelineId));
    return { ok: true, step_id: stepId, status: 'pending' };
  }

  /** 跳过失败步骤 */
  skipStep(pipelineId, stepId) {
    const now = new Date().toISOString();
    this.db.prepare(
      'UPDATE pipeline_steps SET status = ?, error_msg = NULL, finished_at = ? WHERE pipeline_id = ? AND step_id = ?'
    ).run('skipped', now, pipelineId, stepId);

    setImmediate(() => this._drive(pipelineId));
    return { ok: true, step_id: stepId, status: 'skipped' };
  }

  /** 暂停 pipeline */
  pausePipeline(pipelineId) {
    const now = new Date().toISOString();
    this.db.prepare('UPDATE pipelines SET status = ?, updated_at = ? WHERE id = ?')
      .run('paused', now, pipelineId);
    return { ok: true, pipeline_id: pipelineId, status: 'paused' };
  }

  /** 恢复 pipeline */
  resumePipeline(pipelineId) {
    const now = new Date().toISOString();
    this.db.prepare('UPDATE pipelines SET status = ?, updated_at = ? WHERE id = ?')
      .run('running', now, pipelineId);
    setImmediate(() => this._drive(pipelineId));
    return { ok: true, pipeline_id: pipelineId, status: 'running' };
  }

  /** 获取 pipeline 状态 */
  getStatus(pipelineId) {
    const pipeline = this.db.prepare('SELECT * FROM pipelines WHERE id = ?').get(pipelineId);
    if (!pipeline) return null;

    const steps = this.db.prepare(
      'SELECT id, step_id, status, retry_count, error_msg, started_at, finished_at FROM pipeline_steps WHERE pipeline_id = ? ORDER BY id'
    ).all(pipelineId);

    const total = steps.length;
    const done = steps.filter(s => s.status === 'success' || s.status === 'skipped').length;
    const progress = total > 0 ? Math.round((done / total) * 100) : 0;

    // 自动判定 pipeline 状态
    let status = pipeline.status;
    if (status === 'running') {
      if (steps.every(s => s.status === 'success')) status = 'success';
      else if (steps.some(s => s.status === 'failed')) status = 'partial';
    }

    return {
      pipeline_id: pipeline.id,
      drama_id: pipeline.drama_id,
      type: pipeline.type,
      status,
      progress,
      steps: steps.map(s => ({
        id: s.id,
        step_id: s.step_id,
        status: s.status,
        retry_count: s.retry_count,
        error_msg: s.error_msg,
        started_at: s.started_at,
        finished_at: s.finished_at,
      })),
      created_at: pipeline.created_at,
      updated_at: pipeline.updated_at,
    };
  }

  /** 列出剧本的 pipeline */
  listByDrama(dramaId) {
    const rows = this.db.prepare(
      'SELECT * FROM pipelines WHERE drama_id = ? ORDER BY created_at DESC'
    ).all(Number(dramaId));
    return rows.map(p => ({
      pipeline_id: p.id,
      drama_id: p.drama_id,
      type: p.type,
      status: p.status,
      progress: p.progress,
      created_at: p.created_at,
      updated_at: p.updated_at,
    }));
  }

  // ── 内部方法 ──

  /** 驱动 pipeline：执行就绪步骤 */
  async _drive(pipelineId) {
    const pipeline = this.db.prepare('SELECT * FROM pipelines WHERE id = ?').get(pipelineId);
    if (!pipeline || pipeline.status !== 'running') return;

    const readySteps = this.getReadySteps(pipelineId);
    if (readySteps.length === 0) {
      // 检查是否全部完成
      const steps = this.db.prepare(
        'SELECT status FROM pipeline_steps WHERE pipeline_id = ?'
      ).all(pipelineId);
      const allDone = steps.every(s => s.status === 'success' || s.status === 'skipped');
      const hasFailed = steps.some(s => s.status === 'failed');
      const now = new Date().toISOString();

      if (allDone) {
        this.db.prepare('UPDATE pipelines SET status = ?, progress = 100, updated_at = ? WHERE id = ?')
          .run('success', now, pipelineId);
        this.log.info('[Pipeline] 全部完成', { pipeline_id: pipelineId });
      } else if (hasFailed) {
        this.db.prepare('UPDATE pipelines SET status = ?, updated_at = ? WHERE id = ?')
          .run('partial', now, pipelineId);
        this.log.warn('[Pipeline] 部分失败', { pipeline_id: pipelineId });
      }
      return;
    }

    // 并行执行就绪步骤
    this.log.info('[Pipeline] 执行就绪步骤', { pipeline_id: pipelineId, steps: readySteps.map(s => s.id) });
    await Promise.allSettled(
      readySteps.map(step => this.executeStep(pipelineId, step.id))
    );

    // 更新进度
    const steps = this.db.prepare('SELECT status FROM pipeline_steps WHERE pipeline_id = ?').all(pipelineId);
    const done = steps.filter(s => s.status === 'success' || s.status === 'skipped').length;
    const progress = steps.length > 0 ? Math.round((done / steps.length) * 100) : 0;
    this.db.prepare('UPDATE pipelines SET progress = ?, updated_at = ? WHERE id = ?')
      .run(progress, new Date().toISOString(), pipelineId);

    // 继续驱动
    setImmediate(() => this._drive(pipelineId));
  }

  _getPipelineDef(pipelineId) {
    const pipeline = this.db.prepare('SELECT type FROM pipelines WHERE id = ?').get(pipelineId);
    if (!pipeline) return null;
    return PIPELINE_DEFINITIONS[pipeline.type] || null;
  }

  _getStepDef(pipelineId, stepId) {
    const def = this._getPipelineDef(pipelineId);
    if (!def) return null;
    return def.steps.find(s => s.id === stepId) || null;
  }
}

module.exports = { AgentScheduler, PIPELINE_DEFINITIONS, MAX_RETRIES };
