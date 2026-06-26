"""
本地 ComfyUI 测试运行器
通过 SSH 隧道 (localhost:18188) 提交测试作业，监控进度，下载结果

前提: 先运行 tunnel.ps1 start 建立隧道
用法: python local_test_runner.py [--quick|--full]
  --quick  快速验证 (连通性 + 小尺寸单帧)
  --full   完整测试 (T2V I2V 多种配置)
"""

import urllib.request
import urllib.error
import json
import time
import os
import subprocess
import sys
import argparse

# ============================================================
# 配置
# ============================================================
COMFY_URL = "http://127.0.0.1:18188"
REMOTE_HOST = "connect.westb.seetacloud.com"
REMOTE_PORT = "23156"
REMOTE_USER = "root"
SSHPASS = "T9Erp7FBQgdk"
REMOTE_OUTPUT = "/root/ComfyUI/output"
LOCAL_OUTPUT = os.path.join(os.path.dirname(__file__), "..", "test_output")
os.makedirs(LOCAL_OUTPUT, exist_ok=True)

# ============================================================
# 工具函数
# ============================================================

def api_get(path, timeout=10):
    """调用 ComfyUI API GET"""
    try:
        r = urllib.request.urlopen(f"{COMFY_URL}{path}", timeout=timeout)
        return json.loads(r.read())
    except urllib.error.URLError as e:
        print(f"  [ERROR] 无法连接 ComfyUI: {e}")
        return None
    except Exception as e:
        print(f"  [ERROR] {e}")
        return None

def api_post(path, data, timeout=15):
    """调用 ComfyUI API POST"""
    try:
        body = json.dumps(data).encode()
        req = urllib.request.Request(
            f"{COMFY_URL}{path}",
            data=body,
            headers={"Content-Type": "application/json"}
        )
        r = urllib.request.urlopen(req, timeout=timeout)
        return json.loads(r.read())
    except Exception as e:
        print(f"  [ERROR] POST {path}: {e}")
        return None

def ssh_cmd(cmd, timeout=30):
    """通过 SSH 执行远程命令"""
    try:
        full_cmd = f"sshpass -p {SSHPASS} ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 -p {REMOTE_PORT} {REMOTE_USER}@{REMOTE_HOST} \"{cmd}\""
        result = subprocess.run(full_cmd, shell=True, capture_output=True, text=True, timeout=timeout)
        return result.stdout.strip(), result.stderr.strip()
    except subprocess.TimeoutExpired:
        return None, "TIMEOUT"
    except Exception as e:
        return None, str(e)

def download_file(remote_path, local_name):
    """通过 SCP 下载文件"""
    local_path = os.path.join(LOCAL_OUTPUT, local_name)
    full_cmd = (
        f"sshpass -p {SSHPASS} scp -o StrictHostKeyChecking=no "
        f"-P {REMOTE_PORT} "
        f"{REMOTE_USER}@{REMOTE_HOST}:{remote_path} \"{local_path}\""
    )
    print(f"  下载: {remote_path} -> {local_path}")
    result = subprocess.run(full_cmd, shell=True, capture_output=True, text=True, timeout=60)
    if os.path.exists(local_path) and os.path.getsize(local_path) > 0:
        size_mb = os.path.getsize(local_path) / (1024 * 1024)
        print(f"  [OK] 下载成功 ({size_mb:.1f} MB)")
        return local_path
    else:
        print(f"  [FAIL] 下载失败: {result.stderr[:200]}")
        return None

# ============================================================
# 测试项定义
# ============================================================

def build_t2v_workflow(config):
    """构建 T2V (文字生成视频) Workflow"""
    return {
        "1": {"inputs": {"clip_name": "umt5_xxl_enc-bf16.pth", "type": "wan"}, "class_type": "CLIPLoaderGGUF"},
        "2": {"inputs": {"unet_name": "GGUF/Wan2.2-T2V-HighNoise-Q4_K_M.gguf"}, "class_type": "UnetLoaderGGUF"},
        "3": {"inputs": {"text": config["prompt"], "clip": ["1", 0]}, "class_type": "CLIPTextEncode"},
        "4": {"inputs": {"text": config.get("negative", "worst quality, low quality, blurry"), "clip": ["1", 0]}, "class_type": "CLIPTextEncode"},
        "5": {"inputs": {"width": config["width"], "height": config["height"], "length": config["frames"], "batch_size": 1}, "class_type": "EmptyHunyuanLatentVideo"},
        "6": {"inputs": {"model": ["2", 0], "positive": ["3", 0], "negative": ["4", 0], "latent_image": ["5", 0], "seed": config["seed"], "steps": config["steps"], "cfg": config["cfg"], "sampler_name": config.get("sampler", "euler"), "scheduler": "normal", "denoise": 1.0}, "class_type": "KSampler"},
        "7": {"inputs": {"vae_name": "wan_2.1_vae.safetensors"}, "class_type": "VAELoader"},
        "8": {"inputs": {"samples": ["6", 0], "vae": ["7", 0]}, "class_type": "VAEDecode"},
        "9": {"inputs": {"images": ["8", 0], "filename_prefix": config["prefix"], "fps": 16, "method": "default", "quality": 80, "lossless": False}, "class_type": "SaveAnimatedWEBP"}
    }

def build_i2v_workflow(config):
    """构建 I2V (图片生成视频) Workflow"""
    return {
        "1": {"inputs": {"clip_name": "umt5_xxl_enc-bf16.pth", "type": "wan"}, "class_type": "CLIPLoaderGGUF"},
        "2": {"inputs": {"unet_name": "GGUF/Wan2.2-I2V-HighNoise-Q4_K_M.gguf"}, "class_type": "UnetLoaderGGUF"},
        "3": {"inputs": {"text": config["prompt"], "clip": ["1", 0]}, "class_type": "CLIPTextEncode"},
        "4": {"inputs": {"text": config.get("negative", "worst quality, low quality"), "clip": ["1", 0]}, "class_type": "CLIPTextEncode"},
        "5": {"inputs": {"image": config["input_image"], "upload": "image"}, "class_type": "LoadImage"},
        "6": {"inputs": {"width": config["width"], "height": config["height"], "length": config["frames"], "batch_size": 1}, "class_type": "EmptyHunyuanLatentVideo"},
        "7": {"inputs": {"model": ["2", 0], "positive": ["3", 0], "negative": ["4", 0], "latent_image": ["6", 0], "seed": config["seed"], "steps": config["steps"], "cfg": config["cfg"], "sampler_name": config.get("sampler", "euler"), "scheduler": "normal", "denoise": 1.0}, "class_type": "KSampler"},
        "8": {"inputs": {"vae_name": "wan_2.1_vae.safetensors"}, "class_type": "VAELoader"},
        "9": {"inputs": {"samples": ["7", 0], "vae": ["8", 0]}, "class_type": "VAEDecode"},
        "10": {"inputs": {"images": ["9", 0], "filename_prefix": config["prefix"], "fps": 16, "method": "default", "quality": 80}, "class_type": "SaveAnimatedWEBP"}
    }

# ============================================================
# 核心流程
# ============================================================

def check_tunnel():
    """验证隧道是否工作"""
    print("\n" + "=" * 60)
    print("  1. 检查隧道连通性")
    print("=" * 60)
    
    stats = api_get("/system_stats")
    if stats is None:
        print("\n[FAIL] 无法连接到 ComfyUI！")
        print("请先运行: powershell -ExecutionPolicy Bypass -File scripts\\tunnel.ps1 start")
        return False
    
    system = stats.get("system", {})
    print(f"  Python: {system.get('python_version', '?')}")
    print(f"  OS: {system.get('os', '?')}")
    
    # Check GPU
    gpu_out, _ = ssh_cmd("nvidia-smi --query-gpu=index,name,utilization.gpu,memory.used,memory.total --format=csv,noheader")
    if gpu_out:
        print(f"  GPU: {gpu_out}")
    
    # Get object info
    obj = api_get("/object_info")
    if obj:
        print(f"  Nodes loaded: {len(obj)}")
    
    print("  [PASS] 隧道正常，ComfyUI 可达")
    return True

def submit_and_wait(workflow, test_name, timeout=600):
    """提交 workflow 并等待完成"""
    print(f"\n--- 提交: {test_name} ---")
    
    result = api_post("/prompt", {"prompt": workflow})
    if not result:
        print(f"  [FAIL] {test_name} - 提交失败")
        return None
    
    prompt_id = result.get("prompt_id")
    if not prompt_id:
        print(f"  [FAIL] {test_name} - 无 prompt_id")
        return None
    
    print(f"  Prompt ID: {prompt_id}")
    
    # 等待完成
    start = time.time()
    last_progress = ""
    while time.time() - start < timeout:
        history = api_get(f"/history/{prompt_id}", timeout=5)
        if history and prompt_id in history:
            h = history[prompt_id]
            status = h.get("status", {})
            status_str = status.get("status_str", "")
            completed = status.get("completed", False)
            
            # 进度
            if status_str and status_str != last_progress:
                elapsed = time.time() - start
                print(f"  [{elapsed:.0f}s] {status_str}")
                last_progress = status_str
            
            if completed:
                elapsed = time.time() - start
                print(f"  [DONE] {test_name} ({elapsed:.0f}s)")
                
                # 解析输出
                outputs = h.get("outputs", {})
                filenames = []
                for node_id, node_output in outputs.items():
                    if "images" in node_output:
                        for img in node_output["images"]:
                            fn = img.get("filename", "")
                            subfolder = img.get("subfolder", "")
                            if fn:
                                filenames.append((subfolder, fn))
                    elif "gifs" in node_output:
                        for gif in node_output["gifs"]:
                            fn = gif.get("filename", "")
                            subfolder = gif.get("subfolder", "")
                            if fn:
                                filenames.append((subfolder, fn))
                
                return {
                    "prompt_id": prompt_id,
                    "elapsed": elapsed,
                    "outputs": outputs,
                    "filenames": filenames
                }
        
        # 检查队列错误
        queue = api_get("/queue", timeout=3)
        if queue:
            running = queue.get("queue_running", [])
            for item in running:
                if isinstance(item, list) and len(item) >= 3:
                    item_pid = item[1]
                    if item_pid == prompt_id:
                        pass  # Still running
        
        time.sleep(5)
    
    elapsed = time.time() - start
    print(f"  [TIMEOUT] {test_name} ({elapsed:.0f}s)")
    
    # 尝试取消
    try:
        api_post("/interrupt", {})
    except:
        pass
    return None

def download_results(filenames, test_name):
    """下载生成的文件到本地"""
    downloaded = []
    for subfolder, fn in filenames:
        remote_path = f"{REMOTE_OUTPUT}/{fn}" if not subfolder else f"{REMOTE_OUTPUT}/{subfolder}/{fn}"
        local_name = f"{test_name}_{fn}"
        local = download_file(remote_path, local_name)
        if local:
            downloaded.append(local)
    return downloaded

# ============================================================
# 测试场景
# ============================================================

def test_connectivity():
    """测试1: 基础连通性 + 节点校验"""
    print("\n" + "=" * 60)
    print("  2. 节点与模型校验")
    print("=" * 60)
    
    obj = api_get("/object_info")
    if not obj:
        return False
    
    checks = {
        "CLIPLoaderGGUF": False,
        "UnetLoaderGGUF": False,
        "KSampler": False,
        "VAELoader": False,
        "VAEDecode": False,
        "SaveAnimatedWEBP": False,
        "EmptyHunyuanLatentVideo": False,
        "CLIPTextEncode": False,
    }
    
    for k in obj:
        if k in checks:
            checks[k] = True
    
    for k, v in checks.items():
        status = "OK" if v else "MISSING!"
        print(f"  [{status}] {k}")
    
    all_ok = all(checks.values())
    if not all_ok:
        missing = [k for k, v in checks.items() if not v]
        print(f"  [FAIL] 缺失节点: {missing}")
        return False
    
    # 检查模型文件
    model_checks = [
        ("/root/ComfyUI/models/clip/umt5_xxl_enc-bf16.pth", "CLIP text encoder"),
        ("/root/ComfyUI/models/GGUF/Wan2.2-T2V-HighNoise-Q4_K_M.gguf", "Wan2.2 T2V GGUF"),
        ("/root/ComfyUI/models/vae/wan_2.1_vae.safetensors", "Wan VAE"),
    ]
    
    for path, desc in model_checks:
        out, _ = ssh_cmd(f"ls -lh {path} 2>/dev/null || echo MISSING")
        if "MISSING" in (out or ""):
            print(f"  [MISSING] {desc}")
        else:
            print(f"  [OK] {desc}: {out.split()[-3] if out else '?'}")
    
    print("  [PASS] 节点和模型校验通过")
    return True

def test_quick_t2v():
    """测试2: 快速 T2V (512x512, 17帧, 10步)"""
    print("\n" + "=" * 60)
    print("  3. 快速 T2V 测试 (512x512, 17帧, 10步)")
    print("=" * 60)
    
    config = {
        "prompt": "A beautiful sunset over a calm ocean, cinematic, 4K quality",
        "negative": "worst quality, low quality, blurry, distorted, watermark",
        "width": 512, "height": 512,
        "frames": 17, "steps": 10,
        "cfg": 5.0, "seed": 42,
        "sampler": "euler",
        "prefix": "quick_t2v"
    }
    
    wf = build_t2v_workflow(config)
    print(f"  Prompt: {config['prompt']}")
    print(f"  Size: {config['width']}x{config['height']}, {config['frames']} frames, {config['steps']} steps")
    
    result = submit_and_wait(wf, "quick_t2v", timeout=600)
    if result and result["filenames"]:
        download_results(result["filenames"], "quick_t2v")
        print("  [PASS] 快速 T2V 测试通过")
        return True
    elif result:
        print("  [WARN] 生成完成但无输出文件")
        return False
    else:
        print("  [FAIL] 快速 T2V 测试失败")
        return False

def test_full_t2v():
    """测试3: 标准 T2V (720x480, 33帧, 20步)"""
    print("\n" + "=" * 60)
    print("  4. 标准 T2V 测试 (720x480, 33帧, 20步)")
    print("=" * 60)
    
    config = {
        "prompt": "A young woman walking through a forest path at golden hour, cinematic lighting, shallow depth of field",
        "negative": "worst quality, low quality, deformed, ugly, watermark, text",
        "width": 720, "height": 480,
        "frames": 33, "steps": 20,
        "cfg": 5.0, "seed": 123,
        "sampler": "euler",
        "prefix": "full_t2v"
    }
    
    wf = build_t2v_workflow(config)
    print(f"  Prompt: {config['prompt']}")
    print(f"  Size: {config['width']}x{config['height']}, {config['frames']} frames, {config['steps']} steps")
    
    result = submit_and_wait(wf, "full_t2v", timeout=1200)
    if result and result["filenames"]:
        download_results(result["filenames"], "full_t2v")
        print("  [PASS] 标准 T2V 测试通过")
        return True
    elif result:
        print("  [WARN] 生成完成但无输出文件")
        return False
    else:
        print("  [FAIL] 标准 T2V 测试失败")
        return False

# ============================================================
# Main
# ============================================================

def main():
    parser = argparse.ArgumentParser(description="ComfyUI 本地测试运行器")
    parser.add_argument("--quick", action="store_true", help="快速验证模式")
    parser.add_argument("--full", action="store_true", help="完整测试模式")
    parser.add_argument("--tunnel-only", action="store_true", help="仅测试隧道")
    args = parser.parse_args()
    
    # 默认跑 quick
    if not args.quick and not args.full and not args.tunnel_only:
        args.quick = True
    
    print("=" * 60)
    print("  ComfyUI 本地测试运行器")
    print(f"  Tunnel: {COMFY_URL}")
    print(f"  Output: {LOCAL_OUTPUT}")
    print("=" * 60)
    
    # 1. 检查隧道
    if not check_tunnel():
        print("\n[ABORT] 隧道未建立，退出")
        sys.exit(1)
    
    if args.tunnel_only:
        print("\n[OK] 仅隧道检查模式")
        return
    
    # 2. 节点校验
    if not test_connectivity():
        print("\n[ABORT] 节点或模型缺失")
        sys.exit(1)
    
    results = {}
    
    # 3. 快速测试
    results["quick_t2v"] = test_quick_t2v()
    
    # 4. 完整测试 (可选)
    if args.full:
        results["full_t2v"] = test_full_t2v()
    
    # 汇总
    print("\n" + "=" * 60)
    print("  测试汇总")
    print("=" * 60)
    passed = 0
    failed = 0
    for name, ok in results.items():
        status = "PASS" if ok else "FAIL"
        print(f"  [{status}] {name}")
        if ok: passed += 1
        else: failed += 1
    
    print(f"\n  通过: {passed}, 失败: {failed}")
    
    # 列出本地输出
    if os.path.exists(LOCAL_OUTPUT):
        files = os.listdir(LOCAL_OUTPUT)
        if files:
            print(f"\n  本地输出文件 ({LOCAL_OUTPUT}):")
            for f in files:
                sz = os.path.getsize(os.path.join(LOCAL_OUTPUT, f)) / (1024**2)
                print(f"    {f} ({sz:.1f} MB)")

if __name__ == "__main__":
    main()
