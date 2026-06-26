import pathlib

# Fix both copies of model.py
for base in ["/root/autodl-tmp/ComfyUI", "/root/ComfyUI"]:
    p = pathlib.Path(f"{base}/custom_nodes/ComfyUI-WanVideoWrapper/wanvideo/modules/model.py")
    if not p.exists():
        print(f"SKIP: {p}")
        continue
    lines = p.read_text().splitlines()
    # Fix the PATCHED line - wrong indentation (12 spaces should be 8)
    for i, line in enumerate(lines):
        if "if True:  # PATCHED" in line:
            # Count leading spaces
            spaces = len(line) - len(line.lstrip())
            # Original was 8 spaces, not 12
            lines[i] = "        if True:  # PATCHED: always process img_emb"
            print(f"FIXED {p}: line {i+1}, old_spaces={spaces}, new=8")
            break
    p.write_text("\n".join(lines))
