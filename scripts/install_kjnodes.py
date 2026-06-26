#!/usr/bin/env python3
"""用ComfyUI Manager API安装KJNodes插件"""
import urllib.request, json, time, os

# ComfyUI Manager CLI安装方式
os.chdir("/root/autodl-tmp/ComfyUI/custom_nodes/ComfyUI-Manager")

# 先检查是否已安装
import subprocess
result = subprocess.run(["ls", "/root/autodl-tmp/ComfyUI/custom_nodes/ComfyUI-KJNodes"], capture_output=True)
if result.returncode == 0:
    print("KJNodes already installed")
else:
    # 用ComfyUI Manager的git_clone方式
    # 需要通过Manager的CLI
    result = subprocess.run(
        ["/root/autodl-tmp/miniconda3/bin/python", "-c",
         "import os; os.chdir('/root/autodl-tmp/ComfyUI/custom_nodes'); "
         "import git; git.Repo.clone_from('https://github.com/comfyanonymous/ComfyUI-KJNodes', 'ComfyUI-KJNodes')"],
        capture_output=True, timeout=120
    )
    print(f"stdout: {result.stdout.decode()[:200]}")
    print(f"stderr: {result.stderr.decode()[:200]}")

# 验证安装
result = subprocess.run(["ls", "/root/autodl-tmp/ComfyUI/custom_nodes/ComfyUI-KJNodes/__init__.py"], capture_output=True)
print(f"KJNodes installed: {result.returncode == 0}")
