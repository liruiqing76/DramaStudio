#!/usr/bin/env python3
"""
wan2.1 14B I2V — 换图测试(ref_frame.png) + 动态prompt
Confirmed success params: dpm++_sde, fp16, noise_aug=0.03, strength_2=0.2, bf16 T5
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
            "load_device": "cuda",
            "offload_device": "cpu",
            "vae_tile_size": 272,
            "force_offload": True
        }
    },
    "2": {
        "class_type": "WanVideoT5TextEncoderLoader",
        "inputs": {
            "model": "umt5-xxl-enc-bf16.safetensors",
            "load_device": "cuda",
            "offload_device": "cpu",
            "force_offload": True
        }
    },
    "3": {
        "class_type": "WanVideoTextEncode",
        "inputs": {
            "text_encoder": ["2", 0],
            "prompt": "A person walks slowly through a quiet courtyard, wind gently rustling the leaves on the trees, sunlight filters through the branches casting soft shadows on the ground, the camera follows smoothly",
            "num_frames": 41
        }
    },
    "4": {
        "class_type": "WanVideoVAELoader",
        "inputs": {
            "model": "Wan2_1_VAE_bf16.safetensors",
            "load_device": "cuda",
            "offload_device": "cpu",
            "force_offload": True
        }
    },
    "5": {
        "class_type": "WanVideoClipVisionLoader",
        "inputs": {
            "clip_vision": "clip_vision_h.safetensors"
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
            "seed": 88888888,
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
            "fps": 25.0
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

prompt_data = json.dumps({"prompt": workflow}).encode("utf-8")
req = urllib.request.Request(f"{COMFY}/prompt", data=prompt_data, headers={"Content-Type": "application/json"})
resp = urllib.request.urlopen(req, timeout=30)
result = json.loads(resp.read().decode())
pid = result.get("prompt_id")
print(f"SUBMITTED: {pid}")

elapsed = 0
while elapsed < 600:
    time.sleep(50)
    elapsed += 50
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
