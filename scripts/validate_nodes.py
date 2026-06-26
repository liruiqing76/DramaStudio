#!/usr/bin/env python3
"""Quick validation - check available nodes for Wan22 T2V workflow"""
import urllib.request, json

obj = json.loads(urllib.request.urlopen("http://127.0.0.1:8188/object_info").read())

# Find latent/video creation nodes
print("=== Latent/Empty creation nodes ===")
for k in sorted(obj.keys()):
    if "latent" in k.lower() or "empty" in k.lower():
        req = obj[k].get("input", {}).get("required", {})
        print(f"  {k}: {list(req.keys())}")

# Find Hunyuan specific nodes
print("\n=== Hunyuan related nodes ===")
for k in sorted(obj.keys()):
    if "hunyuan" in k.lower():
        req = obj[k].get("input", {}).get("required", {})
        print(f"  {k}: {list(req.keys())}")

# Check DualCLIPLoaderGGUF requirements
print("\n=== DualCLIPLoaderGGUF ===")
if "DualCLIPLoaderGGUF" in obj:
    req = obj["DualCLIPLoaderGGUF"].get("input", {}).get("required", {})
    print(f"  Required inputs: {list(req.keys())}")
    for inp, conf in req.items():
        if isinstance(conf, list) and len(conf) > 0:
            if isinstance(conf[0], list):
                print(f"    {inp}: {conf[0][:5]}...")
            else:
                print(f"    {inp}: {conf}")
elif "CLIPLoaderGGUF" in obj:
    req = obj["CLIPLoaderGGUF"].get("input", {}).get("required", {})
    print(f"  (Using CLIPLoaderGGUF) Required: {list(req.keys())}")
    for inp, conf in req.items():
        if isinstance(conf, list) and len(conf) > 0:
            if isinstance(conf[0], list):
                print(f"    {inp}: {conf[0][:5]}...")
            else:
                print(f"    {inp}: {conf}")

# Check Wan22ImageToVideoLatent
print("\n=== Wan22ImageToVideoLatent ===")
for k in sorted(obj.keys()):
    if "wan22" in k.lower() and "latent" in k.lower():
        req = obj[k].get("input", {}).get("required", {})
        print(f"  {k}: {list(req.keys())}")
        for inp, conf in req.items():
            if isinstance(conf, list) and len(conf) > 0:
                if isinstance(conf[0], list):
                    print(f"    {inp}: {conf[0][:5]}...")
                else:
                    print(f"    {inp}: {conf}")

# Check SaveAnimatedWEBP requirements  
print("\n=== SaveAnimatedWEBP ===")
if "SaveAnimatedWEBP" in obj:
    req = obj["SaveAnimatedWEBP"].get("input", {}).get("required", {})
    print(f"  Required inputs: {list(req.keys())}")
    for inp, conf in req.items():
        print(f"    {inp}: {conf}")

# Detailed check of key nodes with their option lists
print("\n=== DETAILED NODE PARAMS ===")
for k in ["DualCLIPLoaderGGUF", "CLIPLoaderGGUF", "UnetLoaderGGUF", 
           "SaveAnimatedWEBP", "SaveVideo", "KSampler", "EmptyHunyuanLatentVideo",
           "WanTextToVideoApi", "Wan2TextToVideoApi", "Wan2ImageToVideoApi"]:
    if k in obj:
        req = obj[k].get("input", {}).get("required", {})
        print(f"\n{k}:")
        for inp, conf in req.items():
            if isinstance(conf, list) and len(conf) > 0:
                if isinstance(conf[0], list):
                    opts = conf[0]
                    print(f"  {inp}: [{len(opts)} options] {opts[:10]}{'...' if len(opts)>10 else ''}")
                elif isinstance(conf[0], (int, float)):
                    print(f"  {inp}: (default={conf[0]}, min={conf[1]}, max={conf[2]})")
                else:
                    print(f"  {inp}: (default={conf[0]})")
            else:
                print(f"  {inp}: {conf}")

# Check available CLIP models
print("\n=== Available CLIP models (for GGUF loading) ===")
clip_dir = "/root/ComfyUI/models/clip"
import os
if os.path.isdir(clip_dir):
    for f in os.listdir(clip_dir):
        fpath = os.path.join(clip_dir, f)
        if os.path.islink(fpath):
            target = os.readlink(fpath)
            print(f"  {f} -> {target}")
        else:
            sz = os.path.getsize(fpath) / (1024**3)
            print(f"  {f} ({sz:.1f} GB)")

# Check available VAE models
print("\n=== Available VAE models ===")
vae_dir = "/root/ComfyUI/models/vae"
if os.path.isdir(vae_dir):
    for f in os.listdir(vae_dir):
        if f.endswith(".safetensors") or f.endswith(".pt") or f.endswith(".pth"):
            fpath = os.path.join(vae_dir, f)
            if os.path.islink(fpath):
                target = os.readlink(fpath)
                print(f"  {f} -> {target}")
            else:
                sz = os.path.getsize(fpath) / (1024**3)
                print(f"  {f} ({sz:.1f} GB)")
