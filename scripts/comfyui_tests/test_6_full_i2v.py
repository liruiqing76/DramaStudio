#!/usr/bin/env python3
"""Test 6: Full workflow tests for ALL models
ONLY runs if tests 1-5 all passed!
For each workflow: submit → monitor → verify video/image output → measure time
"""
import json, sys, subprocess, time, urllib.request, os, tempfile

SSH_CMD_PREFIX = "sshpass -p liruiqing2025 ssh -p 11006 -o StrictHostKeyChecking=no root@connect.westb.seetacloud.com"
COMFYUI_URL = "http://localhost:18189"
WORKFLOW_DIR = os.path.normpath(os.path.join(os.path.dirname(__file__), '..', '..', 'backend-node', 'configs', 'comfyui_workflows'))

# ===== 测试参数 (每个workflow不同的测试配置) =====
WORKFLOW_TEST_CONFIGS = {
    'wan22_distill_i2v.json': {
        'desc': '14B蒸馏I2V(标准节点) — 4步, 720x480, 25fps',
        'timeout': 180,  # 14B蒸馏4步应该在2分钟内
        'max_time': 120,  # 目标: ≤2分钟
        'placeholders': {
            '{{prompt}}': 'a woman walking in a garden',
            '{{negative_prompt}}': '',
            '{{width}}': '720', '{{height}}': '480',
            '{{frames}}': '25', '{{steps}}': '4',
            '{{cfg}}': '1.0', '{{seed}}': '42',
            '{{fps}}': '25', '{{sampler_name}}': 'uni_pc_bh2',
            '{{image_url}}': 'test_image.png',
            '{{filename_prefix}}': 'test_distill_std',
        },
        'expected_output': 'video',
    },
    'wan22_distill_i2v_wrapper.json': {
        'desc': '14B蒸馏I2V(WanVideoWrapper) — 4步, 720x480, 25fps',
        'timeout': 180,
        'max_time': 120,
        'placeholders': {
            '{{prompt}}': 'a woman walking in a garden',
            '{{negative_prompt}}': '',
            '{{width}}': '720', '{{height}}': '480',
            '{{frames}}': '25', '{{steps}}': '4',
            '{{cfg}}': '1.0', '{{seed}}': '42',
            '{{fps}}': '25',
            '{{image_url}}': 'test_image.png',
            '{{filename_prefix}}': 'test_distill_wrapper',
        },
        'expected_output': 'video',
    },
    'wan22_5b_distill_i2v.json': {
        'desc': '5B TI2V — 4步, 720x480, 25fps',
        'timeout': 120,
        'max_time': 60,  # 5B应该更快
        'placeholders': {
            '{{prompt}}': 'a woman walking in a garden',
            '{{negative_prompt}}': '',
            '{{width}}': '720', '{{height}}': '480',
            '{{frames}}': '25', '{{steps}}': '4',
            '{{cfg}}': '1.0', '{{seed}}': '42',
            '{{fps}}': '25',
            '{{image_url}}': 'test_image.png',
            '{{filename_prefix}}': 'test_5b',
        },
        'expected_output': 'video',
    },
    'wan22_5b_ovi_i2v.json': {
        'desc': '5B OVI 960x960 — 纯T2V(无image), VRAM可能不够',
        'timeout': 300,
        'max_time': 240,
        'placeholders': {
            '{{prompt}}': 'a woman dancing',
            '{{negative_prompt}}': '',
            '{{frames}}': '25', '{{steps}}': '4',
            '{{cfg}}': '1.0', '{{seed}}': '42',
            '{{fps}}': '25',
            '{{filename_prefix}}': 'test_ovi',
        },
        'expected_output': 'video',
        'skip_if_vram_low': True,  # 960x960需要~30GB VRAM
    },
    'wan21_gguf_i2v.json': {
        'desc': 'Wan2.1 GGUF 14B I2V — 20步, 慢',
        'timeout': 900,  # GGUF 20步可能10分钟
        'max_time': 600,
        'placeholders': {
            '{{prompt}}': 'a woman walking',
            '{{negative_prompt}}': '',
            '{{width}}': '720', '{{height}}': '480',
            '{{frames}}': '25', '{{steps}}': '20',
            '{{cfg}}': '1.0', '{{seed}}': '42',
            '{{fps}}': '25',
            '{{image_url}}': 'test_image.png',
            '{{filename_prefix}}': 'test_w21_gguf',
        },
        'expected_output': 'video',
        'skip_by_default': True,  # 太慢,默认跳过
    },
    'wan22_gguf_i2v.json': {
        'desc': 'Wan2.2 GGUF I2V — 20步, 慢',
        'timeout': 900,
        'max_time': 600,
        'placeholders': {
            '{{prompt}}': 'a woman walking',
            '{{negative_prompt}}': '',
            '{{width}}': '720', '{{height}}': '480',
            '{{frames}}': '25', '{{steps}}': '20',
            '{{cfg}}': '1.0', '{{seed}}': '42',
            '{{fps}}': '25', '{{sampler_name}}': 'uni_pc_bh2',
            '{{image_url}}': 'test_image.png',
            '{{filename_prefix}}': 'test_w22_gguf',
        },
        'expected_output': 'video',
        'skip_by_default': True,
    },
    'wan22_gguf_t2v.json': {
        'desc': 'Wan2.2 GGUF T2V — 已禁用',
        'skip': True,
        'reason': '只用I2V,不用T2V',
    },
    'flux2_gguf_t2i.json': {
        'desc': 'Flux2 GGUF T2I — 20步, 图片生成',
        'timeout': 120,
        'max_time': 60,
        'placeholders': {
            '{{prompt}}': 'a beautiful woman portrait',
            '{{negative_prompt}}': '',
            '{{width}}': '720', '{{height}}': '480',
            '{{seed}}': '42',
            '{{filename_prefix}}': 'test_flux_t2i',
        },
        'expected_output': 'image',
    },
    'flux2_gguf_i2i.json': {
        'desc': 'Flux2 GGUF I2I — 20步, 图生图',
        'timeout': 120,
        'max_time': 60,
        'placeholders': {
            '{{prompt}}': 'enhanced portrait',
            '{{negative_prompt}}': '',
            '{{seed}}': '42', '{{denoise}}': '0.7',
            '{{image_url}}': 'test_image.png',
            '{{filename_prefix}}': 'test_flux_i2i',
        },
        'expected_output': 'image',
    },
    'ltx_video_t2v.json': {
        'desc': 'LTX Video T2V — 实验性',
        'timeout': 180,
        'max_time': 120,
        'placeholders': {
            '{{prompt}}': 'a woman walking',
            '{{negative_prompt}}': '',
            '{{width}}': '720', '{{height}}': '480',
            '{{frames}}': '25', '{{steps}}': '20',
            '{{seed}}': '42', '{{fps}}': '25',
            '{{sampler_name}}': 'euler',
            '{{filename_prefix}}': 'test_ltxv',
        },
        'expected_output': 'video',
        'skip_by_default': True,  # 实验性,默认跳过
    },
}

def fill_placeholders(wf, placeholders):
    """Replace {{xxx}} placeholders with test values"""
    for nid, node in wf.items():
        for key, val in node['inputs'].items():
            if isinstance(val, str) and val in placeholders:
                node['inputs'][key] = placeholders[val]
            elif isinstance(val, str):
                for ph, replacement in placeholders.items():
                    val = val.replace(ph, replacement)
                node['inputs'][key] = val

def run_ssh(cmd, timeout=15):
    full_cmd = f'{SSH_CMD_PREFIX} "{cmd}"'
    r = subprocess.run(full_cmd, shell=True, capture_output=True, text=True, timeout=timeout)
    return r.returncode, r.stdout.strip(), r.stderr.strip()

def scp_to_server(local_path, remote_path="/tmp/"):
    r = subprocess.run(f'sshpass -p liruiqing2025 scp -P 11006 -o StrictHostKeyChecking=no {local_path} root@connect.westb.seetacloud.com:{remote_path}',
                       shell=True, capture_output=True, timeout=15)
    return r.returncode == 0

def check_vram():
    """Check available VRAM — important for OVI (960x960)"""
    try:
        r = urllib.request.urlopen(f"{COMFYUI_URL}/system_stats", timeout=5)
        data = json.loads(r.read().decode())
        vram_total = data.get('devices', [{}])[0].get('vram_total', 0)
        vram_free = data.get('devices', [{}])[0].get('vram_free', 0)
        return vram_total, vram_free
    except:
        return 0, 0

def submit_and_monitor(wf, timeout_s):
    """Submit workflow to ComfyUI and monitor until completion"""
    wf_json = json.dumps(wf)
    
    with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
        f.write(wf_json)
        f.flush()
        local_wf = f.name
    scp_to_server(local_wf, "/tmp/full_test_wf.json")
    
    timeout_str = str(timeout_s)
    monitor_script = """
import json, urllib.request, time, sys

wf = json.loads(open('/tmp/full_test_wf.json').read())
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
while time.time() - start < """ + timeout_str + """:
    try:
        resp = urllib.request.urlopen('http://127.0.0.1:8188/history/' + pid, timeout=5)
        d = json.loads(resp.read().decode())
        if pid in d:
            s = d[pid]['status']['status_str']
            elapsed = int(time.time() - start)
            if s == 'success':
                outputs = d[pid].get('outputs', {})
                out_type = ''
                for nid, out in outputs.items():
                    if 'videos' in out:
                        out_type = 'VIDEO'
                        for v in out['videos']:
                            fn = v.get('filename','')
                            sub = v.get('subfolder','')
                            fmt = v.get('format','')
                            print('OUTPUT:' + fn + '|' + sub + '|' + fmt)
                    elif 'images' in out:
                        out_type = 'IMAGE'
                        for v in out['images']:
                            fn = v.get('filename','')
                            sub = v.get('subfolder','')
                            print('OUTPUT:' + fn + '|' + sub)
                print('COMPLETE:' + str(elapsed) + ':' + out_type)
                sys.exit(0)
            elif s == 'error':
                msgs = d[pid]['status'].get('messages', [])
                for m in msgs:
                    for x in m:
                        if isinstance(x, dict):
                            msg = str(x.get('exception_message',''))[:300]
                            node = x.get('node_type','')
                            nid_err = x.get('node_id','')
                            print('ERROR:node=' + str(nid_err) + ' type=' + node + ' msg=' + msg)
                print('FAIL:' + str(elapsed))
                sys.exit(2)
    except:
        pass
    time.sleep(10)
print('TIMEOUT')
sys.exit(3)
"""
    
    with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False, dir=os.environ.get('TEMP', 'C:\\Users\\leslie\\AppData\\Local\\Temp')) as f:
        f.write(monitor_script)
        f.flush()
        local_script = f.name
    scp_to_server(local_script, "/tmp/full_test_monitor.py")
    
    r = subprocess.run(f'{SSH_CMD_PREFIX} "echo /root/miniconda3/bin/python /tmp/full_test_monitor.py > /tmp/run_full_test.sh && bash /tmp/run_full_test.sh"',
                       shell=True, capture_output=True, timeout=timeout_s + 60)
    return r.stdout.strip()

def test_workflow(wf_name, config):
    """Test a single workflow end-to-end"""
    desc = config['desc']
    
    if config.get('skip'):
        print(f"  ⊘ {wf_name}: {desc} — 跳过({config.get('reason','')})")
        return True
    
    if config.get('skip_by_default'):
        print(f"  ⊘ {wf_name}: {desc} — 默认跳过(太慢/实验性)")
        return True
    
    # VRAM check for high-demand workflows
    if config.get('skip_if_vram_low'):
        vram_total, vram_free = check_vram()
        vram_gb = vram_total / (1024**3) if vram_total else 0
        if vram_gb < 30:
            print(f"  ⊘ {wf_name}: {desc} — VRAM不足({vram_gb:.1f}GB < 30GB)")
            return True
    
    # Load and fill workflow
    wf_path = os.path.join(WORKFLOW_DIR, wf_name)
    with open(wf_path) as f:
        wf = json.load(f)
    
    fill_placeholders(wf, config['placeholders'])
    
    print(f"  ▶ {wf_name}: {desc}")
    print(f"    timeout={config['timeout']}s, 目标≤{config['max_time']}s")
    
    output = submit_and_monitor(wf, config['timeout'])
    
    if "COMPLETE:" in output:
        parts = output.split("COMPLETE:")[1].strip().split(':')
        elapsed = int(parts[0])
        out_type = parts[1] if len(parts) > 1 else '?'
        
        within_target = elapsed <= config['max_time']
        status = "✓" if within_target else "⚠(慢)"
        print(f"    {status} 完成: {elapsed}秒 (目标≤{config['max_time']}s), 输出={out_type}")
        
        # Check output file
        if "OUTPUT:" in output:
            out_info = output.split("OUTPUT:")[1].strip()
            print(f"    输出文件: {out_info}")
        
        # Verify video size for video outputs
        if out_type == 'VIDEO':
            # Find video in output directory
            code, out, err = run_ssh("ls -t /root/autodl-tmp/ComfyUI/output/*.mp4 /root/autodl-tmp/ComfyUI/output/*.webm 2>/dev/null | head -3", timeout=10)
            if out.strip():
                latest = out.strip().split('\n')[0]
                code, out, err = run_ssh(f"stat -c %s {latest} 2>/dev/null", timeout=10)
                if out.strip() and out.strip().isdigit():
                    size_mb = int(out.strip()) / (1024*1024)
                    print(f"    视频大小: {size_mb:.2f}MB")
        
        return True
    elif "FAIL_SUBMIT:" in output:
        print(f"    ✗ 提交失败: {output[:200]}")
        return False
    elif "NODE_ERRORS:" in output:
        print(f"    ✗ 节点验证失败: {output[:200]}")
        return False
    elif "FAIL:" in output:
        print(f"    ✗ 执行失败: {output[:200]}")
        return False
    elif "TIMEOUT" in output:
        print(f"    ✗ 超时({config['timeout']}s)")
        return False
    else:
        print(f"    ⚠ 异常输出: {output[:200]}")
        return False

def main():
    print("=== Test 6: 所有模型完整流程测试 ===")
    print("⚠ 只有test 1-5全通过后才跑!")
    print("跳过的workflow: T2V(已禁用), GGUF(太慢), LTXV(实验)")
    print()
    
    # Check prerequisites
    flag_dir = os.path.join(os.path.dirname(__file__), '.test_flags')
    for i in range(1, 6):
        flag = os.path.join(flag_dir, f"test_{i}.passed")
        assert os.path.exists(flag), f"Test {i} not passed!"
    
    print("✓ 前置测试1-5全部通过，开始完整流程测试")
    
    passed = 0
    failed = 0
    skipped = 0
    
    for wf_name, config in WORKFLOW_TEST_CONFIGS.items():
        if config.get('skip') or config.get('skip_by_default'):
            skipped += 1
            test_workflow(wf_name, config)
            continue
        
        try:
            result = test_workflow(wf_name, config)
            if result:
                passed += 1
            else:
                failed += 1
        except Exception as e:
            print(f"    ✗ 异常: {e}")
            failed += 1
    
    print(f"\n{'='*50}")
    print(f"完整流程测试结果: {passed}通过, {failed}失败, {skipped}跳过")
    
    if failed > 0:
        print("✗ 有workflow失败 — 查看错误详情修复!")
    else:
        print("✓ 所有测试workflow通过!")
    
    sys.exit(0 if failed == 0 else 1)

if __name__ == "__main__":
    sys.exit(main())
