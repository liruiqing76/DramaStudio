#!/usr/bin/env python3
"""
LocalMiniDrama E2E - 用330s成功版workflow(精简参数,无多余参数)
关键: Sampler必须带image_embeds_strength=1.0, 不加attention_mode/load_device/quantization/device/tiled_vae
"""
import json, urllib.request, time, sys

API = "http://127.0.0.1:8189"

# === 330s成功版workflow(原封不动,只改prompt/seed/filename) ===
def make_workflow(prompt, seed, filename_prefix):
    return {
        "1": {"class_type": "WanVideoModelLoader", "inputs": {
            "model": "wan_fp8_scaled/I2V/wan2.1_i2v_480p_720p_14B_fp8_e4m3fn.safetensors",
            "base_precision": "bf16", "quantization": "fp8_e4m3fn", "load_device": "offload_device"}},
        "2": {"class_type": "LoadWanVideoT5TextEncoder", "inputs": {
            "model_name": "umt5_xxl_fp8_e4m3fn_scaled.safetensors", "precision": "bf16"}},
        "3": {"class_type": "WanVideoTextEncode", "inputs": {
            "t5": ["2", 0], "model_to_offload": ["1", 0],
            "positive_prompt": prompt, "negative_prompt": "", "force_offload": True}},
        "4": {"class_type": "WanVideoVAELoader", "inputs": {
            "model_name": "wan_2.1_vae.safetensors", "precision": "bf16"}},
        "5": {"class_type": "CLIPVisionLoader", "inputs": {
            "clip_name": "clip_vision_h.safetensors"}},
        "6": {"class_type": "WanVideoClipVisionEncode", "inputs": {
            "clip_vision": ["5", 0], "image_1": ["7", 0],
            "strength_1": 1.0, "strength_2": 1.0, "crop": "center",
            "combine_embeds": "average", "force_offload": True}},
        "7": {"class_type": "LoadImage", "inputs": {"image": "25_ig_51c0cd60.png"}},
        "8": {"class_type": "WanVideoImageToVideoEncode", "inputs": {
            "vae": ["4", 0], "clip_embeds": ["6", 0], "start_image": ["7", 0],
            "width": 1280, "height": 720, "num_frames": 81,
            "noise_aug_strength": 0.03, "start_latent_strength": 1.0,
            "end_latent_strength": 1.0, "force_offload": True}},
        "9": {"class_type": "WanVideoSampler", "inputs": {
            "model": ["1", 0], "image_embeds": ["8", 0], "text_embeds": ["3", 0],
            "steps": 4, "cfg": 1.0, "shift": 5.0, "seed": seed,
            "force_offload": True, "scheduler": "dpm++_sde",
            "riflex_freq_index": 0, "denoise_strength": 1.0,
            "image_embeds_strength": 1.0}},  # ← 关键!不能漏!
        "10": {"class_type": "WanVideoDecode", "inputs": {
            "vae": ["4", 0], "samples": ["9", 0],
            "enable_vae_tiling": False,
            "tile_x": 272, "tile_y": 272, "tile_stride_x": 144, "tile_stride_y": 128}},
        "11": {"class_type": "CreateVideo", "inputs": {"images": ["10", 0], "fps": 16.0}},
        "12": {"class_type": "SaveVideo", "inputs": {
            "filename_prefix": filename_prefix, "video": ["11", 0],
            "format": "auto", "codec": "auto"}},
    }

STORYBOARDS = [
    {"id": 1, "title": "旧物中的灵感",
     "prompt": "A woman kneeling on floor surrounded by cardboard boxes, afternoon sunlight streaming through window, dust particles floating, she opens a box labeled old things, warm golden light, cinematic, 720p"},
    {"id": 2, "title": "决意离家",
     "prompt": "A woman quickly folds a sketch into her canvas bag, puts on jacket, walks towards door without looking back, determined expression, indoor scene, cinematic, 720p"},
    {"id": 3, "title": "羞辱与反击",
     "prompt": "In a Chinese restaurant private room, a man sneers while eating, another woman slowly raises her head with defiant eyes, dramatic lighting, cinematic, 720p"},
    {"id": 4, "title": "草图被毁",
     "prompt": "A man grabs a sketch and tears it apart with both hands, paper fragments falling like snow onto bowls and glasses on table, angry expression, cinematic, 720p"},
    {"id": 5, "title": "街头报名",
     "prompt": "A woman stands under neon lights on a street corner at night, takes out her phone, screen light illuminates her determined face, she types quickly, cinematic, 720p"},
    {"id": 6, "title": "天才的碎片",
     "prompt": "At a restaurant door, a designer bends down to pick up the largest sketch fragment, examines it carefully in his palm, frowns deeply then suddenly his eyes light up, cinematic, 720p"},
]

def submit(wf):
    data = json.dumps({"prompt": wf}).encode()
    req = urllib.request.Request(f"{API}/prompt", data=data, headers={"Content-Type": "application/json"})
    resp = urllib.request.urlopen(req, timeout=15)
    return json.loads(resp.read()).get("prompt_id")

def poll(pid, timeout=600):
    elapsed = 0
    while elapsed < timeout:
        time.sleep(10)
        elapsed += 10
        resp = urllib.request.urlopen(f"{API}/history/{pid}", timeout=15)
        history = json.loads(resp.read().decode())
        pd = history.get(pid, {})
        status = pd.get("status", {}).get("status_str", "running")
        if elapsed % 30 == 0: print(f"  {elapsed}s ({status})")
        if status == "success":
            outputs = []
            for nid, out in pd.get("outputs", {}).items():
                for key in ["videos", "images"]:
                    if key in out:
                        for item in out[key]:
                            fn = item.get("filename", "")
                            if fn: outputs.append(fn)
            return {"status": "success", "outputs": outputs, "elapsed": elapsed}
        elif status == "error":
            errs = []
            for m in pd.get("status", {}).get("messages", []):
                if isinstance(m, list) and len(m) >= 2:
                    md = m[1]
                    if isinstance(md, dict): errs.append(f"{md.get('exception_type','')}: {md.get('exception_message','')[:200]}")
            return {"status": "error", "errors": errs, "elapsed": elapsed}
    return {"status": "timeout"}

print("=" * 60)
print("E2E测试 - 330s成功版workflow(精简参数)")
print(f"分镜: {len(STORYBOARDS)}")
print("=" * 60)

results = []
total_start = time.time()

for idx, sb in enumerate(STORYBOARDS):
    print(f"\n--- SB{sb['id']}: {sb['title']} ---")
    wf = make_workflow(sb["prompt"], 42 + idx, f"drama_sb{sb['id']}")
    pid = submit(wf)
    print(f"  提交: {pid}")
    result = poll(pid, timeout=600)
    if result["status"] == "success":
        print(f"  ✅ {result['elapsed']}s → {result['outputs']}")
        results.append({"id": sb["id"], "status": "success", "elapsed": result["elapsed"]})
    elif result["status"] == "error":
        print(f"  ❌ {result['errors']}")
        results.append({"id": sb["id"], "status": "error"})
    else:
        print(f"  ⏰ 超时")
        results.append({"id": sb["id"], "status": "timeout"})

total_elapsed = time.time() - total_start
success = [r for r in results if r["status"] == "success"]
print(f"\n{'='*60}")
print(f"结果: {len(success)}/{len(results)} 成功")
if success: print(f"平均: {sum(r['elapsed'] for r in success)/len(success):.0f}s/clip  总计: {total_elapsed:.0f}s")
print(f"{'='*60}")
