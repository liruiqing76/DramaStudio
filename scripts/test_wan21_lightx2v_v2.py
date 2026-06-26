#!/usr/bin/env python3
"""
wan2.1 14B I2V + Lightx2v 4-step LoRA加速测试 (修正版)
使用正确的ComfyUI节点名
"""
import json, urllib.request, time, sys

COMFYUI_URL = "http://127.0.0.1:8189"

workflow = {
    # 1. Load wan2.1 fp8 model
    "1": {
        "class_type": "WanVideoModelLoader",
        "inputs": {
            "model": "wan2.1_i2v_480p_720p_14B_fp8_e4m3fn_scaled_KJ.safetensors",
            "base_precision": "bf16",
            "quantization": "fp8_e4m3fn_scaled",
            "load_device": "cuda"
        }
    },
    # 2. Load T5 text encoder (bf16)
    "2": {
        "class_type": "LoadWanVideoT5TextEncoder",
        "inputs": {
            "model": "umt5-xxl-enc-bf16.safetensors",
            "precision": "bf16",
            "load_device": "cuda"
        }
    },
    # 3. Encode positive prompt
    "3": {
        "class_type": "WanVideoTextEncode",
        "inputs": {
            "positive_prompt": "masterpiece, best quality, ultra detailed, 8k, photorealistic, soft natural lighting, clear focus, smooth skin, cinematic shot, steady camera, smooth motion, a woman in elegant dress walking gracefully in a sunlit garden",
            "negative_prompt": "worst quality, low quality, blurry, fuzzy, distorted, deformed limbs, broken fingers, extra limbs, disfigured, shaky camera, flickering, color banding, monochrome, ugly, cartoon, painting, watermark, text"
        }
    },
    # 4. Load VAE
    "4": {
        "class_type": "WanVideoVAELoader",
        "inputs": {
            "model_name": "wan_2.1_vae.safetensors",
            "base_precision": "bf16"
        }
    },
    # 5. Load CLIP Vision
    "5": {
        "class_type": "WanVideoClipVisionLoader",
        "inputs": {
            "model_name": "clip_vision_h.safetensors"
        }
    },
    # 6. Load input image
    "6": {
        "class_type": "LoadImage",
        "inputs": {
            "image": "test_image.jpg"
        }
    },
    # 7. CLIP Vision encode
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
    # 8. Select LoRA by name
    "8": {
        "class_type": "WanVideoLoraSelectByName",
        "inputs": {
            "lora_name": "wan2.1_i2v_lora_rank64_lightx2v_4step.safetensors",
            "strength": 1.0
        }
    },
    # 9. Set LoRA on model
    "9": {
        "class_type": "WanVideoSetLoRAs",
        "inputs": {
            "model": ["1", 0],
            "lora": ["8", 0]
        }
    },
    # 10. Set BlockSwap
    "10": {
        "class_type": "WanVideoSetBlockSwap",
        "inputs": {
            "model": ["9", 0],
            "block_swap_args": ["11", 0]
        }
    },
    # 11. BlockSwap args (32G VRAM can keep more on GPU)
    "11": {
        "class_type": "WanVideoBlockSwap",
        "inputs": {
            "blocks_to_swap": 20,
            "offload_img_emb": False,
            "offload_txt_emb": False
        }
    },
    # 12. Image to Video encode
    "12": {
        "class_type": "WanVideoImageToVideoEncode",
        "inputs": {
            "vae": ["4", 0],
            "start_image": ["6", 0],
            "clip_embeds": ["7", 0],
            "width": 832,
            "height": 480,
            "num_frames": 41,
            "noise_aug_strength": 0.0,
            "start_latent_strength": 1.0,
            "end_latent_strength": 1.0,
            "force_offload": True,
            "enable_vae_tiling": False
        }
    },
    # 13. Sampler - 4 steps with Lightx2v
    "13": {
        "class_type": "WanVideoSampler",
        "inputs": {
            "model": ["10", 0],
            "image_embeds": ["12", 0],
            "text_embeds": ["3", 0],
            "steps": 4,
            "cfg": 1.0,
            "shift": 5.0,
            "seed": 42,
            "force_offload": True,
            "scheduler": "dpm++_sde",
            "riflex_freq_index": 0,
            "denoise_strength": 1.0,
            "image_embeds_strength": "1.0"
        }
    },
    # 14. Decode
    "14": {
        "class_type": "WanVideoDecode",
        "inputs": {
            "vae": ["4", 0],
            "samples": ["13", 0],
            "enable_vae_tiling": False,
            "tile_x": 272,
            "tile_y": 272,
            "tile_stride_x": 144,
            "tile_stride_y": 128
        }
    },
    # 15. Create video
    "15": {
        "class_type": "CreateVideo",
        "inputs": {
            "images": ["14", 0],
            "fps": 16.0
        }
    },
    # 16. Save video
    "16": {
        "class_type": "SaveVideo",
        "inputs": {
            "filename_prefix": "wan21_lightx2v_4step",
            "video": ["15", 0],
            "format": "auto",
            "codec": "auto"
        }
    }
}

print("=== wan2.1 14B I2V: Lightx2v 4-step LoRA (修正版) ===")
print("Nodes: 16 | Steps=4 | CFG=1.0 | LoRA=lightx2v_4step(strength=1)")
print(f"分辨率: 832x480 | 41帧@16fps | 负面提示词已加")

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
                            sz = item.get("size", 0)
                            print(f"  OUTPUT: {fn} ({sz/(1024*1024):.1f}MB)")
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
