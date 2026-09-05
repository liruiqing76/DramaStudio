#!/usr/bin/env python3
"""wan2.1 14B I2V + Lightx2v 4-step LoRA - 720p版本"""
import json, urllib.request, time, sys, random

COMFYUI_URL = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8188"

workflow = {
    "1": {
        "class_type": "WanVideoModelLoader",
        "inputs": {
            "model": "Wan2_1-I2V-14B-720P_fp8_e4m3fn.safetensors",
            "base_precision": "bf16",
            "quantization": "fp8_e4m3fn",
            "load_device": "offload_device",
            "attention_mode": "sdpa"
        }
    },
    "2": {
        "class_type": "LoadWanVideoT5TextEncoder",
        "inputs": {
            "model_name": "umt5-xxl-enc-bf16.safetensors",
            "precision": "bf16"
        }
    },
    "3": {
        "class_type": "WanVideoTextEncode",
        "inputs": {
            "positive_prompt": "masterpiece, best quality, ultra detailed, photorealistic, soft natural lighting, clear focus, smooth skin, cinematic shot, steady camera, smooth motion, a woman in elegant dress walking gracefully in a sunlit garden",
            "negative_prompt": "worst quality, low quality, blurry, distorted, deformed limbs, broken fingers, extra limbs, disfigured, shaky camera, flickering, color banding, monochrome, ugly, watermark",
            "t5": ["2", 0],
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
            "image": "celeb_portrait.jpg"
        }
    },
    "7": {
        "class_type": "WanVideoClipVisionEncode",
        "inputs": {
            "clip_vision": ["5", 0],
            "image_1": ["6", 0],
            "strength_1": 1.0,
            "strength_2": 1.0,
            "crop": "center",
            "combine_embeds": "average",
            "force_offload": True
        }
    },
    "8": {
        "class_type": "WanVideoLoraSelectByName",
        "inputs": {
            "lora_name": "wan2.1_i2v_lora_rank64_lightx2v_4step.safetensors",
            "strength": 1.0,
            "merge_loras": False
        }
    },
    "9": {
        "class_type": "WanVideoSetLoRAs",
        "inputs": {
            "model": ["1", 0],
            "lora": ["8", 0]
        }
    },
    "10": {
        "class_type": "WanVideoSetBlockSwap",
        "inputs": {
            "model": ["9", 0],
            "block_swap_args": ["11", 0]
        }
    },
    "11": {
        "class_type": "WanVideoBlockSwap",
        "inputs": {
            "blocks_to_swap": 20,
            "offload_img_emb": False,
            "offload_txt_emb": False
        }
    },
    "12": {
        "class_type": "WanVideoImageToVideoEncode",
        "inputs": {
            "vae": ["4", 0],
            "start_image": ["6", 0],
            "clip_embeds": ["7", 0],
            "width": 1280,
            "height": 720,
            "num_frames": 41,
            "noise_aug_strength": 0.0,
            "start_latent_strength": 1.0,
            "end_latent_strength": 1.0,
            "force_offload": True,
            "enable_vae_tiling": True
        }
    },
    "13": {
        "class_type": "WanVideoSampler",
        "inputs": {
            "model": ["10", 0],
            "image_embeds": ["12", 0],
            "text_embeds": ["3", 0],
            "steps": 4,
            "cfg": 1.0,
            "shift": 5.0,
            "seed": random.randint(1, 2**31),
            "force_offload": True,
            "scheduler": "dpm++_sde",
            "riflex_freq_index": 0,
            "denoise_strength": 1.0,
            "image_embeds_strength": "1.0"
        }
    },
    "14": {
        "class_type": "WanVideoDecode",
        "inputs": {
            "vae": ["4", 0],
            "samples": ["13", 0],
            "enable_vae_tiling": True,
            "tile_x": 272,
            "tile_y": 272,
            "tile_stride_x": 144,
            "tile_stride_y": 128
        }
    },
    "15": {
        "class_type": "CreateVideo",
        "inputs": {
            "images": ["14", 0],
            "fps": 16.0
        }
    },
    "16": {
        "class_type": "SaveVideo",
        "inputs": {
            "filename_prefix": "wan21_lightx2v_720p",
            "video": ["15", 0],
            "format": "auto",
            "codec": "auto"
        }
    }
}

seed_val = workflow["13"]["inputs"]["seed"]
print(f"=== wan2.1 14B I2V: Lightx2v 4-step 720p ===")
print(f"ComfyUI: {COMFYUI_URL}")
print(f"分辨率: 1280x720 | 41帧@16fps | Steps=4 | LoRA=lightx2v_4step | Seed={seed_val}")

data = json.dumps({"prompt": workflow}).encode()
req = urllib.request.Request(f"{COMFYUI_URL}/prompt", data=data, headers={"Content-Type": "application/json"})
try:
    resp = urllib.request.urlopen(req, timeout=30)
    result = json.loads(resp.read().decode())
    pid = result.get("prompt_id", "")
    print(f"SUBMITTED: {pid}")
except urllib.error.HTTPError as e:
    body = e.read().decode()
    print(f"HTTP {e.code}: {body[:500]}")
    sys.exit(1)

elapsed = 0
while elapsed < 600:
    time.sleep(30)
    elapsed += 30
    try:
        resp = urllib.request.urlopen(f"{COMFYUI_URL}/history/{pid}", timeout=15)
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
            print(f"COMPLETE: {elapsed}s")
            break
        elif status == "error":
            msgs = pd.get("status", {}).get("messages", [])
            for m in msgs:
                if isinstance(m, list) and len(m) >= 2:
                    md = m[1]
                    if isinstance(md, dict):
                        print(f"  ERR: node={md.get('node_id','')} type={md.get('exception_type','')} msg={md.get('exception_message','')[:300]}")
            print(f"FAILED: {elapsed}s")
            break
    except Exception as e:
        print(f"  {elapsed}s: poll error {e}")
else:
    print("TIMEOUT 600s")
