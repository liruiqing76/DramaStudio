#!/usr/bin/env python3
"""下载并安装ComfyUI-KJNodes - 不走学术代理"""
import urllib.request, zipfile, os, shutil

# 关闭代理
urllib.request.install_opener(urllib.request.build_opener(urllib.request.ProxyHandler({})))

url = "https://codeload.github.com/comfyanonymous/ComfyUI-KJNodes/zip/refs/heads/main"
zip_path = "/tmp/kjnodes.zip"
target = "/root/autodl-tmp/ComfyUI/custom_nodes/ComfyUI-KJNodes"

print("Downloading KJNodes without proxy...")
try:
    urllib.request.urlretrieve(url, zip_path)
    print(f"Downloaded {os.path.getsize(zip_path)} bytes")
except Exception as e:
    print(f"Direct download failed: {e}")
    # Try alternative: download individual files from HuggingFace mirror
    print("Trying alternative method...")
    # KJNodes is also available via ComfyUI registry
    alt_url = "https://registry.comfyui.org/api/v1/nodes/comfyui-kjnodes"
    try:
        resp = urllib.request.urlopen(alt_url, timeout=15)
        print(f"Registry response: {resp.read().decode()[:200]}")
    except Exception as e2:
        print(f"Registry also failed: {e2}")
        # Final fallback: manual download of just the key files we need
        # We only need: INTConstant, ImageResizeKJv2, CreateCFGScheduleFloatList
        print("Skipping KJNodes - will create minimal substitute nodes if needed")
