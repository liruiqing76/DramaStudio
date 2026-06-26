MODEL_PY = "/root/autodl-tmp/ComfyUI/custom_nodes/ComfyUI-WanVideoWrapper/wanvideo/modules/model.py"
lines = open(MODEL_PY).read().splitlines()

# Fix L2836 indentation (0-indexed 2835): add 4 spaces for if block
lines[2835] = "                        clip_embed += self.img_emb(clip_fea_c.to(self.main_device))"
open(MODEL_PY, "w").write("\n".join(lines))
print("Fixed indentation!")

import ast
ast.parse(open(MODEL_PY).read())
print("Syntax OK!")

import os, time, urllib.request
os.system("pkill -f 'python main.py' 2>/dev/null")
time.sleep(3)
os.system("cd /root/autodl-tmp/ComfyUI && nohup /root/miniconda3/bin/python main.py --listen 0.0.0.0 --port 8188 > /tmp/comfyui_fix2.log 2>&1 &")
time.sleep(15)
resp = urllib.request.urlopen("http://127.0.0.1:8188/object_info/WanVideoModelLoader")
print("WanVideoWrapper loaded!")
