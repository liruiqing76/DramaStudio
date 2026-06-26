#!/usr/bin/env python3
"""
wan2.1 14B I2V + Lightx2v 4-step LoRA加速测试
单模型（不像wan2.2需要两步），4步生成，大幅提速
参考：https://github.com/ModelTC/Wan2.2-Lightning (Lightx2v蒸馏方案)
"""
import json, urllib.request, time, sys, os

COMFYUI_URL = "http://127.0.0.1:8189"

# === wan2.1 I2V 4-step Lightx2v workflow ===
# wan2.1 I2V是单模型，不需要两步(HIGH/LOW)
# Lightx2v 4-step LoRA: steps=4, 特定sigmas

workflow = {
    # 1. Load HIGH model (wan2.1 fp8)
    "1": {
        "class_type": "WanVideoModelLoader",
        "inputs": {
            "model_name": "wan2.1_i2v_480p_720p_14B_fp8_e4m3fn_scaled_KJ.safetensors",
            "base_precision": "bf16",
            "loader_type": "fp8_e4m3fn_scaled",
            "device": "cuda"
        }
    },
    # 2. Load T5 text encoder (bf16, not fp8_scaled)
    "2": {
        "class_type": "WanVideoTextEncodeLoader",
        "inputs": {
            "model_name": "umt5-xxl-enc-bf16.safetensors",
            "base_precision": "bf16",
            "device": "cuda",
            "max_length": 512
        }
    },
    # 3. Encode positive prompt
    "3": {
        "class_type": "WanVideoTextEncode",
        "inputs": {
            "text_encoder": ["2", 0],
            "prompt": "masterpiece, best quality, ultra detailed, 8k, photorealistic, soft natural lighting, clear focus, smooth skin, cinematic shot, steady camera, smooth motion, a woman in elegant dress walking gracefully in a sunlit garden",
            "num_frames": 41
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
    # 7. CLIP Vision encode the image
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
    # 8. Image to Video encode
    "8": {
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
    # 9. Set LoRA (Lightx2v 4-step for wan2.1)
    "9": {
        "class_type": "WanVideoLoraSelect",
        "inputs": {
            "model": ["1", 0],
            "lora_name": "wan2.1_i2v_lora_rank64_lightx2v_4step.safetensors",
            "strength": 1.0,
            "low_mem_load": True
        }
    },
    # 10. Set BlockSwap (offload blocks to save VRAM)
    "10": {
        "class_type": "WanVideoSetBlockSwap",
        "inputs": {
            "model": ["9", 0],
            "block_swap_args": ["11", 0]
        }
    },
    # 11. BlockSwap args (20 blocks offloaded for 16G VRAM)
    "11": {
        "class_type": "WanVideoBlockSwapArgs",
        "inputs": {
            "blocks_to_swap": 20
        }
    },
    # 12. Sampler - 4 steps with Lightx2v sigmas
    "12": {
        "class_type": "WanVideoSampler",
        "inputs": {
            "model": ["10", 0],
            "image_embeds": ["8", 0],
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
    # 13. Decode
    "13": {
        "class_type": "WanVideoDecode",
        "inputs": {
            "vae": ["4", 0],
            "samples": ["12", 0],
            "enable_vae_tiling": False,
            "tile_x": 272,
            "tile_y": 272,
            "tile_stride_x": 144,
            "tile_stride_y": 128
        }
    },
    # 14. Create video
    "14": {
        "class_type": "CreateVideo",
        "inputs": {
            "images": ["13", 0],
            "fps": 16.0
        }
    },
    # 15. Save video
    "15": {
        "class_type": "SaveVideo",
        "inputs": {
            "filename_prefix": "wan21_lightx2v_4step",
            "video": ["14", 0],
            "format": "auto",
            "codec": "auto"
        }
    }
}

# Convert to ComfyUI API format
prompt = workflow
print("=== wan2.1 14B I2V: Lightx2v 4-step LoRA加速 ===")
print("Key changes: LoRA=lightx2v_4step(strength=1), steps=4, cfg=1.0")
print(f"Nodes: {len(prompt)}")

# Submit
data = json.dumps({"prompt": prompt}).encode()
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

# Poll with 30s intervals (user requirement: ≤1min)
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
