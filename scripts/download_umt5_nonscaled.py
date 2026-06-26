import os
os.environ["HF_ENDPOINT"] = "https://hf-mirror.com"
from huggingface_hub import hf_hub_download

f = hf_hub_download(
    "realung/umt5-xxl-enc-fp8_e4m3fn.safetensors",
    "umt5-xxl-enc-fp8_e4m3fn.safetensors",
    local_dir="/root/autodl-tmp/comfyui_models/text_encoders"
)
print(f"Downloaded to: {f}")

# Create symlink in ComfyUI models dir
import os
src = "/root/autodl-tmp/comfyui_models/text_encoders/umt5-xxl-enc-fp8_e4m3fn.safetensors"
dst = "/root/autodl-tmp/ComfyUI/models/text_encoders/umt5-xxl-enc-fp8_e4m3fn.safetensors"
if not os.path.exists(dst):
    os.symlink(src, dst)
    print(f"Symlink created: {dst} -> {src}")
else:
    print(f"Symlink already exists: {dst}")
