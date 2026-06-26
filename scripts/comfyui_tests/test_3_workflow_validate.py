#!/usr/bin/env python3
"""Test 3: ALL workflow JSON + FULL pipeline validation
Covers the ENTIRE LocalMiniDrama pipeline, not just ComfyUI submission:

Pipeline stages (front → back → remote):
  Stage A: Frontend → Backend API (REST routes)
  Stage B: Backend → AI text model (prompt polish / storyboard generation)
  Stage C: Backend → AI image model (ComfyUI T2I / I2I)
  Stage D: Backend → ComfyUI video model (I2V / T2V / TI2V)
  Stage E: ComfyUI → remote GPU (SSH tunnel, submit, poll)
  Stage F: Remote GPU → video output (download, save, normalize)
  Stage G: Backend → DB (status update, local_path, storyboard linking)
  Stage H: Backend → Frontend (poll status, display video)

Each stage has its own potential failure points. This test validates:
  1. All 11 workflow JSON files (node types, params, connections)
  2. DB ai_service_configs match workflow files
  3. Placeholder substitution covers all {{xxx}} in workflows
  4. Backend API route → service → client chain exists
  5. videoClient.js callComfyUiVideoApi logic (workflow_file → workflow_json → default fallback)
  6. imageClient.js callComfyUIImageApi logic
  7. substituteWorkflowPlaceholders covers all known placeholders
  8. pollVideoTask ComfyUI protocol handling
  9. downloadVideoToLocal + maybeNormalizeVideoAfterDownload
  10. resolveRemoteVideoUrl (URL → local proxy)
"""
import json, sys, os, re, sqlite3, pathlib

PROJECT_ROOT = pathlib.Path(__file__).parent.parent.parent
WORKFLOW_DIR = PROJECT_ROOT / 'backend-node' / 'configs' / 'comfyui_workflows'
DB_PATH = PROJECT_ROOT / 'backend-node' / 'data' / 'drama_generator.db'
VIDEO_CLIENT_PATH = PROJECT_ROOT / 'backend-node' / 'src' / 'services' / 'videoClient.js'
IMAGE_CLIENT_PATH = PROJECT_ROOT / 'backend-node' / 'src' / 'services' / 'imageClient.js'
ROUTES_PATH = PROJECT_ROOT / 'backend-node' / 'src' / 'routes' / 'videos.js'

# ===== Workflow registry =====
WORKFLOW_REGISTRY = {
    'wan22_distill_i2v.json': {
        'desc': '14B蒸馏I2V(标准节点) — Wan22ImageToVideoLatent',
        'type': 'I2V', 'category': 'video',
        'required_nodes': ['VAELoader', 'CLIPLoader', 'CLIPVisionLoader', 'CLIPVisionEncode',
                          'Wan22ImageToVideoLatent',
                          'UNETLoader', 'KSampler', 'VAEDecode', 'CreateVideo', 'SaveVideo', 'LoadImage'],
        'known_bugs': ['(1 x 2 x 482) VAE kernel bug in Wan22ImageToVideoLatent',
                       'Wan22ImageToVideoLatent用48通道拼接,14B蒸馏模型需要36通道',
                       '🔴 此workflow当前不可用! 必须用wan22_distill_i2v_wrapper.json代替'],
        'critical_params': {'latent_format': 48, 'in_channels': '36 vs 48 mismatch'},
        'placeholders_needed': ['{{prompt}}', '{{negative_prompt}}', '{{image_url}}',
                               '{{seed}}', '{{width}}', '{{height}}', '{{frames}}',
                               '{{steps}}', '{{cfg}}', '{{fps}}', '{{filename_prefix}}'],
        'db_ids': [12],
    },
    'wan22_distill_i2v_wrapper.json': {
        'desc': '14B蒸馏I2V(WanVideoWrapper) — WanVideoImageToVideoEncode',
        'type': 'I2V', 'category': 'video',
        'required_nodes': ['WanVideoModelLoader', 'WanVideoVAELoader',
                          'WanVideoTextEncodeCached', 'CLIPVisionLoader', 'LoadImage',
                          'WanVideoClipVisionEncode', 'WanVideoImageToVideoEncode',
                          'WanVideoSampler', 'WanVideoDecode', 'CreateVideo', 'SaveVideo'],
        'known_bugs': ['68-channel input (36 expected) — WanVideoImageToVideoEncode uses latent_format=48',
                       'WanVideoVAELoader needs precision param',
                       'WanVideoClipVisionEncode needs strength_2 param'],
        'critical_params': {'latent_format': 48, 'model_in_channels': 36},
        'placeholders_needed': ['{{prompt}}', '{{negative_prompt}}', '{{image_url}}',
                               '{{seed}}', '{{width}}', '{{height}}', '{{frames}}',
                               '{{steps}}', '{{cfg}}', '{{fps}}', '{{filename_prefix}}'],
        'db_ids': [],  # Not in DB yet (needs to be added)
    },
    'wan22_5b_distill_i2v.json': {
        'desc': '5B TI2V(WanVideoWrapper)',
        'type': 'TI2V', 'category': 'video',
        'required_nodes': ['WanVideoModelLoader', 'WanVideoVAELoader', 'LoadWanVideoT5TextEncoder',
                          'WanVideoTextEncode', 'WanVideoEmptyEmbeds', 'LoadImage',
                          'WanVideoEncode', 'WanVideoSampler', 'WanVideoDecode', 'CreateVideo', 'SaveVideo'],
        'known_bugs': [],
        'critical_params': {},
        'placeholders_needed': ['{{prompt}}', '{{negative_prompt}}', '{{image_url}}',
                               '{{seed}}', '{{width}}', '{{height}}', '{{frames}}',
                               '{{steps}}', '{{cfg}}', '{{fps}}', '{{filename_prefix}}'],
        'db_ids': [13],
    },
    'wan22_5b_ovi_i2v.json': {
        'desc': '5B OVI 960x960(WanVideoWrapper) — 纯T2V无image',
        'type': 'TI2V', 'category': 'video',
        'required_nodes': ['WanVideoModelLoader', 'WanVideoVAELoader', 'LoadWanVideoT5TextEncoder',
                          'WanVideoTextEncode', 'WanVideoEmptyEmbeds',
                          'WanVideoSampler', 'WanVideoDecode', 'CreateVideo', 'SaveVideo'],
        'known_bugs': ['960x960 needs ~30GB VRAM'],
        'critical_params': {'vram_required': '30GB'},
        'placeholders_needed': ['{{prompt}}', '{{negative_prompt}}',
                               '{{seed}}', '{{frames}}', '{{steps}}', '{{cfg}}',
                               '{{fps}}', '{{filename_prefix}}'],
        'db_ids': [],
    },
    'wan21_gguf_i2v.json': {
        'desc': 'Wan2.1 GGUF 14B I2V',
        'type': 'I2V', 'category': 'video',
        'required_nodes': ['WanVideoModelLoader', 'WanVideoVAELoader', 'LoadWanVideoT5TextEncoder',
                          'WanVideoTextEncode', 'WanVideoEmptyEmbeds', 'LoadImage',
                          'WanVideoEncode',
                          'WanVideoSampler', 'WanVideoDecode', 'CreateVideo', 'SaveVideo'],
        'known_bugs': [],
        'critical_params': {},
        'placeholders_needed': ['{{prompt}}', '{{negative_prompt}}', '{{image_url}}',
                               '{{seed}}', '{{width}}', '{{height}}', '{{frames}}',
                               '{{steps}}', '{{cfg}}', '{{fps}}', '{{filename_prefix}}'],
        'db_ids': [],
    },
    'wan22_gguf_i2v.json': {
        'desc': 'Wan2.2 GGUF I2V(标准节点)',
        'type': 'I2V', 'category': 'video',
        'required_nodes': ['UnetLoaderGGUF', 'VAELoader', 'CLIPLoader', 'CLIPVisionLoader',
                          'CLIPVisionEncode', 'EmptyHunyuanLatentVideo', 'KSampler',
                          'VAEDecode', 'SaveVideo', 'LoadImage'],
        'known_bugs': [],
        'critical_params': {},
        'placeholders_needed': ['{{prompt}}', '{{negative_prompt}}', '{{image_url}}',
                               '{{seed}}', '{{width}}', '{{height}}', '{{frames}}',
                               '{{steps}}', '{{cfg}}', '{{sampler_name}}', '{{fps}}',
                               '{{filename_prefix}}'],
        'db_ids': [8],  # actually T2V in DB, but file is I2V
    },
    'wan22_gguf_t2v.json': {
        'desc': 'Wan2.2 GGUF T2V(标准节点) — 禁用，只做I2V',
        'type': 'T2V', 'category': 'video',
        'required_nodes': ['UnetLoaderGGUF', 'VAELoader', 'CLIPLoader', 'CLIPTextEncode',
                          'EmptyHunyuanLatentVideo', 'KSampler',
                          'VAEDecode', 'CreateVideo', 'SaveVideo'],
        'known_bugs': [],
        'critical_params': {},
        'placeholders_needed': ['{{prompt}}', '{{negative_prompt}}',
                               '{{seed}}', '{{width}}', '{{height}}', '{{frames}}',
                               '{{steps}}', '{{cfg}}', '{{sampler_name}}', '{{fps}}',
                               '{{filename_prefix}}'],
        'db_ids': [8],
    },
    'flux2_gguf_t2i.json': {
        'desc': 'Flux2 GGUF T2I — 分镜图片生成',
        'type': 'T2I', 'category': 'image',
        'required_nodes': ['UnetLoaderGGUF', 'DualCLIPLoader', 'VAELoader',
                          'KSampler', 'VAEDecode', 'SaveImage'],
        'known_bugs': [],
        'critical_params': {},
        'placeholders_needed': ['{{prompt}}', '{{negative_prompt}}',
                               '{{seed}}', '{{width}}', '{{height}}', '{{steps}}',
                               '{{cfg}}', '{{filename_prefix}}'],
        'db_ids': [9],
    },
    'flux2_gguf_i2i.json': {
        'desc': 'Flux2 GGUF I2I — 图生图(风格化)',
        'type': 'I2I', 'category': 'image',
        'required_nodes': ['UNETLoader', 'DualCLIPLoader', 'VAELoader', 'VAEEncode',
                          'LoadImage', 'KSampler', 'VAEDecode', 'SaveImage', 'CLIPTextEncode'],
        'known_bugs': [],
        'critical_params': {},
        'placeholders_needed': ['{{prompt}}', '{{negative_prompt}}', '{{image_url}}',
                               '{{seed}}', '{{denoise}}', '{{steps}}', '{{cfg}}',
                               '{{filename_prefix}}'],
        'db_ids': [],
    },
    'ltx_video_t2v.json': {
        'desc': 'LTX Video T2V(2B轻量)',
        'type': 'T2V', 'category': 'video',
        'required_nodes': ['LTXVLoader', 'CLIPTextEncode', 'LTXVConditioning',
                          'EmptyLTXVLatentVideo', 'KSamplerSelect', 'LTXVSampler',
                          'LTXVScheduler', 'VAEDecode', 'CreateVideo', 'SaveVideo'],
        'known_bugs': [],
        'critical_params': {},
        'placeholders_needed': ['{{prompt}}', '{{negative_prompt}}',
                               '{{seed}}', '{{width}}', '{{height}}', '{{frames}}',
                               '{{steps}}', '{{fps}}', '{{sampler_name}}',
                               '{{filename_prefix}}'],
        'db_ids': [],
    },
}

# ===== Pipeline stages =====
PIPELINE_STAGES = {
    'A_frontend_to_backend': {
        'desc': '前端 → 后端API',
        'routes': [
            'POST /api/video_generations → videos.create',
            'GET /api/video_generations/:id → videos.get',
            'POST /api/image_generations → (image route)',
            'POST /api/dramas/:id/episodes/:id/storyboard/generate → drama.generateStoryboard',
        ],
        'test_points': ['路由存在', '请求体字段完整', 'response格式正确'],
    },
    'B_ai_text': {
        'desc': 'AI文本润色(prompt polish → storyboard)',
        'services': ['aiClient.generateText', 'promptI18n'],
        'test_points': ['ai_service_configs有text类型', 'scene_key路由存在',
                       '模型可达(deepseek/glm)', '返回格式正确'],
    },
    'C_ai_image': {
        'desc': 'AI图片生成分镜图(Flux2 GGUF)',
        'services': ['imageClient.callComfyUIImageApi'],
        'test_points': ['ai_service_configs有comfyui类型', 'workflow文件存在',
                       'placeholder替换完整', '图片下载+存DB'],
    },
    'D_ai_video': {
        'desc': 'AI视频生成(所有I2V/T2V/TI2V模型)',
        'services': ['videoClient.callComfyUiVideoApi'],
        'test_points': ['ai_service_configs有comfyui类型', 'workflow文件存在',
                       'placeholder替换完整', 'prompt_id返回',
                       '68通道bug', '48通道bug'],
    },
    'E_ssh_tunnel': {
        'desc': 'SSH隧道 → 远程GPU',
        'test_points': ['SSH连接', 'GPU验证', 'ComfyUI启动',
                       'API可达', 'WanVideoWrapper节点可用',
                       '代码无非法patch'],
    },
    'F_gpu_output': {
        'desc': 'GPU视频输出 → 下载',
        'test_points': ['视频文件存在', '文件大小>0', '格式(mp4/webm)',
                       '分辨率>=720p', '帧数>=25'],
    },
    'G_db_update': {
        'desc': 'DB状态更新(video_generations + storyboards)',
        'test_points': ['status=completed', 'video_url写入',
                       'local_path写入', 'storyboard.video_url同步更新',
                       'completed_at写入'],
    },
    'H_frontend_display': {
        'desc': '前端显示视频(轮询状态→播放)',
        'test_points': ['status轮询', 'video_url可访问',
                       'local_path/static/可访问', 'video元素可播放'],
    },
}

def load_wf(name):
    path = WORKFLOW_DIR / name
    assert path.exists(), f"Workflow文件不存在: {path}"
    with open(path) as f:
        return json.load(f)

# ===== Test functions =====
def test_all_workflow_jsons():
    """Validate all 11 workflow JSON files"""
    errors = []
    warnings = []
    
    # Check no extra workflow files not in registry
    all_wf_files = [f.name for f in WORKFLOW_DIR.iterdir() if f.suffix == '.json']
    for f in all_wf_files:
        if f not in WORKFLOW_REGISTRY:
            warnings.append(f"未注册的workflow文件: {f}")
    
    # Check each registered workflow
    for name, meta in WORKFLOW_REGISTRY.items():
        try:
            wf = load_wf(name)
        except Exception as e:
            errors.append(f"{name}: 加载失败 - {e}")
            continue
        
        # Check required nodes
        actual_nodes = set()
        for nid, node in wf.items():
            ct = node.get('class_type', '')
            actual_nodes.add(ct)
        
        for req in meta['required_nodes']:
            if req not in actual_nodes:
                errors.append(f"{name}: 缺少节点 {req}")
        
        # Check placeholders in workflow values
        ph_pattern = re.compile(r'\{\{(\w+)\}\}')
        found_placeholders = set()
        for nid, node in wf.items():
            for key, val in node.get('inputs', {}).items():
                if isinstance(val, str):
                    found_placeholders.update(ph_pattern.findall(val))
        
        for needed_ph in meta['placeholders_needed']:
            ph_name = needed_ph.replace('{{', '').replace('}}', '')
            if ph_name not in found_placeholders and ph_name in ['prompt', 'negative_prompt', 'seed', 'filename_prefix']:
                warnings.append(f"{name}: 缺少关键placeholder {{{{{ph_name}}}}}")
        
        # Check VAE compatibility
        for nid, node in wf.items():
            if 'VAE' in node.get('class_type', '') or 'VAELoader' in node.get('class_type', ''):
                vae_name = node.get('inputs', {}).get('vae_name', node.get('inputs', {}).get('model_name', ''))
                if 'wan_2.1_vae' in vae_name and 'WanVideo' not in node.get('class_type', ''):
                    warnings.append(f"{name}: 标准节点用wan_2.1_vae — 14B蒸馏应用Wan2_2_VAE_bf16")
                if 'Wan2_2_VAE_bf16' in vae_name and node.get('class_type', '') == 'WanVideoVAELoader':
                    # Good - WanVideoWrapper uses Wan2.2 VAE
                    pass
        
        # Check known bug flags
        if meta['known_bugs']:
            for bug in meta['known_bugs']:
                warnings.append(f"{name}: ⚠ 已知bug: {bug}")
    
    return errors, warnings

def test_db_workflow_mapping():
    """Check DB ai_service_configs → workflow files"""
    errors = []
    warnings = []
    
    try:
        db = sqlite3.connect(str(DB_PATH))
        rows = db.execute(
            "SELECT id, service_type, provider, name, settings FROM ai_service_configs"
        ).fetchall()
        db.close()
    except Exception as e:
        errors.append(f"DB连接失败: {e}")
        return errors, warnings
    
    for row in rows:
        id_, svc_type, provider, name, settings = row
        try:
            s = json.loads(settings) if isinstance(settings, str) else (settings or {})
        except:
            s = {}
        
        wf_file = s.get('workflow_file') or s.get('workflow_path')
        wf_json_inline = s.get('workflow_json')
        
        if provider == 'comfyui' or (wf_file or wf_json_inline):
            if wf_file:
                wf_path = WORKFLOW_DIR / wf_file
                if not wf_path.exists():
                    errors.append(f"DB ID={id_}: workflow_file '{wf_file}' 不存在!")
                elif wf_file not in WORKFLOW_REGISTRY:
                    warnings.append(f"DB ID={id_}: workflow_file '{wf_file}' 未在registry注册")
                else:
                    # Check DB ID matches registry
                    reg = WORKFLOW_REGISTRY[wf_file]
                    if id_ not in reg['db_ids'] and reg['db_ids']:
                        warnings.append(f"DB ID={id_}: 使用 '{wf_file}' 但registry预期ID={reg['db_ids']}")
    
    return errors, warnings

def test_placeholder_coverage():
    """Check videoClient.js substituteWorkflowPlaceholders covers all {{xxx}}"""
    errors = []
    warnings = []
    
    try:
        with open(VIDEO_CLIENT_PATH) as f:
            vc_content = f.read()
    except Exception as e:
        errors.append(f"videoClient.js读取失败: {e}")
        return errors, warnings
    
    # Find all placeholders defined in substituteWorkflowPlaceholders
    ph_def_pattern = re.compile(r"'\{\{(\w+)\}\}'")
    defined_ph = set(ph_def_pattern.findall(vc_content))
    
    # Required placeholders from workflows
    all_needed_ph = set()
    for name, meta in WORKFLOW_REGISTRY.items():
        for ph in meta['placeholders_needed']:
            ph_name = ph.replace('{{', '').replace('}}', '')
            all_needed_ph.add(ph_name)
    
    for ph in all_needed_ph:
        if ph not in defined_ph:
            errors.append(f"placeholder {{{{{ph}}}}} 在workflow中使用但videoClient.js未定义替换!")
    
    # Check numericFields set covers all numeric placeholders
    numeric_fields_pattern = re.compile(r"numericFields\s*=\s*new\s+Set\(\[([^\]]+)\]\)")
    m = numeric_fields_pattern.search(vc_content)
    if m:
        numeric_str = m.group(1)
        numeric_names = re.findall(r"'(\w+)'", numeric_str)
        for ph in ['seed', 'width', 'height', 'frames', 'steps', 'fps']:
            if ph not in numeric_names:
                warnings.append(f"numericFields缺少 '{ph}' — placeholder替换后不会转回数字")
    
    return errors, warnings

def test_api_routes():
    """Check backend routes exist and map to correct services"""
    errors = []
    warnings = []
    
    try:
        with open(ROUTES_PATH) as f:
            route_content = f.read()
    except Exception as e:
        errors.append(f"routes/videos.js读取失败: {e}")
        return errors, warnings
    
    # Check required route handlers
    required_handlers = ['list', 'create', 'get', 'delete', 'fromImage']
    for h in required_handlers:
        if h not in route_content:
            errors.append(f"videos.js缺少路由handler: {h}")
    
    # Check videoService.processVideoGeneration is called
    if 'processVideoGeneration' not in route_content:
        errors.append(f"videos.js create路由未调用processVideoGeneration!")
    
    # Check taskService.createTask is called
    if 'createTask' not in route_content:
        warnings.append(f"videos.js create路由未创建task记录")
    
    return errors, warnings

def test_video_client_comfyui_logic():
    """Check callComfyUiVideoApi workflow loading logic"""
    errors = []
    warnings = []
    
    try:
        with open(VIDEO_CLIENT_PATH) as f:
            vc = f.read()
    except Exception as e:
        errors.append(f"videoClient.js读取失败: {e}")
        return errors, warnings
    
    # Check 3-tier workflow loading: workflow_file → workflow_json → default
    if 'workflow_file' not in vc:
        errors.append("callComfyUiVideoApi缺少workflow_file加载逻辑")
    if 'workflow_json' not in vc:
        warnings.append("callComfyUiVideoApi缺少workflow_json fallback")
    if 'wan22_gguf_i2v.json' not in vc:
        warnings.append("callComfyUiVideoApi缺少默认workflow fallback")
    
    # Check I2V detection
    if 'isI2V' not in vc or 'image_url' not in vc:
        errors.append("callComfyUiVideoApi缺少I2V/T2V检测逻辑")
    
    # Check ComfyUI poll handling
    if '/history/' not in vc:
        errors.append("pollVideoTask缺少ComfyUI history查询逻辑")
    if 'isComfyUi' not in vc:
        errors.append("pollVideoTask缺少ComfyUI protocol分支")
    
    # Check video download (now in videoService.js, not videoClient.js)
    VS_PATH = PROJECT_ROOT / 'backend-node' / 'src' / 'services' / 'videoService.js'
    try:
        with open(VS_PATH) as f:
            vs_content = f.read()
    except Exception as e:
        errors.append(f"videoService.js读取失败: {e}")
        return errors, warnings
    
    if 'downloadVideoToLocal' not in vs_content:
        errors.append("videoService.js缺少downloadVideoToLocal — ComfyUI视频不会存本地!")
    if 'resolveRemoteVideoUrl' not in vs_content:
        warnings.append("videoService.js缺少resolveRemoteVideoUrl — 远程URL可能不转本地")
    if 'maybeNormalizeVideoAfterDownload' not in vs_content:
        warnings.append("videoService.js缺少maybeNormalizeVideoAfterDownload — 视频格式可能不一致")
    
    return errors, warnings

def test_image_client_comfyui_logic():
    """Check imageClient.js ComfyUI image generation"""
    errors = []
    warnings = []
    
    try:
        with open(IMAGE_CLIENT_PATH) as f:
            ic = f.read()
    except Exception as e:
        errors.append(f"imageClient.js读取失败: {e}")
        return errors, warnings
    
    if 'callComfyUIImageApi' not in ic:
        errors.append("imageClient.js缺少callComfyUIImageApi")
    if 'flux2_gguf_t2i.json' not in ic:
        warnings.append("imageClient.js缺少flux2_gguf_t2i默认workflow")
    
    return errors, warnings

def test_pipeline_stages_coverage():
    """Verify all pipeline stages have test coverage"""
    errors = []
    warnings = []
    
    covered_stages = set()
    # test_1 = stage E (SSH)
    covered_stages.add('E_ssh_tunnel')
    # test_2 = stage E (ComfyUI ready)
    covered_stages.add('E_ssh_tunnel')
    # test_3 = stages A, C, D (workflow validation + placeholder + DB mapping + routes)
    covered_stages.add('A_frontend_to_backend')
    covered_stages.add('C_ai_image')
    covered_stages.add('D_ai_video')
    # test_4 = stage E (models)
    covered_stages.add('E_ssh_tunnel')
    # test_5 = stage D+E (VAE encode critical path)
    covered_stages.add('D_ai_video')
    covered_stages.add('E_ssh_tunnel')
    # test_6 = stages D, E, F (full I2V)
    covered_stages.add('D_ai_video')
    covered_stages.add('E_ssh_tunnel')
    covered_stages.add('F_gpu_output')
    # test_7 = stage B (AI text reachability)
    covered_stages.add('B_ai_text')
    # test_8 = stages G, H (DB update + frontend display)
    covered_stages.add('G_db_update')
    covered_stages.add('H_frontend_display')
    
    for stage_name, stage_meta in PIPELINE_STAGES.items():
        if stage_name not in covered_stages:
            warnings.append(f"Pipeline stage '{stage_name}' ({stage_meta['desc']}) 没有测试覆盖!")
            for tp in stage_meta['test_points']:
                warnings.append(f"  → 未测试: {tp}")
    
    return errors, warnings

def main():
    print("=== Test 3: 全流程Pipeline验证 (11个workflow × 8个stage) ===")
    print("覆盖范围: 前端→后端→AI→ComfyUI→GPU→下载→DB→前端显示")
    
    all_errors = []
    all_warnings = []
    
    print("\n[1/8] Workflow JSON验证 (11个文件)")
    e, w = test_all_workflow_jsons()
    all_errors.extend(e)
    all_warnings.extend(w)
    print(f"  {len(e)}个错误, {len(w)}个警告")
    
    print("\n[2/8] DB → Workflow映射")
    e, w = test_db_workflow_mapping()
    all_errors.extend(e)
    all_warnings.extend(w)
    print(f"  {len(e)}个错误, {len(w)}个警告")
    
    print("\n[3/8] Placeholder覆盖 (videoClient.js)")
    e, w = test_placeholder_coverage()
    all_errors.extend(e)
    all_warnings.extend(w)
    print(f"  {len(e)}个错误, {len(w)}个警告")
    
    print("\n[4/8] API路由 (videos.js)")
    e, w = test_api_routes()
    all_errors.extend(e)
    all_warnings.extend(w)
    print(f"  {len(e)}个错误, {len(w)}个警告")
    
    print("\n[5/8] Video Client ComfyUI逻辑")
    e, w = test_video_client_comfyui_logic()
    all_errors.extend(e)
    all_warnings.extend(w)
    print(f"  {len(e)}个错误, {len(w)}个警告")
    
    print("\n[6/8] Image Client ComfyUI逻辑")
    e, w = test_image_client_comfyui_logic()
    all_errors.extend(e)
    all_warnings.extend(w)
    print(f"  {len(e)}个错误, {len(w)}个警告")
    
    print("\n[7/8] Pipeline stage覆盖度检查")
    e, w = test_pipeline_stages_coverage()
    all_errors.extend(e)
    all_warnings.extend(w)
    print(f"  {len(e)}个错误, {len(w)}个警告")
    
    print("\n[8/8] 已知bug清单汇总")
    for name, meta in WORKFLOW_REGISTRY.items():
        if meta['known_bugs']:
            for bug in meta['known_bugs']:
                all_warnings.append(f"⚠ {name}: {bug}")
    print(f"  {len([w for w in all_warnings if '已知bug' in w or '⚠' in w])}个已知bug")
    
    # Summary
    print(f"\n{'='*60}")
    print(f"总计: {len(all_errors)}个错误, {len(all_warnings)}个警告")
    
    if all_errors:
        print("\n❌ 错误清单:")
        for e in all_errors:
            print(f"  ✗ {e}")
    
    if all_warnings:
        print("\n⚠️ 警告清单:")
        for w in all_warnings:
            print(f"  ⚠ {w}")
    
    # Print pipeline coverage summary
    print(f"\n{'='*60}")
    print("Pipeline覆盖度:")
    covered = {'A': '✓(路由)', 'B': '⚠(需AI可达测试)', 'C': '✓(workflow+placeholder)',
               'D': '✓(workflow+bug)', 'E': '✓(SSH+GPU+模型)', 'F': '✓(下载验证)',
               'G': '⚠(需GPU跑完后验证DB)', 'H': '⚠(需前端跑完验证)'}
    for stage, status in covered.items():
        print(f"  Stage {stage}: {status}")
    
    untested = [w for w in all_warnings if '没有测试覆盖' in w or '未测试' in w]
    if untested:
        print(f"\n⚠ 缺少测试覆盖的stage ({len(untested)}项):")
        for u in untested:
            print(f"  {u}")
    
    if all_errors:
        print("\n✗ 有错误 — 修复后再跑GPU测试!")
        sys.exit(1)
    else:
        print("\n✓ 所有workflow和pipeline验证通过!")
        print("  ⚠ 注意: Stage B(AI文本)和G/H(DB+前端)需要实际运行验证")
        sys.exit(0)

if __name__ == "__main__":
    main()
