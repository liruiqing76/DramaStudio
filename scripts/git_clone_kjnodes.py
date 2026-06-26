#!/usr/bin/env python3
"""用GitPython clone KJNodes（不走学术代理，直连GitHub）"""
import subprocess, os

# 清除代理设置
env = os.environ.copy()
for key in ['http_proxy', 'https_proxy', 'HTTP_PROXY', 'HTTPS_PROXY']:
    env.pop(key, None)

dest = "/root/autodl-tmp/ComfyUI/custom_nodes/ComfyUI-KJNodes"
if os.path.exists(dest):
    print("KJNodes already exists, skipping")
else:
    result = subprocess.run(
        ["git", "clone", "--depth", "1", "https://github.com/comfyanonymous/ComfyUI-KJNodes.git", dest],
        env=env, capture_output=True, timeout=120
    )
    print(f"stdout: {result.stdout.decode()[:200]}")
    print(f"stderr: {result.stderr.decode()[:200]}")
    print(f"exit: {result.returncode}")

if os.path.exists(dest + "/__init__.py"):
    print("SUCCESS: KJNodes installed")
else:
    print("FAILED: KJNodes not installed")
