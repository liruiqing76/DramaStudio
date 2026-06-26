import os
os.environ["HF_ENDPOINT"] = "https://hf-mirror.com"
from huggingface_hub import hf_hub_download

# Try Kijai repo first - this is the common WanVideoWrapper recommended source
repos = [
    ("Kijai/UMT5_xxl_fp8_e4m3fn_safetensors", "umt5_xxl_fp8_e4m3fn.safetensors"),
    ("comfyanonymous/umt5_xxl_fp8_e4m3fn_enc", "umt5_xxl_fp8_e4m3fn_enc.safetensors"),
]

dest = "/root/autodl-tmp/comfyui_models/text_encoders"
for repo_id, filename in repos:
    try:
        print(f"Trying {repo_id}/{filename}...")
        f = hf_hub_download(repo_id, filename, local_dir=dest)
        print(f"SUCCESS: Downloaded to {f}")
        break
    except Exception as e:
        print(f"FAILED {repo_id}: {str(e)[:200]}")
        continue
