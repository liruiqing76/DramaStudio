#!/usr/bin/env python3
"""Test 5: Per-workflow VAE encode & node-specific tests
For EACH workflow type, tests the critical path that caused crashes before:
- Standard nodes: Wan22ImageToVideoLatent (1x2x482 bug)
- WanVideoWrapper: WanVideoImageToVideoEncode (68-channel bug)
- WanVideoWrapper TI2V: WanVideoEncode (same VAE path)
- GGUF: standard nodes (different VAE format)
Only runs if Test 1 (SSH) and Test 2 (ComfyUI ready) passed.
"""
import json, sys, subprocess, time, urllib.request, os
import tempfile

SSH_CMD_PREFIX = "sshpass -p liruiqing2025 ssh -p 11006 -o StrictHostKeyChecking=no root@connect.westb.seetacloud.com"
COMFYUI_URL = "http://localhost:18189"

# ===== 每个workflow的关键测试路径 =====
# Each entry: workflow_name, critical_nodes_to_test, expected_errors
WORKFLOW_CRITICAL_TESTS = {
    'wan22_distill_i2v.json': {
        'desc': '14B蒸馏(标准节点)',
        'critical_nodes': ['Wan22ImageToVideoLatent', 'UNETLoader', 'VAELoader'],
        'expected_errors': ['1 x 2 x 482', 'VAE encode kernel'],
        'test_workflow': {
            "1": {"class_type": "VAELoader", "inputs": {"vae_name": "wan_2.1_vae.safetensors"}},
            "2": {"class_type": "LoadImage", "inputs": {"image": "test_image.png"}},
            "3": {"class_type": "Wan22ImageToVideoLatent", "inputs": {
                "vae": ["1", 0], "width": 720, "height": 480, "length": 25, "start_image": ["2", 0]
            }},
            "4": {"class_type": "SaveImage", "inputs": {"images": ["2", 0], "filename_prefix": "vae_test_std"}}
        },
    },
    'wan22_distill_i2v_wrapper.json': {
        'desc': '14B蒸馏(WanVideoWrapper)',
        'critical_nodes': ['WanVideoImageToVideoEncode', 'WanVideoVAELoader', 'WanVideoModelLoader'],
        'expected_errors': ['68 channels', 'got 68', 'expected 36'],
        'test_workflow': {
            "1": {"class_type": "WanVideoVAELoader", "inputs": {
                "model_name": "Wan2_2_VAE_bf16.safetensors", "precision": "bf16"}},
            "2": {"class_type": "CLIPVisionLoader", "inputs": {"clip_name": "clip_vision_h.safetensors"}},
            "3": {"class_type": "LoadImage", "inputs": {"image": "test_image.png"}},
            "4": {"class_type": "WanVideoClipVisionEncode", "inputs": {
                "clip_vision": ["2", 0], "image_1": ["3", 0],
                "strength_1": 1.0, "strength_2": 1.0, "crop": "center",
                "combine_embeds": "average", "force_offload": True}},
            "5": {"class_type": "WanVideoImageToVideoEncode", "inputs": {
                "width": 720, "height": 480, "num_frames": 25,
                "noise_aug_strength": 0.0, "start_latent_strength": 1.0,
                "end_latent_strength": 1.0, "force_offload": True,
                "vae": ["1", 0], "clip_embeds": ["4", 0], "start_image": ["3", 0]},
            },
            "6": {"class_type": "SaveImage", "inputs": {"images": ["3", 0], "filename_prefix": "vae_test_wrapper"}},
        },
    },
    'wan22_5b_distill_i2v.json': {
        'desc': '5B TI2V(WanVideoWrapper)',
        'critical_nodes': ['WanVideoEncode', 'WanVideoEmptyEmbeds', 'WanVideoModelLoader'],
        'expected_errors': [],
        'test_workflow': {
            "1": {"class_type": "WanVideoVAELoader", "inputs": {
                "model_name": "Wan2_2_VAE_bf16.safetensors", "precision": "bf16"}},
            "2": {"class_type": "LoadImage", "inputs": {"image": "test_image.png"}},
            "3": {"class_type": "WanVideoEncode", "inputs": {
                "vae": ["1", 0], "image": ["2", 0],
                "enable_vae_tiling": False,
                "tile_x": 272, "tile_y": 272, "tile_stride_x": 144, "tile_stride_y": 128}},
            "4": {"class_type": "SaveImage", "inputs": {"images": ["2", 0], "filename_prefix": "vae_test_5b"}},
        },
    },
    'wan22_5b_ovi_i2v.json': {
        'desc': '5B OVI(无image输入,只测T5+EmptyEmbeds)',
        'critical_nodes': ['WanVideoEmptyEmbeds', 'LoadWanVideoT5TextEncoder'],
        'expected_errors': [],
        'test_workflow': {
            "1": {"class_type": "LoadWanVideoT5TextEncoder", "inputs": {
                "model_name": "umt5_xxl_fp8_e4m3fn_scaled.safetensors",
                "precision": "bf16", "load_device": "offload_device", "quantization": "fp8_e4m3fn"}},
            "2": {"class_type": "WanVideoTextEncode", "inputs": {
                "t5": ["1", 0], "positive_prompt": "test", "negative_prompt": "",
                "force_offload": True}},
            "3": {"class_type": "WanVideoVAELoader", "inputs": {
                "model_name": "Wan2_2_VAE_bf16.safetensors", "precision": "bf16"}},
            "4": {"class_type": "WanVideoEmptyEmbeds", "inputs": {
                "width": 960, "height": 960, "num_frames": 25}},
        },
    },
    'wan21_gguf_i2v.json': {
        'desc': 'Wan2.1 GGUF(WanVideoWrapper)',
        'critical_nodes': ['WanVideoModelLoader', 'WanVideoEncode'],
        'expected_errors': [],
        'test_workflow': {
            "1": {"class_type": "WanVideoVAELoader", "inputs": {
                "model_name": "Wan2_2_VAE_bf16.safetensors", "precision": "bf16"}},
            "2": {"class_type": "LoadImage", "inputs": {"image": "test_image.png"}},
            "3": {"class_type": "WanVideoEncode", "inputs": {
                "vae": ["1", 0], "image": ["2", 0],
                "enable_vae_tiling": False,
                "tile_x": 272, "tile_y": 272, "tile_stride_x": 144, "tile_stride_y": 128}},
            "4": {"class_type": "SaveImage", "inputs": {"images": ["2", 0], "filename_prefix": "vae_test_w21"}},
        },
    },
    'wan22_gguf_i2v.json': {
        'desc': 'Wan2.2 GGUF(标准节点)',
        'critical_nodes': ['UnetLoaderGGUF', 'VAELoader', 'CLIPVisionEncode'],
        'expected_errors': [],
        'test_workflow': {
            "1": {"class_type": "VAELoader", "inputs": {"vae_name": "wan_2.1_vae.safetensors"}},
            "2": {"class_type": "CLIPVisionLoader", "inputs": {"clip_name": "clip_vision_h.safetensors"}},
            "3": {"class_type": "LoadImage", "inputs": {"image": "test_image.png"}},
            "4": {"class_type": "CLIPVisionEncode", "inputs": {"clip_vision": ["2", 0], "image": ["3", 0]}},
            "5": {"class_type": "SaveImage", "inputs": {"images": ["3", 0], "filename_prefix": "vae_test_gguf"}},
        },
    },
    'wan22_gguf_t2v.json': {
        'desc': 'Wan2.2 GGUF T2V(标准节点,T2V不用VAE encode)',
        'critical_nodes': ['UnetLoaderGGUF', 'CLIPLoader'],
        'expected_errors': [],
        'test_workflow': None,  # T2V不需要VAE encode测试
    },
    'flux2_gguf_t2i.json': {
        'desc': 'Flux2 GGUF T2I(图像生成,不同VAE)',
        'critical_nodes': ['UnetLoaderGGUF', 'DualCLIPLoader', 'VAELoader'],
        'expected_errors': [],
        'test_workflow': {
            "1": {"class_type": "VAELoader", "inputs": {"vae_name": "ae.safetensors"}},
            "2": {"class_type": "SaveImage", "inputs": {"images": ["2", 0], "filename_prefix": "skip"}},
        },
    },
    'flux2_gguf_i2i.json': {
        'desc': 'Flux2 GGUF I2I(VAEEncode测试)',
        'critical_nodes': ['UNETLoader', 'VAEEncode'],
        'expected_errors': [],
        'test_workflow': {
            "1": {"class_type": "VAELoader", "inputs": {"vae_name": "ae.safetensors"}},
            "2": {"class_type": "LoadImage", "inputs": {"image": "test_image.png"}},
            "3": {"class_type": "VAEEncode", "inputs": {"pixels": ["2", 0], "vae": ["1", 0]}},
            "4": {"class_type": "SaveImage", "inputs": {"images": ["2", 0], "filename_prefix": "vae_test_flux"}},
        },
    },
    'ltx_video_t2v.json': {
        'desc': 'LTX Video T2V(LTXVLoader自带VAE)',
        'critical_nodes': ['LTXVLoader'],
        'expected_errors': [],
        'test_workflow': None,  # LTXV自带VAE,不需要单独测试
    },
}

def run_ssh(cmd, timeout=15):
    full_cmd = f'{SSH_CMD_PREFIX} "{cmd}"'
    r = subprocess.run(full_cmd, shell=True, capture_output=True, text=True, timeout=timeout)
    return r.returncode, r.stdout.strip(), r.stderr.strip()

def scp_to_server(local_path, remote_path="/tmp/"):
    r = subprocess.run(f'sshpass -p liruiqing2025 scp -P 11006 -o StrictHostKeyChecking=no {local_path} root@connect.westb.seetacloud.com:{remote_path}',
                       shell=True, capture_output=True, timeout=15)
    return r.returncode == 0

def run_server_script(script_content, timeout=120):
    with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False, dir=os.environ.get('TEMP', 'C:\\Users\\leslie\\AppData\\Local\\Temp')) as f:
        f.write(script_content)
        f.flush()
        local_path = f.name
    remote_name = os.path.basename(local_path)
    scp_to_server(local_path, f"/tmp/{remote_name}")
    r = subprocess.run(f'{SSH_CMD_PREFIX} "echo /root/miniconda3/bin/python /tmp/{remote_name} > /tmp/run_{remote_name}.sh && bash /tmp/run_{remote_name}.sh"',
                       shell=True, capture_output=True, timeout=timeout)
    return r.stdout.strip(), r.stderr.strip()

def check_prerequisites():
    """Tests 1-2 must have passed"""
    flag_dir = os.path.join(os.path.dirname(__file__), '.test_flags')
    for i in [1, 2]:
        flag = os.path.join(flag_dir, f"test_{i}.passed")
        assert os.path.exists(flag), f"Test {i} not passed! Run run_all_tests.py first"

def submit_workflow(wf, wf_name, timeout=120):
    """Submit a test workflow to ComfyUI and monitor until completion/error"""
    wf_json = json.dumps(wf)
    
    monitor_script = """
import json, urllib.request, time, sys

wf = json.loads(open('/tmp/vae_test_wf.json').read())
data = json.dumps({'prompt': wf}).encode()
req = urllib.request.Request('http://127.0.0.1:8188/prompt', data=data, headers={'Content-Type': 'application/json'})

try:
    resp = urllib.request.urlopen(req, timeout=30)
    result = json.loads(resp.read().decode())
    pid = result['prompt_id']
    ne = result.get('node_errors', {})
    if ne:
        print('NODE_ERRORS:' + json.dumps(ne)[:500])
        sys.exit(1)
    print('SUBMITTED:' + pid)
except urllib.error.HTTPError as e:
    body = e.read().decode()[:500]
    print('FAIL_SUBMIT:' + str(e.code) + ':' + body)
    sys.exit(1)

start = time.time()
while time.time() - start < """ + str(timeout) + """:
    try:
        resp = urllib.request.urlopen('http://127.0.0.1:8188/history/' + pid, timeout=5)
        d = json.loads(resp.read().decode())
        if pid in d:
            s = d[pid]['status']['status_str']
            elapsed = int(time.time() - start)
            if s == 'success':
                print('OK:' + str(elapsed))
                sys.exit(0)
            elif s == 'error':
                msgs = d[pid]['status'].get('messages', [])
                for m in msgs:
                    for x in m:
                        if isinstance(x, dict):
                            msg = str(x.get('exception_message',''))[:500]
                            node = x.get('node_type','')
                            nid_err = x.get('node_id','')
                            print('ERROR:node=' + str(nid_err) + ' type=' + node + ' msg=' + msg)
                print('FAIL:' + str(elapsed))
                sys.exit(2)
    except:
        pass
    time.sleep(5)
print('TIMEOUT')
sys.exit(3)
"""
    
    # Write workflow JSON to temp file and upload
    with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
        f.write(wf_json)
        f.flush()
        local_wf = f.name
    scp_to_server(local_wf, "/tmp/vae_test_wf.json")
    
    out, err = run_server_script(monitor_script, timeout=timeout + 30)
    return out

def check_known_errors(output, wf_name, expected_errors):
    """Check output against known error patterns for this workflow"""
    for pattern in expected_errors:
        if pattern in output:
            return False, f"已知bug触发: {pattern}"
    
    # Also check for unexpected critical errors
    critical_patterns = ['CUDA out of memory', 'RuntimeError', 'OOM', 'segfault']
    for pattern in critical_patterns:
        if pattern in output:
            return False, f"严重错误: {pattern} in output"
    
    return True, "OK"

def run_single_workflow_test(wf_name, meta):
    """Test a single workflow's critical path"""
    desc = meta['desc']
    critical_nodes = meta['critical_nodes']
    expected_errors = meta['expected_errors']
    test_wf = meta['test_workflow']
    
    print(f"\n  ▶ {wf_name}: {desc}")
    print(f"    关键节点: {', '.join(critical_nodes)}")
    
    if test_wf is None:
        print(f"    → 跳过(S2V/T2V不需要VAE encode测试)")
        return True
    
    # Upload test image if needed
    # (Assume test_2 already created test_image.png)
    
    output = submit_workflow(test_wf, wf_name, timeout=60)
    
    if "OK:" in output:
        elapsed = output.split("OK:")[1].strip().split()[0]
        print(f"    ✓ VAE encode通过 ({elapsed}s)")
        return True
    elif "FAIL_SUBMIT:" in output:
        print(f"    ✗ 提交失败: {output[:200]}")
        return False
    elif "NODE_ERRORS:" in output:
        print(f"    ✗ 节点验证失败: {output[:200]}")
        return False
    else:
        ok, msg = check_known_errors(output, wf_name, expected_errors)
        if ok:
            # Check if there's any ERROR in output that's not expected
            if "ERROR:" in output:
                error_detail = output.split("ERROR:")[1][:200]
                print(f"    ✗ 未知错误: {error_detail}")
                return False
            else:
                print(f"    ⚠ 输出异常: {output[:200]}")
                return False
        else:
            print(f"    ✗ {msg}")
            print(f"    详情: {output[:300]}")
            return False

def main():
    print("=== Test 5: 每个Workflow的VAE Encode & 关键路径测试 ===")
    print("测试每个workflow特有的已知bug点:")
    print("  - 标准节点: Wan22ImageToVideoLatent (1x2x482)")
    print("  - WanVideoWrapper: WanVideoImageToVideoEncode (68-channel)")
    print("  - GGUF: 节点兼容性")
    print("  - Flux: VAEEncode兼容性")
    
    try:
        check_prerequisites()
    except AssertionError as e:
        print(f"  ⚠ {e}")
        print("  → 先运行 run_all_tests.py 让test 1-2通过")
        return 1
    
    passed = 0
    failed = 0
    skipped = 0
    total = len(WORKFLOW_CRITICAL_TESTS)
    
    for wf_name, meta in WORKFLOW_CRITICAL_TESTS.items():
        try:
            result = run_single_workflow_test(wf_name, meta)
            if result:
                passed += 1
            else:
                failed += 1
        except Exception as e:
            if meta['test_workflow'] is None:
                skipped += 1
            else:
                print(f"    ✗ 异常: {e}")
                failed += 1
    
    # Skipped workflows
    for wf_name, meta in WORKFLOW_CRITICAL_TESTS.items():
        if meta['test_workflow'] is None:
            skipped += 1
            passed -= 1  # Adjust count
    
    print(f"\n{'='*50}")
    print(f"结果: {passed}通过, {failed}失败, {skipped}跳过(T2V/S2V)")
    
    if failed > 0:
        print("⚠ 有workflow的关键路径测试失败!")
        print("  修复这些bug后再跑完整I2V流程!")
        # Print specific failures
        for wf_name, meta in WORKFLOW_CRITICAL_TESTS.items():
            if meta['expected_errors']:
                print(f"  - {wf_name}: 已知bug = {meta['expected_errors']}")
    else:
        print("✓ 所有关键路径测试通过!")
    
    sys.exit(0 if failed == 0 else 1)

if __name__ == "__main__":
    sys.exit(main())
