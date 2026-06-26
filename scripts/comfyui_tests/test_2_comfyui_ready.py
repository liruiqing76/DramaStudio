#!/usr/bin/env python3
"""Test 2: ComfyUI ready — API responds, custom nodes loaded, model dirs exist"""
import subprocess, sys, json, urllib.request

SSH_CMD_PREFIX = "sshpass -p liruiqing2025 ssh -p 11006 -o StrictHostKeyChecking=no root@connect.westb.seetacloud.com"
COMFYUI_URL = "http://localhost:18189"

def run_ssh(cmd, timeout=15):
    full_cmd = f'{SSH_CMD_PREFIX} "{cmd}"'
    r = subprocess.run(full_cmd, shell=True, capture_output=True, text=True, timeout=timeout)
    return r.returncode, r.stdout.strip(), r.stderr.strip()

def test_comfyui_api():
    """ComfyUI /system_stats API responds"""
    try:
        r = urllib.request.urlopen(f"{COMFYUI_URL}/system_stats", timeout=10)
        data = json.loads(r.read().decode())
        assert 'system' in data, "No 'system' key in response"
        print(f"  ✓ ComfyUI API OK, version: {data['system'].get('comfyui_version','?')}")
    except Exception as e:
        print(f"  ✗ ComfyUI API not reachable: {e}")
        raise

def test_comfyui_process_running():
    """Is ComfyUI process running on server?"""
    code, out, err = run_ssh("ps aux | grep 'python.*main.py' | grep -v grep | wc -l")
    count = int(out.strip()) if out.strip() else 0
    assert count >= 1, f"No ComfyUI process running (count={count})"
    # Also check no zombie processes
    assert count <= 2, f"Too many ComfyUI processes ({count}), likely zombies"
    print(f"  ✓ ComfyUI process running (count={count})")

def test_wanvideo_wrapper_loaded():
    """WanVideoWrapper custom node is loaded and key nodes available"""
    try:
        r = urllib.request.urlopen(f"{COMFYUI_URL}/object_info/WanVideoModelLoader", timeout=10)
        data = json.loads(r.read().decode())
        assert 'WanVideoModelLoader' in data, "WanVideoModelLoader node not found"
        print("  ✓ WanVideoWrapper nodes loaded")
    except Exception as e:
        print(f"  ✗ WanVideoWrapper not loaded: {e}")
        raise

def test_model_dirs_exist():
    """All required model directories exist on server"""
    required_dirs = [
        "/root/autodl-tmp/comfyui_models/checkpoints",
        "/root/autodl-tmp/comfyui_models/vae",
        "/root/autodl-tmp/comfyui_models/clip_vision",
        "/root/autodl-tmp/comfyui_models/text_encoders",
    ]
    for d in required_dirs:
        code, out, err = run_ssh(f"test -d {d} && echo YES || echo NO")
        assert "YES" in out, f"Directory missing: {d}"
        print(f"  ✓ {d} exists")

def test_comfyui_no_core_patches():
    """Verify ComfyUI core code is NOT patched (latent_formats=48, nodes_wan original)"""
    # Check latent_formats.py has latent_channels=48 for Wan22
    code, out, err = run_ssh("grep -n 'latent_channels = 48' /root/autodl-tmp/ComfyUI/comfy/latent_formats.py | head -3")
    assert code == 0 and out.strip(), f"latent_formats.py NOT restored to 48! Got: {out}"
    print(f"  ✓ latent_formats.py: Wan22 latent_channels=48 (original)")
    
    # Check nodes_wan.py has NO hardcoded latent_channels=36
    code, out, err = run_ssh("grep -n 'latent_channels = 36' /root/autodl-tmp/ComfyUI/comfy_extras/nodes_wan.py")
    assert code != 0 or not out.strip(), f"nodes_wan.py STILL has hardcoded 36! Lines: {out}"
    print(f"  ✓ nodes_wan.py: no hardcoded latent_channels=36 (original)")

if __name__ == "__main__":
    print("=== Test 2: ComfyUI Ready ===")
    tests = [test_comfyui_api, test_comfyui_process_running, 
             test_wanvideo_wrapper_loaded, test_model_dirs_exist, 
             test_comfyui_no_core_patches]
    passed = 0
    failed = 0
    for t in tests:
        try:
            t()
            passed += 1
        except (AssertionError, Exception) as e:
            print(f"  ✗ {t.__name__}: {e}")
            failed += 1
    
    print(f"\nResult: {passed}/{len(tests)} passed, {failed} failed")
    sys.exit(0 if failed == 0 else 1)
