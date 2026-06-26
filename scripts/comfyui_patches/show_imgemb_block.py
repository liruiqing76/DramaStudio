MODEL_PY = "/root/autodl-tmp/ComfyUI/custom_nodes/ComfyUI-WanVideoWrapper/wanvideo/modules/model.py"
lines = open(MODEL_PY).read().splitlines()

# Find the complete clip_fea/img_emb block (L2825-2845 range)
for i in range(2819, min(2850, len(lines))):
    print(f"L{i+1}: {lines[i]}")
