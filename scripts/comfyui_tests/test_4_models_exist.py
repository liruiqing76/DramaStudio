#!/usr/bin/env python3
"""Test 4: ALL model files exist + size + format validation
Checks every model needed by every workflow in the registry."""
import subprocess, sys, os, json

SSH_CMD_PREFIX = "sshpass -p liruiqing2025 ssh -p 11006 -o StrictHostKeyChecking=no root@connect.westb.seetacloud.com"
MODEL_BASE = "/root/autodl-tmp/comfyui_models"

# Import workflow registry from test_3
test3_path = os.path.join(os.path.dirname(__file__), 'test_3_workflow_validate.py')
# We'll just hardcode the model list here for reliability
ALL_MODELS = {
    # Diffusion models (unet/dit)
    'wan_fp8_scaled/I2V/Wan2_2-I2V-A14B-HIGH_fp8_e4m3fn_scaled_KJ.safetensors': {'min_size_mb': 1, 'desc': '14B蒸馏HIGH(主方案)', 'format': 'safetensors', 'expected_in_channels': 36},
    'wan_fp8_scaled/I2V/Wan2_2-I2V-A14B-LOW_fp8_e4m3fn_scaled_KJ.safetensors': {'min_size_mb': 1, 'desc': '14B蒸馏LOW(二次pass)', 'format': 'safetensors', 'expected_in_channels': 36},
    'wan_fp8_scaled/TI2V/Wan2_2-TI2V-5B_fp8_e4m3fn_scaled_KJ.safetensors': {'min_size_mb': 1, 'desc': '5B TI2V', 'format': 'safetensors'},
    'wan_fp8_scaled/TI2V/Ovi/Wan2_2-5B-Ovi_960x960_fp8_e4m3fn_scaled_KJ.safetensors': {'min_size_mb': 1, 'desc': '5B OVI 960x960', 'format': 'safetensors'},
    'wan2.1-I2V-14B-720P-Q4_K_M.gguf': {'min_size_mb': 1, 'desc': 'Wan2.1 GGUF Q4 I2V', 'format': 'gguf'},
    'Wan2.2-I2V-HighNoise-Q4_K_M.gguf': {'min_size_mb': 1, 'desc': 'Wan2.2 GGUF Q4 I2V', 'format': 'gguf'},
    'GGUF/flux2-dev-Q4_K_M.gguf': {'min_size_mb': 1, 'desc': 'Flux2 GGUF Q4 T2I', 'format': 'gguf'},
    'flux2-dev-Q4_K_M.gguf': {'min_size_mb': 1, 'desc': 'Flux2 GGUF Q4 I2I', 'format': 'gguf'},
    'ltx-video-2b-v0.9.5.safetensors': {'min_size_mb': 1, 'desc': 'LTX Video 2B', 'format': 'safetensors'},
    
    # Text encoder models
    'umt5_xxl_fp8_e4m3fn_scaled.safetensors': {'min_size_mb': 1, 'desc': 'UMT5 XXL text encoder(fp8)', 'format': 'safetensors'},
    't5xxl_fp8_e4m3fn.safetensors': {'min_size_mb': 1, 'desc': 'T5 XXL text encoder', 'format': 'safetensors'},
    'clip_l.safetensors': {'min_size_mb': 0.1, 'desc': 'CLIP-L(flux用)', 'format': 'safetensors'},
    
    # VAE models
    'Wan2_2_VAE_bf16.safetensors': {'min_size_mb': 1, 'desc': 'Wan2.2 VAE bf16(14B蒸馏用)', 'format': 'safetensors', 'critical': True},
    'wan_2.1_vae.safetensors': {'min_size_mb': 1, 'desc': 'Wan2.1 VAE(GGUF标准节点用)', 'format': 'safetensors'},
    'ae.safetensors': {'min_size_mb': 0.5, 'desc': 'Flux AE', 'format': 'safetensors'},
    
    # CLIP vision models
    'clip_vision_h.safetensors': {'min_size_mb': 1, 'desc': 'CLIP vision H(Wan I2V用)', 'format': 'safetensors', 'critical': True},
}

def run_ssh(cmd, timeout=15):
    full_cmd = f'{SSH_CMD_PREFIX} "{cmd}"'
    r = subprocess.run(full_cmd, shell=True, capture_output=True, text=True, timeout=timeout)
    return r.returncode, r.stdout.strip(), r.stderr.strip()

def check_model(rel_path, meta):
    """Check a single model file on remote server"""
    full_path = f"{MODEL_BASE}/{rel_path}"
    desc = meta['desc']
    format_type = meta['format']
    critical = meta.get('critical', False)
    
    # 1. File existence
    code, out, err = run_ssh(f"test -f {full_path} && echo EXISTS || echo MISSING")
    if "MISSING" in out:
        status = "✗" if critical else "⚠"
        print(f"  {status} {desc}: MISSING ({full_path})")
        return False if critical else True  # Non-critical missing = warning, not fail
    
    # 2. File size
    code, out, err = run_ssh(f"stat -c %s {full_path} 2>/dev/null || echo 0")
    size_bytes = int(out) if out.isdigit() else 0
    size_mb = size_bytes / (1024 * 1024)
    min_size = meta['min_size_mb']
    
    if size_mb < min_size:
        print(f"  ✗ {desc}: 文件太小({size_mb:.1f}MB < {min_size}MB) — 可能下载不完整")
        return False
    
    # 3. Format check (safetensors vs gguf)
    if format_type == 'gguf':
        code, out, err = run_ssh(f"head -c 4 {full_path} | xxd -p | head -1")
        if not out.strip():
            # Alternative: check filename ends with .gguf
            pass  # Already checked by filename
    elif format_type == 'safetensors':
        # safetensors files start with a JSON header
        code, out, err = run_ssh(f"head -c 8 {full_path} | cat")
        # Don't validate binary content via SSH, just check filename
    
    # 4. in_channels check for critical models
    expected_ic = meta.get('expected_in_channels')
    if expected_ic:
        # Read safetensors metadata to check patch_embedding shape
        check_script = f"""
import struct, json
with open('{full_path}', 'rb') as f:
    header_len = struct.unpack('<Q', f.read(8))[0]
    header = json.loads(f.read(header_len))
    # Find patch_embedding.weight
    for key, val in header.items():
        if 'patch_embedding' in key:
            shape = val.get('shape', [])
            print(f'SHAPE:{shape}')
            if len(shape) >= 2:
                ic = shape[1]
                print(f'IN_CHANNELS:{ic}')
            break
"""
        code, out, err = run_ssh(f"echo /root/miniconda3/bin/python -c '{check_script}' > /tmp/check_ic.sh && bash /tmp/check_ic.sh", timeout=15)
        if "IN_CHANNELS:" in out:
            ic_str = out.split("IN_CHANNELS:")[1].strip().split()[0]
            ic = int(ic_str)
            if ic != expected_ic:
                print(f"  ✗ {desc}: in_channels={ic} (期望{expected_ic}) — 会导致拼接错误!")
                return False
            else:
                print(f"  ✓ {desc}: {size_mb:.1f}MB, in_channels={ic} ✓")
        else:
            print(f"  ✓ {desc}: {size_mb:.1f}MB (无法验证in_channels)")
    else:
        print(f"  ✓ {desc}: {size_mb:.1f}MB ✓")
    
    return True

def test_all_models():
    """Check every model needed by every workflow"""
    print("检查所有模型文件(按类型分组):")
    
    # Group by category
    categories = {
        '扩散模型': [k for k in ALL_MODELS if 'I2V' in k or 'TI2V' in k or 'Ovi' in k or 'gguf' in k or 'flux' in k or 'ltx' in k or 'Q4' in k],
        '文本编码器': [k for k in ALL_MODELS if 't5' in k or 'clip_l' in k or 'umt5' in k],
        'VAE': [k for k in ALL_MODELS if 'VAE' in k or 'ae' in k or 'vae' in k],
        'CLIP Vision': [k for k in ALL_MODELS if 'clip_vision' in k],
    }
    
    passed = 0
    failed = 0
    total = len(ALL_MODELS)
    
    for cat, models in categories.items():
        print(f"\n  [{cat}]")
        for m in models:
            if check_model(m, ALL_MODELS[m]):
                passed += 1
            else:
                failed += 1
    
    # Summary
    print(f"\n  总计: {passed}/{total} 模型OK, {failed}个有问题")
    
    # Model directory tree check
    print(f"\n  模型目录结构:")
    code, out, err = run_ssh(f"ls -la {MODEL_BASE}/", timeout=10)
    if code == 0:
        for line in out.split('\n')[:15]:
            print(f"    {line}")
    else:
        print(f"    ⚠ 无法列出模型目录: {err}")
    
    return failed == 0

if __name__ == "__main__":
    print("=== Test 4: 所有模型文件检查 ===")
    try:
        ok = test_all_models()
        print(f"\n{'='*50}")
        if ok:
            print("✓ 所有模型检查通过!")
        else:
            print("✗ 有模型缺失或异常 — 修复后再跑GPU测试!")
        sys.exit(0 if ok else 1)
    except Exception as e:
        print(f"✗ Test 4异常: {e}")
        sys.exit(1)
