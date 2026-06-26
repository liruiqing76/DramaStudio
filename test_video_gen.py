#!/usr/bin/env python3
"""
LocalMiniDrama 视频生成测试脚本
用法: python test_video_gen.py [--ssh-pass PASSWORD] [--ssh-port PORT] [--ssh-host HOST] [--ssh-user USER]
"""

import json, urllib.request, subprocess, re, time, sys, os, argparse

# 默认参数
DEFAULT_SSH_HOST = "connect.westc.seetacloud.com"
DEFAULT_SSH_PORT = "24427"
DEFAULT_SSH_USER = "root"
DEFAULT_SSH_PASS = "yLbkrnv5GMz5"

def parse_args():
    p = argparse.ArgumentParser(description="测试 LocalMiniDrama 远程 ComfyUI 视频生成")
    p.add_argument("--ssh-pass", default=DEFAULT_SSH_PASS)
    p.add_argument("--ssh-port", default=DEFAULT_SSH_PORT)
    p.add_argument("--ssh-host", default=DEFAULT_SSH_HOST)
    p.add_argument("--ssh-user", default=DEFAULT_SSH_USER)
    p.add_argument("--prompt", default="A young woman in red hanfu walking gracefully in a Chinese courtyard, soft sunlight, cinematic")
    p.add_argument("--steps", type=int, default=20)
    p.add_argument("--frames", type=int, default=33)
    p.add_argument("--width", type=int, default=720)
    p.add_argument("--height", type=int, default=1280)
    p.add_argument("--model", default="Wan2.2-I2V-A14B-LowNoise-Q4_K_M.gguf")
    return p.parse_args()

def ssh_run(args, cmd):
    full_cmd = [
        "sshpass", "-p", args.ssh_pass,
        "ssh", "-o", "StrictHostKeyChecking=no",
        "-p", args.ssh_port,
        f"{args.ssh_user}@{args.ssh_host}",
        cmd
    ]
    return subprocess.run(full_cmd, capture_output=True, text=True, timeout=30)

def ssh_tail(args, lines=5):
    """Get last N lines of ComfyUI log"""
    result = ssh_run(args, 'export PATH="/root/autodl-tmp/miniconda3/bin:$PATH" && tail -20 /tmp/comfyui_new.log')
    return result.stdout

def check_output(args, prompt_id):
    """Check if generation is done"""
    try:
        url = f"http://localhost:18188/history/{prompt_id}"
        resp = urllib.request.urlopen(url, timeout=5)
        data = json.loads(resp.read())
        r = data.get(prompt_id, {})
        out = r.get("outputs", {})
        if out:
            for nid, no in out.items():
                for v in no.get("videos", []):
                    view_url = f'http://localhost:18188/view?filename={v["filename"]}&type={v.get("type","output")}'
                    return ("done", v["filename"], view_url)
                for img in no.get("images", []):
                    if img["filename"].endswith((".mp4",".webm",".mov",".avi")):
                        view_url = f'http://localhost:18188/view?filename={img["filename"]}&type={img.get("type","output")}'
                        return ("done", img["filename"], view_url)
        # Check for errors
        msgs = r.get("status", {}).get("messages", [])
        for m in msgs:
            if "error" in m[0]:
                return ("error", m[1].get("exception_message", "Unknown error"), "")
        # Check queue
        q = json.loads(urllib.request.urlopen("http://localhost:18188/queue", timeout=5).read())
        if len(q.get("queue_running", [])) == 0 and len(q.get("queue_pending", [])) == 0:
            return ("idle", "", "")
        return ("running", "", "")
    except Exception as e:
        return ("check_error", str(e), "")

def parse_progress(log_text):
    """Extract progress from ComfyUI log"""
    # Look for progress bar like: " 70%|███████   | 14/20 [08:12<03:31, 35.23s/it]"
    pattern = r'(\d+)%[|].*?(\d+)/(\d+)\s+\[(\d+:\d+)<'
    matches = re.findall(pattern, log_text)
    if matches:
        pct, step, total, elapsed = matches[-1]
        return int(step), int(total), int(pct), elapsed
    return None, None, None, None

def main():
    args = parse_args()
    
    # Step 1: 测试 SSH 连接
    print("🔌 测试 SSH 连接...")
    r = ssh_run(args, "echo OK")
    if r.returncode != 0:
        print(f"❌ SSH 连接失败: {r.stderr}")
        return
    print("✅ SSH 连接成功")
    
    # Step 2: 测试 ComfyUI API
    print("🖥️ 测试 ComfyUI API...")
    try:
        resp = urllib.request.urlopen("http://localhost:18188/object_info", timeout=10)
        data = json.loads(resp.read())
        print(f"✅ ComfyUI 正常 (可用节点: {len(data)})")
    except Exception as e:
        print(f"❌ ComfyUI API 失败: {e}")
        print("  请确保 SSH 隧道已建立: localhost:18188 → 远程 :8188")
        return
    
    # Step 3: 提交工作流
    print(f"\n🎬 提交视频生成任务...")
    print(f"   模型: {args.model}")
    print(f"   分辨率: {args.width}x{args.height}")
    print(f"   帧数: {args.frames}")
    print(f"   步数: {args.steps}")
    print(f"   提示词: {args.prompt[:50]}...")
    
    workflow = {
        "1": {"class_type": "UnetLoaderGGUF", "inputs": {"unet_name": args.model}},
        "2": {"class_type": "CLIPLoader", "inputs": {"clip_name": "umt5_xxl_fp8_e4m3fn_scaled.safetensors", "type": "wan"}},
        "3": {"class_type": "CLIPTextEncode", "inputs": {"text": args.prompt, "clip": ["2", 0]}},
        "4": {"class_type": "CLIPTextEncode", "inputs": {"text": "low quality, blurry, distorted, watermark", "clip": ["2", 0]}},
        "5": {"class_type": "VAELoader", "inputs": {"vae_name": "Wan2_2_VAE_bf16.safetensors"}},
        "6": {"class_type": "EmptyHunyuanLatentVideo", "inputs": {"width": args.width, "height": args.height, "length": args.frames, "batch_size": 1}},
        "7": {"class_type": "KSampler", "inputs": {"seed": 42, "steps": args.steps, "cfg": 5.0, "sampler_name": "euler", "scheduler": "normal", "denoise": 1.0, "model": ["1", 0], "positive": ["3", 0], "negative": ["4", 0], "latent_image": ["6", 0]}},
        "8": {"class_type": "VAEDecode", "inputs": {"samples": ["7", 0], "vae": ["5", 0]}},
        "9": {"class_type": "CreateVideo", "inputs": {"images": ["8", 0], "fps": 25}},
        "10": {"class_type": "SaveVideo", "inputs": {"video": ["9", 0], "filename_prefix": "minidrama_test", "format": "mp4", "codec": "h264"}}
    }
    
    body = json.dumps({"prompt": workflow}).encode()
    req = urllib.request.Request("http://localhost:18188/prompt", data=body,
                                headers={"Content-Type": "application/json"}, method="POST")
    try:
        resp = urllib.request.urlopen(req, timeout=30)
        result = json.loads(resp.read())
        prompt_id = result.get("prompt_id", "")
        print(f"✅ 任务已提交 (ID: {prompt_id})")
    except Exception as e:
        print(f"❌ 提交失败: {e}")
        return
    
    # Step 4: 监控进度
    print(f"\n⏳ 监控生成进度 (每15秒检查一次)...")
    print(f"   {'时间':>8} | {'进度':>8} | {'状态'}")
    print(f"   {'-'*8}-+-{'-'*8}-+-{'-'*20}")
    
    last_progress = 0
    stale_count = 0
    start_time = time.time()
    
    while True:
        elapsed = int(time.time() - start_time)
        status, detail, url = check_output(args, prompt_id)
        
        if status == "done":
            print(f"\n✅ 视频生成完成！")
            print(f"   文件名: {detail}")
            print(f"   下载: {url}")
            print(f"   总耗时: {elapsed//60}分{elapsed%60}秒")
            break
        
        if status == "error":
            print(f"\n❌ 生成失败: {detail}")
            break
        
        # 从日志解析进度
        log = ssh_tail(args)
        step, total, pct, etime = parse_progress(log)
        
        if pct and pct != last_progress:
            print(f"   {etime:>8} | {pct:>3}% ({step}/{total}) | 生成中...")
            last_progress = pct
            stale_count = 0
        elif stale_count < 4:
            print(f"   {elapsed//60:>2}:{elapsed%60:>02}分  | {'':>8} | 等待中(step:{step or '?'}/{total or '?'})")
            stale_count += 1
        
        if elapsed > 600:  # 10分钟超时
            print(f"\n⏰ 超时 (10分钟)")
            break
        
        time.sleep(15)

if __name__ == "__main__":
    main()
