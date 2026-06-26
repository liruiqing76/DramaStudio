filepath = "/root/autodl-tmp/ComfyUI/custom_nodes/ComfyUI-WanVideoWrapper/nodes_model_loading.py"
with open(filepath, "r") as f:
    lines = f.readlines()

# First, revert the wrongly inserted line at ~1192 area (main model loader)
# It should say: sd = {k:v for k,v in sd.items() if k != "scaled_fp8"}  # PATCH: remove scaled marker
reverted = 0
for i, line in enumerate(lines):
    if 'PATCH: remove scaled marker' in line:
        lines[i] = ''  # remove this line
        reverted += 1
        print(f"REVERTED wrong insert at line {i+1}")

# Now find the correct location: inside LoadWanVideoT5TextEncoder.loadmodel()
# The raise ValueError we already patched to log.warning is at ~1988
# We need to find "scaled_fp8" in sd check NEAR that line (within the T5 encoder class)
# and add the removal AFTER the log.warning line
for i, line in enumerate(lines):
    if 'fp8 scaled T5 detected' in line:
        # Insert removal of scaled_fp8 key right after the warning
        indent = len(line) - len(line.lstrip())
        spaces = ' ' * indent
        new_line = spaces + 'sd = {k:v for k,v in sd.items() if k != "scaled_fp8"}  # PATCH: remove scaled marker for T5\n'
        lines.insert(i + 1, new_line)
        print(f"INSERTED at line {i+2}: remove scaled_fp8 key in T5 loader")
        break

with open(filepath, "w") as f:
    f.writelines(lines)
print(f"Fix applied. Reverted {reverted} wrong inserts.")
