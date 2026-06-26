import json, urllib.request, time

COMFYUI = "http://127.0.0.1:8189"

# 5B distilled model - simpler, faster, should work better
workflow = {
    "1": {"class_type": "WanVideoModelLoader", "inputs": {
        "model": "wan_fp8_scaled/TI2V/Wan2_2-TI2V-5B_fp8_e4m3fn_scaled_KJ.safetensors",
        "base_precision": "bf16",
        "quantization": "fp8_e4m3fn_scaled",
        "load_device": "offload_device",
        "attention_mode": "sdpa"
    }},
    "2": {"class_type": "LoadWanVideoT5TextEncoder", "inputs": {
        "model_name": "umt5_xxl_fp8_e4m3fn_scaled.safetensors",
        "precision": "bf16",
        "load_device": "offload_device",
        "quantization": "fp8_e4m3fn"
    }},
    "3": {"class_type": "WanVideoTextEncode", "inputs": {
        "t5": ["2", 0],
        "model_to_offload": ["1", 0],
        "positive_prompt": "A beautiful young Asian woman in a red dress walking gracefully through a cherry blossom garden, soft sunlight, detailed face, 4k cinematic",
        "negative_prompt": "",
        "force_offload": True,
        "device": "gpu"
    }},
    "4": {"class_type": "WanVideoVAELoader", "inputs": {
        "model_name": "wan_2.1_vae.safetensors",
        "precision": "bf16"
    }},
    "5": {"class_type": "CLIPVisionLoader", "inputs": {
        "clip_name": "clip_vision_h.safetensors"
    }},
    "6": {"class_type": "LoadImage", "inputs": {
        "image": "25_ig_51c0cd60.png"
    }},
    "7": {"class_type": "WanVideoClipVisionEncode", "inputs": {
        "clip_vision": ["5", 0],
        "image_1": ["6", 0],
        "strength_1": 1.0,
        "strength_2": 1.0,
        "crop": "center",
        "combine_embeds": "average",
        "force_offload": True
    }},
    "8": {"class_type": "WanVideoImageToVideoEncode", "inputs": {
        "vae": ["4", 0],
        "clip_embeds": ["7", 0],
        "start_image": ["6", 0],
        "width": 832,
        "height": 480,
        "num_frames": 41,
        "noise_aug_strength": 0.0,
        "start_latent_strength": 1.0,
        "end_latent_strength": 1.0,
        "force_offload": True,
        "enable_vae_tiling": False
    }},
    "9": {"class_type": "WanVideoSampler", "inputs": {
        "model": ["1", 0],
        "image_embeds": ["8", 0],
        "text_embeds": ["3", 0],
        "steps": 20,
        "cfg": 5.0,
        "shift": 5.0,
        "seed": 42,
        "force_offload": True,
        "scheduler": "unipc",
        "riflex_freq_index": 0,
        "denoise_strength": 1.0,
        "image_embeds_strength": 1.0
    }},
    "10": {"class_type": "WanVideoDecode", "inputs": {
        "vae": ["4", 0],
        "samples": ["9", 0],
        "enable_vae_tiling": True,
        "tile_x": 272,
        "tile_y": 272,
        "tile_stride_x": 144,
        "tile_stride_y": 128
    }},
    "12": {"class_type": "CreateVideo", "inputs": {
        "images": ["10", 0],
        "fps": 25.0
    }},
    "13": {"class_type": "SaveVideo", "inputs": {
        "filename_prefix": "test_5b_i2v",
        "video": ["12", 0],
        "format": "auto",
        "codec": "auto"
    }}
}

prompt = {"prompt": workflow}
data = json.dumps(prompt).encode()
print("=== 5B distilled I2V: fp8_scaled + clip_embeds + cfg=5 ===")
try:
    req = urllib.request.Request(f"{COMFYUI}/prompt", data=data, headers={"Content-Type": "application/json"})
    resp = urllib.request.urlopen(req, timeout=30)
    result = json.loads(resp.read().decode())
    pid = result.get("prompt_id", "")
    print(f"SUBMITTED: {pid}")
    elapsed = 0
    while elapsed < 600:
        time.sleep(30)
        elapsed += 30
        try:
            resp2 = urllib.request.urlopen(f"{COMFYUI}/history/{pid}", timeout=15)
            history = json.loads(resp2.read().decode())
            pd = history.get(pid, {})
            status = pd.get("status", {}).get("status_str", "running")
            print(f"  {elapsed}s: {status}")
            if status == "success":
                for nid, out in pd.get("outputs", {}).items():
                    for key in ["videos", "images"]:
                        if key in out:
                            for item in out[key]:
                                fn = item.get("filename", "")
                                print(f"  OUTPUT: {fn}")
                break
            elif status == "error":
                msgs = pd.get("status", {}).get("messages", [])
                for m in msgs:
                    if isinstance(m, list) and len(m) >= 2:
                        md = m[1]
                        if isinstance(md, dict):
                            print(f"  ERR: node={md.get('node_id','')} type={md.get('exception_type','')} msg={md.get('exception_message','')[:500]}")
                break
        except Exception as e:
            print(f"  {elapsed}s: poll error {e}")
    print(f"COMPLETE: {elapsed}s")
except urllib.error.HTTPError as e:
    body = e.read().decode()
    print(f"HTTP {e.code}: {body[:800]}")
