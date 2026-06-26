#!/usr/bin/env python3
"""
wan2.1 14B I2V — ref_frame.png + dynamic prompt
Based on EXACT working test_official_41f.py, only changed: image, seed, prompt, filename_prefix
"""
import json, urllib.request, sys, time

COMFY = "http://127.0.0.1:8189"

workflow = {
    "1": {
        "class_type": "WanVideoModelLoader",
        "inputs": {
            "model": "Wan2_1-I2V-14B-720P_fp8_e4m3fn.safetensors",
            "base_precision": "fp16",
            "quantization": "fp8_e4m3fn",
            "load_device": "offload_device",
            "attention_mode": "sdpa"
        }
    },
    "2": {
        "class_type": "LoadWanVideoT5TextEncoder",
        "inputs": {
            "model_name": "umt5-xxl-enc-bf16.safetensors",
            "precision": "bf16",
            "load_device": "offload_device"
        }
    },
    "3": {
        "class_type": "WanVideoTextEncode",
        "inputs": {
            "t5": ["2", 0],
            "model_to_offload": ["1", 0],
            "positive_prompt": "A person walks slowly through a quiet courtyard, wind gently rustling the leaves on the trees, sunlight filters through the branches casting soft shadows on the ground, the camera follows smoothly",
            "negative_prompt": "色调艳丽，过曝，静态，细节模糊不清，字幕，风格，作品，画作，画面，静止，整体发灰，最差质量，低质量，JPEG压缩残留，丑陋的，残缺的，多余的手指，画得不好的手部，画得不好的脸部，畸形的，毁容的，形态畸形的肢体，手指融合，静止不动的画面，杂乱的背景，三条腿，背景人很多，倒着走",
            "force_offload": True,
            "device": "gpu"
        }
    },
    "4": {
        "class_type": "WanVideoVAELoader",
        "inputs": {
            "model_name": "Wan2_1_VAE_bf16.safetensors",
            "precision": "bf16"
        }
    },
    "5": {
        "class_type": "CLIPVisionLoader",
        "inputs": {
            "clip_name": "clip_vision_h.safetensors"
        }
    },
    "6": {
        "class_type": "LoadImage",
        "inputs": {
            "image": "ref_frame.png"
        }
    },
    "7": {
        "class_type": "WanVideoClipVisionEncode",
        "inputs": {
            "clip_vision": ["5", 0],
            "image_1": ["6", 0],
            "strength_1": 1.0,
            "strength_2": 0.2,
            "crop": "center",
            "combine_embeds": "average",
            "force_offload": True
        }
    },
    "8": {
        "class_type": "WanVideoImageToVideoEncode",
        "inputs": {
            "vae": ["4", 0],
            "start_image": ["6", 0],
            "width": 832,
            "height": 480,
            "num_frames": 41,
            "noise_aug_strength": 0.03,
            "start_latent_strength": 1.0,
            "end_latent_strength": 1.0,
            "force_offload": True,
            "enable_vae_tiling": True
        }
    },
    "9": {
        "class_type": "WanVideoSampler",
        "inputs": {
            "model": ["1", 0],
            "image_embeds": ["8", 0],
            "text_embeds": ["3", 0],
            "steps": 20,
            "cfg": 1.0,
            "shift": 5.0,
            "seed": 77777777,
            "force_offload": True,
            "scheduler": "dpm++_sde",
            "riflex_freq_index": 0,
            "denoise_strength": 1.0,
            "image_embeds_strength": "1.0"
        }
    },
    "10": {
        "class_type": "WanVideoDecode",
        "inputs": {
            "vae": ["4", 0],
            "samples": ["9", 0],
            "enable_vae_tiling": True,
            "tile_x": 272,
            "tile_y": 272,
            "tile_stride_x": 144,
            "tile_stride_y": 128
        }
    },
    "11": {
        "class_type": "CreateVideo",
        "inputs": {
            "images": ["10", 0],
            "fps": 16.0
        }
    },
    "12": {
        "class_type": "SaveVideo",
        "inputs": {
            "filename_prefix": "wan21_ref_frame",
            "video": ["11", 0],
            "format": "auto",
            "codec": "auto"
        }
    }
}

data = json.dumps({"prompt": workflow}).encode()
req = urllib.request.Request(f"{COMFY}/prompt", data=data, headers={"Content-Type": "application/json"})
try:
    resp = urllib.request.urlopen(req, timeout=30)
    result = json.loads(resp.read().decode())
    pid = result.get("prompt_id", "")
    print(f"SUBMITTED: {pid}")
except urllib.error.HTTPError as e:
    body = e.read().decode()
    print(f"HTTP {e.code}: {body[:800]}")
    sys.exit(1)

elapsed = 0
while elapsed < 600:
    time.sleep(55)
    elapsed += 55
    try:
        resp = urllib.request.urlopen(f"{COMFY}/history/{pid}", timeout=15)
        history = json.loads(resp.read().decode())
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
                        print(f"  ERR: node={md.get('node_id','')} type={md.get('exception_type','')} msg={md.get('exception_message','')[:300]}")
            break
    except Exception as e:
        print(f"  {elapsed}s: poll error {e}")
else:
    print("TIMEOUT 600s")
