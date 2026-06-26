#!/usr/bin/env python3
"""
LocalMiniDrama 端到端流程测试 - wan2.1 14B fp8 I2V 720p
模拟完整短剧流程: 参考图→I2V视频生成(720p)
workflow内嵌,直接在服务器跑
"""
import json, urllib.request, time, sys, os

API = "http://127.0.0.1:8189"

# 内嵌wan21_fp8_i2v.json (已修正SaveWEBM→CreateVideo+SaveVideo)
WF_TEMPLATE = {
    "1": {"class_type": "WanVideoModelLoader", "inputs": {
        "model": "wan_fp8_scaled/I2V/wan2.1_i2v_480p_720p_14B_fp8_e4m3fn.safetensors",
        "base_precision": "bf16", "quantization": "fp8_e4m3fn",
        "load_device": "offload_device", "attention_mode": "sdpa"}},
    "2": {"class_type": "LoadWanVideoT5TextEncoder", "inputs": {
        "model_name": "umt5_xxl_fp8_e4m3fn_scaled.safetensors",
        "precision": "bf16", "load_device": "offload_device", "quantization": "fp8_e4m3fn"}},
    "3": {"class_type": "WanVideoTextEncode", "inputs": {
        "t5": ["2", 0], "model_to_offload": ["1", 0],
        "positive_prompt": "{{prompt}}", "negative_prompt": "{{negative_prompt}}",
        "force_offload": True, "device": "gpu"}},
    "4": {"class_type": "WanVideoVAELoader", "inputs": {
        "model_name": "wan_2.1_vae.safetensors", "precision": "bf16"}},
    "5": {"class_type": "CLIPVisionLoader", "inputs": {
        "clip_name": "clip_vision_h.safetensors"}},
    "6": {"class_type": "LoadImage", "inputs": {"image": "{{image_url}}"}},
    "7": {"class_type": "WanVideoClipVisionEncode", "inputs": {
        "clip_vision": ["5", 0], "image_1": ["6", 0],
        "strength_1": 1.0, "strength_2": 1.0, "crop": "center",
        "combine_embeds": "average", "force_offload": True}},
    "8": {"class_type": "WanVideoImageToVideoEncode", "inputs": {
        "vae": ["4", 0], "clip_embeds": ["7", 0], "start_image": ["6", 0],
        "width": "{{width}}", "height": "{{height}}", "num_frames": "{{frames}}",
        "noise_aug_strength": 0.03, "start_latent_strength": 1.0,
        "end_latent_strength": 1.0, "force_offload": True, "tiled_vae": False}},
    "9": {"class_type": "WanVideoSampler", "inputs": {
        "model": ["1", 0], "image_embeds": ["8", 0], "text_embeds": ["3", 0],
        "steps": "{{steps}}", "cfg": "{{cfg}}", "shift": 5.0, "seed": "{{seed}}",
        "force_offload": True, "scheduler": "dpm++_sde",
        "riflex_freq_index": 0, "denoise_strength": 1.0}},
    "10": {"class_type": "WanVideoDecode", "inputs": {
        "vae": ["4", 0], "samples": ["9", 0],
        "enable_vae_tiling": False,
        "tile_x": 272, "tile_y": 272, "tile_stride_x": 144, "tile_stride_y": 128}},
    "11": {"class_type": "CreateVideo", "inputs": {"images": ["10", 0], "fps": "{{fps}}"}},
    "12": {"class_type": "SaveVideo", "inputs": {
        "filename_prefix": "{{filename_prefix}}", "video": ["11", 0],
        "format": "auto", "codec": "auto"}},
}

# 6个分镜 - 与LocalMiniDrama DB一致
STORYBOARDS = [
    {"id": 1, "title": "旧物中的灵感",
     "prompt": "A woman kneeling on floor surrounded by cardboard boxes, afternoon sunlight streaming through window, dust particles floating, she opens a box labeled old things, warm golden light, cinematic, 720p",
     "duration": 5},
    {"id": 2, "title": "决意离家",
     "prompt": "A woman quickly folds a sketch into her canvas bag, puts on jacket, walks towards door without looking back, determined expression, indoor scene, cinematic, 720p",
     "duration": 5},
    {"id": 3, "title": "羞辱与反击",
     "prompt": "In a Chinese restaurant private room, a man sneers while eating, another woman slowly raises her head with defiant eyes, dramatic lighting, cinematic, 720p",
     "duration": 5},
    {"id": 4, "title": "草图被毁",
     "prompt": "A man grabs a sketch and tears it apart with both hands, paper fragments falling like snow onto bowls and glasses on table, angry expression, cinematic, 720p",
     "duration": 5},
    {"id": 5, "title": "街头报名",
     "prompt": "A woman stands under neon lights on a street corner at night, takes out her phone, screen light illuminates her determined face, she types quickly, cinematic, 720p",
     "duration": 5},
    {"id": 6, "title": "天才的碎片",
     "prompt": "At a restaurant door, a designer bends down to pick up the largest sketch fragment, examines it carefully in his palm, frowns deeply then suddenly his eyes light up, cinematic, 720p",
     "duration": 5},
]

IMAGE = "25_ig_51c0cd60.png"  # 服务器上已有的测试图

def substitute_workflow(sb, idx):
    wf = json.loads(json.dumps(WF_TEMPLATE))
    fps = 16
    frames = sb["duration"] * fps + 1
    width, height = 1280, 720
    steps = 4
    cfg = 1.0
    seed = 42 + idx

    replacements = {
        "{{prompt}}": sb["prompt"],
        "{{negative_prompt}}": "",
        "{{image_url}}": IMAGE,
        "{{seed}}": str(seed), "{{width}}": str(width), "{{height}}": str(height),
        "{{frames}}": str(int(frames)), "{{fps}}": str(fps),
        "{{steps}}": str(steps), "{{cfg}}": str(cfg),
        "{{filename_prefix}}": f"drama_sb{sb['id']}",
    }
    numeric_fields = {'seed','noise_seed','width','height','num_frames',
        'steps','fps','cfg','shift','riflex_freq_index','denoise_strength',
        'tile_x','tile_y','tile_stride_x','tile_stride_y','frames'}

    for node_id, node in wf.items():
        if node.get("inputs"):
            for key, value in list(node["inputs"].items()):
                if isinstance(value, str):
                    new_val = value
                    for ph, rep in replacements.items():
                        new_val = new_val.replace(ph, rep)
                    if new_val != value:
                        if key in numeric_fields:
                            try: node["inputs"][key] = int(new_val) if '.' not in new_val else float(new_val)
                            except: node["inputs"][key] = new_val
                        else:
                            node["inputs"][key] = new_val
    return wf

def submit(wf):
    data = json.dumps({"prompt": wf}).encode()
    req = urllib.request.Request(f"{API}/prompt", data=data, headers={"Content-Type": "application/json"})
    try:
        resp = urllib.request.urlopen(req, timeout=15)
        return json.loads(resp.read()).get("prompt_id")
    except urllib.error.HTTPError as e:
        print(f"  HTTP {e.code}: {e.read().decode()[:300]}")
        return None

def poll(pid, timeout=600):
    elapsed = 0
    while elapsed < timeout:
        time.sleep(10)
        elapsed += 10
        try:
            resp = urllib.request.urlopen(f"{API}/history/{pid}", timeout=15)
            history = json.loads(resp.read().decode())
            pd = history.get(pid, {})
            status = pd.get("status", {}).get("status_str", "running")
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
                        if isinstance(md, dict):
                            errs.append(f"node={md.get('node_id','')} {md.get('exception_type','')}: {md.get('exception_message','')[:200]}")
                return {"status": "error", "errors": errs, "elapsed": elapsed}
        except: pass
    return {"status": "timeout", "elapsed": elapsed}

# ========== 主流程 ==========
print("=" * 60)
print("LocalMiniDrama E2E - wan2.1 14B fp8 I2V 720p")
print(f"分镜数: {len(STORYBOARDS)}")
print("=" * 60)

results = []
total_start = time.time()

for idx, sb in enumerate(STORYBOARDS):
    print(f"\n--- SB{sb['id']}: {sb['title']} ---")
    wf = substitute_workflow(sb, idx)
    pid = submit(wf)
    if not pid:
        print("  ❌ 提交失败")
        results.append({"id": sb["id"], "status": "submit_failed"})
        continue
    print(f"  提交: {pid}")
    
    # 等上一轮的模型释放 + 本轮加载
    result = poll(pid, timeout=600)
    
    if result["status"] == "success":
        print(f"  ✅ {result['elapsed']}s → {result['outputs']}")
        results.append({"id": sb["id"], "status": "success", "elapsed": result["elapsed"], "outputs": result["outputs"]})
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
if success:
    avg = sum(r["elapsed"] for r in success) / len(success)
    print(f"平均: {avg:.0f}s/clip  总计: {total_elapsed:.0f}s")
print(f"{'='*60}")
