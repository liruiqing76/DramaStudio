#!/usr/bin/env python3
"""
Complete Wan2.2 GGUF T2V Test Suite - Submit, Monitor, Report
Runs all tests and writes results to /tmp/test_results.log
"""
import urllib.request, urllib.error, json, time, os, sys
from datetime import datetime

BASE = "http://127.0.0.1:8188"
LOG_FILE = "/tmp/test_results.log"

def log(msg):
    ts = datetime.now().strftime("%H:%M:%S")
    line = f"[{ts}] {msg}"
    print(line)
    with open(LOG_FILE, "a") as f:
        f.write(line + "\n")

def api_get(path):
    with urllib.request.urlopen(f"{BASE}{path}") as r:
        return json.loads(r.read())

def api_post(path, data):
    body = json.dumps(data).encode()
    req = urllib.request.Request(f"{BASE}{path}", data=body, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        err = e.read().decode()[:1000]
        log(f"HTTP {e.code}: {err}")
        return None

def build_workflow(positive, negative, width, height, frames, steps, model, prefix):
    return {
        "1": {"inputs": {"clip_name": "umt5_xxl_enc-bf16.pth", "type": "wan"}, "class_type": "CLIPLoaderGGUF"},
        "2": {"inputs": {"unet_name": model}, "class_type": "UnetLoaderGGUF"},
        "3": {"inputs": {"text": positive, "clip": ["1", 0]}, "class_type": "CLIPTextEncode"},
        "4": {"inputs": {"text": negative, "clip": ["1", 0]}, "class_type": "CLIPTextEncode"},
        "5": {"inputs": {"width": width, "height": height, "length": frames, "batch_size": 1}, "class_type": "EmptyHunyuanLatentVideo"},
        "6": {"inputs": {"model": ["2", 0], "positive": ["3", 0], "negative": ["4", 0], "latent_image": ["5", 0], "seed": 42, "steps": steps, "cfg": 5.0, "sampler_name": "euler", "scheduler": "normal", "denoise": 1.0}, "class_type": "KSampler"},
        "7": {"inputs": {"vae_name": "wan_2.1_vae.safetensors"}, "class_type": "VAELoader"},
        "8": {"inputs": {"samples": ["6", 0], "vae": ["7", 0]}, "class_type": "VAEDecode"},
        "9": {"inputs": {"images": ["8", 0], "filename_prefix": prefix, "fps": 16, "method": "default", "quality": 80, "lossless": False}, "class_type": "SaveAnimatedWEBP"}
    }

def wait_for_completion(prompt_id, max_wait=1800):
    start = time.time()
    last_status = ""
    while time.time() - start < max_wait:
        try:
            history = api_get(f"/history/{prompt_id}")
        except:
            time.sleep(10)
            continue
        if prompt_id in history:
            h = history[prompt_id]
            if h.get("status", {}).get("completed", False):
                elapsed = time.time() - start
                outputs = h.get("outputs", {})
                files = []
                for nid, no in outputs.items():
                    for img in no.get("images", []):
                        fname = img.get("filename", "?")
                        fpath = f"/root/ComfyUI/output/{img.get('subfolder', '')}/{fname}"
                        sz = os.path.getsize(fpath)/1024 if os.path.exists(fpath) else -1
                        files.append((fname, sz, os.path.exists(fpath)))
                return True, elapsed, files
            status_str = h.get("status_str", "")
            if status_str != last_status:
                elapsed = time.time() - start
                log(f"  [{elapsed:.0f}s] {status_str}")
                last_status = status_str
        time.sleep(10)
    return False, max_wait, []

# === MAIN ===
with open(LOG_FILE, "w") as f:
    f.write(f"=== Wan2.2 GGUF T2V Test Suite ===\nStarted: {datetime.now()}\n\n")

log("="*60)
log("Wan2.2 GGUF T2V Test Suite")
log("="*60)

# Verify ComfyUI
try:
    api_get("/system_stats")
    log("ComfyUI: OK")
except:
    log("FATAL: ComfyUI not accessible")
    sys.exit(1)

tests = [
    {"name": "Test1: HighNoise 640x640 81f 20steps", "positive": "A beautiful sunset over a calm ocean, golden light reflecting on gentle waves, cinematic, 4K, smooth motion", "negative": "worst quality, low quality, blurry, distorted, jittery, artifacts", "w": 640, "h": 640, "f": 81, "s": 20, "model": "GGUF/Wan2.2-T2V-HighNoise-Q4_K_M.gguf", "prefix": "test1_hn_640x640_81f"},
    {"name": "Test2: LowNoise 640x640 81f 20steps", "positive": "A cute cat walking through a sunlit garden full of colorful flowers, gentle breeze, warm golden hour lighting, cinematic", "negative": "worst quality, low quality, blurry, distorted, jittery, ugly, artifacts", "w": 640, "h": 640, "f": 81, "s": 20, "model": "GGUF/Wan2.2-T2V-LowNoise-Q4_K_M.gguf", "prefix": "test2_ln_640x640_81f"},
    {"name": "Test3: HighNoise 512x512 49f 15steps", "positive": "An astronaut riding a horse on Mars, red desert landscape, cinematic lighting, dramatic shadows, smooth motion", "negative": "worst quality, low quality, blurry, distorted, artifacts", "w": 512, "h": 512, "f": 49, "s": 15, "model": "GGUF/Wan2.2-T2V-HighNoise-Q4_K_M.gguf", "prefix": "test3_hn_512x512_49f"},
    {"name": "Test4: LowNoise 768x432 33f 10steps FAST", "positive": "Cherry blossoms falling in a Japanese garden, pink petals dancing in gentle wind, peaceful atmosphere", "negative": "worst quality, low quality, blurry, distorted, jittery", "w": 768, "h": 432, "f": 33, "s": 10, "model": "GGUF/Wan2.2-T2V-LowNoise-Q4_K_M.gguf", "prefix": "test4_ln_768x432_33f"},
    {"name": "Test5: HighNoise 640x360 49f 15steps", "positive": "A futuristic city skyline at night with neon lights, flying cars, rain-slicked streets, blade runner style", "negative": "worst quality, low quality, blurry, distorted, jittery, artifacts", "w": 640, "h": 360, "f": 49, "s": 15, "model": "GGUF/Wan2.2-T2V-HighNoise-Q4_K_M.gguf", "prefix": "test5_hn_640x360_49f"},
    {"name": "Test6: LowNoise 640x640 33f 10steps FAST", "positive": "A steaming cup of coffee on a wooden table, morning sunlight streaming through window, cozy atmosphere", "negative": "worst quality, low quality, blurry, distorted", "w": 640, "h": 640, "f": 33, "s": 10, "model": "GGUF/Wan2.2-T2V-LowNoise-Q4_K_M.gguf", "prefix": "test6_ln_640x640_33f"},
]

results = []
for i, t in enumerate(tests):
    log(f"\n{'#'*60}")
    log(f"#{i+1}/{len(tests)}: {t['name']}")
    log(f"{'#'*60}")
    
    wf = build_workflow(t["positive"], t["negative"], t["w"], t["h"], t["f"], t["s"], t["model"], t["prefix"])
    
    log("  Submitting...")
    result = api_post("/prompt", {"prompt": wf})
    
    if result is None:
        log(f"  FAILED: No response")
        results.append({"test": t["name"], "status": "FAILED"})
        continue
    
    errs = result.get("node_errors", {})
    if errs:
        log(f"  VALIDATION FAILED: {json.dumps(errs)[:500]}")
        results.append({"test": t["name"], "status": "VALIDATION_FAILED"})
        continue
    
    pid = result.get("prompt_id")
    log(f"  Prompt ID: {pid}")
    log(f"  Waiting for completion (max 30min)...")
    
    ok, elapsed, files = wait_for_completion(pid)
    
    if ok:
        log(f"  COMPLETED in {elapsed:.0f}s!")
        for fname, sz, exists in files:
            if exists:
                log(f"    Output: {fname} ({sz:.1f} KB)")
            else:
                log(f"    Output: {fname} (missing!)")
        results.append({"test": t["name"], "status": "PASSED", "time": elapsed})
    else:
        log(f"  TIMEOUT after {elapsed}s")
        results.append({"test": t["name"], "status": "TIMEOUT"})
    
    log("  Cooling 5s...")
    time.sleep(5)

# Final report
log(f"\n{'='*60}")
log("FINAL REPORT")
log(f"{'='*60}")
passed = 0
for r in results:
    icon = "PASS" if r["status"] == "PASSED" else "FAIL"
    log(f"  [{icon}] {r['test']}: {r['status']}")
    if "time" in r:
        log(f"         Time: {r['time']:.0f}s")
    if r["status"] == "PASSED":
        passed += 1
log(f"\n  Total: {passed}/{len(results)} passed")
log(f"  Finished: {datetime.now()}")
log("="*60)
