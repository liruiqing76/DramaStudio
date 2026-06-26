#!/usr/bin/env python3
import json
with open("/root/autodl-tmp/ComfyUI/user/default/workflows/wan21_fp8_i2v.json") as f:
    d = json.load(f)
print(json.dumps(d, indent=2))
