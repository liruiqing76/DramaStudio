#!/usr/bin/env python3
"""Quick single test to validate the Wan2.2 GGUF T2V workflow structure"""
import urllib.request, urllib.error, json, time, os, sys

BASE = "http://127.0.0.1:8188"

def api_get(path):
    with urllib.request.urlopen(f"{BASE}{path}") as r:
        return json.loads(r.read())

def api_post(path, data):
    body = json.dumps(data).encode()
    req = urllib.request.Request(f"{BASE}{path}", data=body, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        err = e.read().decode()[:1000]
        print(f"  HTTP {e.code}: {err}")
        return None

# Build the workflow
wf = {
    "1": {
        "inputs": {"clip_name": "umt5_xxl_enc-bf16.pth", "type": "wan"},
        "class_type": "CLIPLoaderGGUF"
    },
    "2": {
        "inputs": {"unet_name": "GGUF/Wan2.2-T2V-HighNoise-Q4_K_M.gguf"},
        "class_type": "UnetLoaderGGUF"
    },
    "3": {
        "inputs": {"text": "A beautiful sunset over a calm ocean, cinematic, 4K", "clip": ["1", 0]},
        "class_type": "CLIPTextEncode"
    },
    "4": {
        "inputs": {"text": "worst quality, low quality, blurry, distorted", "clip": ["1", 0]},
        "class_type": "CLIPTextEncode"
    },
    "5": {
        "inputs": {"sampler_name": "euler"},
        "class_type": "KSamplerSelect"
    },
    "6": {
        "inputs": {"width": 512, "height": 512, "length": 33, "batch_size": 1},
        "class_type": "EmptyHunyuanLatentVideo"
    },
    "7": {
        "inputs": {
            "model": ["2", 0], "positive": ["3", 0], "negative": ["4", 0],
            "latent_image": ["6", 0], "seed": 42, "steps": 10, "cfg": 5.0,
            "sampler": ["5", 0], "scheduler": "normal", "denoise": 1.0
        },
        "class_type": "KSampler"
    },
    "8": {
        "inputs": {"vae_name": "wan_2.1_vae.safetensors"},
        "class_type": "VAELoader"
    },
    "9": {
        "inputs": {"samples": ["7", 0], "vae": ["8", 0]},
        "class_type": "VAEDecode"
    },
    "10": {
        "inputs": {
            "images": ["9", 0], "filename_prefix": "quick_test",
            "fps": 16, "method": "default", "quality": 80, "lossless": False
        },
        "class_type": "SaveAnimatedWEBP"
    }
}

print("Submitting workflow for validation...")
result = api_post("/prompt", {"prompt": wf})

if result is None:
    print("FAILED: No response from ComfyUI")
    sys.exit(1)

node_errors = result.get("node_errors", {})
if node_errors:
    print(f"VALIDATION FAILED!")
    for node_id, errors in node_errors.items():
        print(f"  Node {node_id}:")
        for e in errors.get("errors", []):
            print(f"    - {e['message']}")
    sys.exit(1)

prompt_id = result.get("prompt_id")
print(f"SUCCESS! Prompt ID: {prompt_id}")
print(f"Workflow validates OK. Starting generation monitoring...")

# Monitor
max_wait = 1200  # 20 min
start = time.time()
last_status = ""

while time.time() - start < max_wait:
    try:
        history = api_get(f"/history/{prompt_id}")
    except:
        time.sleep(5)
        continue
    
    if prompt_id in history:
        h = history[prompt_id]
        status = h.get("status", {})
        
        if status.get("completed", False):
            elapsed = time.time() - start
            print(f"\nCOMPLETED in {elapsed:.0f}s!")
            
            outputs = h.get("outputs", {})
            for node_id, node_output in outputs.items():
                for img in node_output.get("images", []):
                    fname = img.get("filename", "unknown")
                    fpath = f"/root/ComfyUI/output/{img.get('subfolder', '')}/{fname}"
                    if os.path.exists(fpath):
                        sz = os.path.getsize(fpath) / 1024
                        print(f"  Output: {fname} ({sz:.1f} KB)")
                    else:
                        print(f"  Output: {fname} (NOT FOUND)")
                for g in node_output.get("gifs", []):
                    print(f"  GIF: {g}")
            
            sys.exit(0)
        
        status_str = h.get("status_str", "")
        if status_str != last_status:
            elapsed = time.time() - start
            print(f"  [{elapsed:.0f}s] {status_str}")
            last_status = status_str
    
    time.sleep(10)

print(f"TIMEOUT after {max_wait}s")
sys.exit(1)
