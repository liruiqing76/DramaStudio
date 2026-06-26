import os
os.environ["HF_ENDPOINT"] = "https://hf-mirror.com"
from huggingface_hub import hf_hub_download

f = hf_hub_download(
    "cityhill/umt5-xxl-encoder",
    "umt5_xxl_fp8_e4m3fn.safetensors",
    local_dir="/root/autodl-tmp/comfyui_models/text_encoders"
)
print(f"Downloaded to: {f}")
