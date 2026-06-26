#!/usr/bin/env python3
"""下载并安装ComfyUI-KJNodes"""
import urllib.request, zipfile, os, shutil

url = "https://codeload.github.com/comfyanonymous/ComfyUI-KJNodes/zip/refs/heads/main"
zip_path = "/tmp/kjnodes.zip"
target = "/root/autodl-tmp/ComfyUI/custom_nodes/ComfyUI-KJNodes"

print("Downloading KJNodes...")
urllib.request.urlretrieve(url, zip_path)
print(f"Downloaded {os.path.getsize(zip_path)} bytes")

print("Extracting...")
with zipfile.ZipFile(zip_path, 'r') as z:
    # Extract to temp dir
    z.extractall("/tmp/kjnodes_extract")

# Find the extracted directory (it will be ComfyUI-KJNodes-main)
extracted = "/tmp/kjnodes_extract/ComfyUI-KJNodes-main"
if os.path.exists(target):
    shutil.rmtree(target)
shutil.move(extracted, target)

# Cleanup
os.remove(zip_path)
shutil.rmtree("/tmp/kjnodes_extract", ignore_errors=True)

print(f"KJNodes installed at {target}")
print(f"Files: {os.listdir(target)[:10]}")
