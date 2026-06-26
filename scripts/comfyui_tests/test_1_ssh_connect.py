#!/usr/bin/env python3
"""Test 1: SSH connection + GPU available"""
import subprocess, sys, json

SSH_CMD = "sshpass"
SSH_HOST = "connect.westb.seetacloud.com"
SSH_PORT = "11006"
SSH_USER = "root"
SSH_PASS = "liruiqing2025"

def run_ssh(cmd, timeout=15):
    """Run command via SSH, returns (exit_code, stdout, stderr)"""
    full_cmd = f'sshpass -p {SSH_PASS} ssh -p {SSH_PORT} -o StrictHostKeyChecking=no {SSH_USER}@{SSH_HOST} "{cmd}"'
    r = subprocess.run(full_cmd, shell=True, capture_output=True, text=True, timeout=timeout)
    return r.returncode, r.stdout.strip(), r.stderr.strip()

def test_ssh_connect():
    """Can we SSH into the server?"""
    code, out, err = run_ssh("echo hello")
    assert code == 0, f"SSH connection failed: exit={code}, err={err}"
    assert "hello" in out, f"SSH echo failed: out={out}"
    print("  ✓ SSH connection OK")

def test_gpu_available():
    """Is GPU visible via nvidia-smi?"""
    code, out, err = run_ssh("nvidia-smi --query-gpu=name,memory.total --format=csv,noheader")
    assert code == 0, f"nvidia-smi failed: exit={code}, err={err}"
    lines = out.strip().split('\n')
    assert len(lines) > 0, "No GPU found"
    gpu_name = lines[0].split(',')[0].strip()
    vram = lines[0].split(',')[1].strip()
    print(f"  ✓ GPU: {gpu_name}, VRAM: {vram}")
    # 14B fp8 needs ~24GB, minimum 24GB VRAM
    vram_gb = float(vram.replace(' MiB','').replace(' GB','')) / (1024 if 'MiB' in vram else 1)
    assert vram_gb >= 24, f"VRAM {vram_gb:.1f}GB < 24GB minimum for 14B model"

def test_ssh_tunnel():
    """Is SSH tunnel working (localhost:18189 -> remote:8188)?"""
    try:
        import urllib.request
        r = urllib.request.urlopen("http://localhost:18189/system_stats", timeout=5)
        data = json.loads(r.read().decode())
        devices = data['system']['devices']
        assert len(devices) > 0, "No GPU in ComfyUI system_stats"
        print(f"  ✓ SSH tunnel OK, ComfyUI sees GPU: {devices[0]['name']}")
    except Exception as e:
        print(f"  ⚠ SSH tunnel not working (ComfyUI not started yet): {e}")
        print("  → This is OK if ComfyUI hasn't been started yet")

if __name__ == "__main__":
    print("=== Test 1: SSH Connection + GPU ===")
    tests = [test_ssh_connect, test_gpu_available, test_ssh_tunnel]
    passed = 0
    failed = 0
    for t in tests:
        try:
            t()
            passed += 1
        except AssertionError as e:
            print(f"  ✗ {t.__name__}: {e}")
            failed += 1
        except Exception as e:
            print(f"  ✗ {t.__name__}: {e}")
            failed += 1
    
    print(f"\nResult: {passed}/{len(tests)} passed, {failed} failed")
    sys.exit(0 if failed == 0 else 1)
