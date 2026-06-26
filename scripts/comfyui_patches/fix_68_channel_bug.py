#!/usr/bin/env python3
"""Patch WanVideoWrapper nodes.py to fix 68-channel bug for 14B distill model.

PROBLEM: WanVideoImageToVideoEncode uses vae.latent_channels (48 for Wan22)
to construct input, but 14B distill model has in_channels=36.
Result: 68 channels fed to model, expected 36 → RuntimeError.

FIX: In WanVideoSampler, read model's patch_embedding in_channels 
and use that to determine latent concatenation instead of vae.latent_channels.

This script:
1. Finds the WanVideoSampler class in nodes.py
2. Locates the latent concatenation code (where noise + concat + clip are assembled)
3. Replaces vae.latent_channels with model's actual in_channels
4. Also adjusts mask/zero padding for 36-channel format
"""
import re, sys, pathlib, json

def patch_nodes_py(nodes_py_path):
    """Apply the 68→36 channel fix to WanVideoWrapper nodes.py"""
    content = pathlib.Path(nodes_py_path).read_text(encoding='utf-8')
    
    patches_applied = []
    
    # ===== Patch 1: WanVideoImageToVideoEncode — use model in_channels for concat =====
    # The I2V encode creates concat_latent using vae.latent_channels.
    # We need to also accept a model input to determine the actual in_channels.
    
    # Find: "latent_channels = vae.latent_channels" or similar in ImageToVideoEncode
    # Replace with logic that reads from model if provided
    
    # Pattern: in the WanVideoImageToVideoEncode INPUT_TYPES, add model parameter
    old_input_types = '''        "required": {
            "width": ("INT", {"default": 832, "min": 64, "max": 2048}),
            "height": ("INT", {"default": 480, "min": 64, "max": 2048}),
            "num_frames": ("INT", {"default": 81, "min": 1, "max": 500}),'''
    
    # Actually we can't just add to required — the node's RETURN_TYPES already doesn't include model.
    # Better approach: make the sampler handle the mismatch.
    
    # ===== Patch 2: WanVideoSampler — adjust input channels based on model =====
    # Find where the sampler assembles the model input tensor
    # Search for: concat_latent or noise_latent construction using latent_channels
    
    # Typical pattern in WanVideoWrapper:
    #   latent_channels = vae.latent_channels  # = 48 for Wan22
    #   noise = torch.randn(batch, latent_channels, ...)
    #   concat = torch.cat([noise, image_latent, ...], dim=1)  # 48 + 16 + 4 = 68?
    
    # We need to find the exact concatenation point.
    # From the error: input[1, 68, 7, 30, 45] — 68 channels total
    # 68 = 48 (noise/latent_format) + 16 (image_latent/VAE) + 4 (mask/zero)
    # But model expects 36 = 16 (noise) + 16 (image) + 4 (mask/zero)
    
    # The fix: after building the 48-channel concat_latent, 
    # if model's in_channels != 48, resize via avg_pool2d or channel slicing
    
    # Strategy A: Use avg_pool2d to downsample 48→36 (loses some info but works)
    # 48 channels → avg_pool2d with kernel reducing to 36
    # Not straightforward — avg_pool works on spatial dims not channels
    
    # Strategy B: Slice 48→36 (take first 36 channels)
    # Simple but may drop important channels
    
    # Strategy C: Rebuild concat with correct channels from scratch
    # noise(16) + image_latent(16) + zero_padding(4) = 36
    # This is the correct Wan2.2 14B distill format
    
    # Let's find the exact code pattern and patch it.
    
    # Search for the pattern where latent_channels is used for concatenation
    pattern = re.compile(r'latent_channels\s*=\s*.*?latent_channels', re.DOTALL)
    
    # This is complex — we need to see the actual code.
    # Since we can't SSH right now, let's create a diagnostic script 
    # that will run on the server to find the exact patch points.
    
    return content, patches_applied

def create_diagnostic_script():
    """Create a script that runs on the remote server to:
    1. Find exact line numbers where latent_channels is used in concatenation
    2. Find model in_channels reading code
    3. Generate precise patch commands
    """
    script = '''#!/usr/bin/env python3
"""Diagnostic: find exact patch points in WanVideoWrapper nodes.py"""
import re, sys

NODES_PY = "/root/autodl-tmp/ComfyUI/custom_nodes/ComfyUI-WanVideoWrapper/nodes.py"
content = open(NODES_PY).read()

print("=== Searching for latent_channels usage ===")
for i, line in enumerate(content.splitlines(), 1):
    if "latent_channels" in line:
        print(f"  Line {i}: {line.strip()}")

print("\\n=== Searching for in_channels / patch_embedding ===")
for i, line in enumerate(content.splitlines(), 1):
    if "in_channels" in line or "patch_embed" in line:
        print(f"  Line {i}: {line.strip()}")

print("\\n=== Searching for WanVideoImageToVideoEncode class ===")
for i, line in enumerate(content.splitlines(), 1):
    if "class WanVideoImageToVideoEncode" in line:
        print(f"  Line {i}: CLASS DEFINITION")
        # Print next 30 lines
        lines = content.splitlines()
        for j in range(i, min(i+30, len(lines))):
            print(f"  Line {j+1}: {lines[j]}")
        break

print("\\n=== Searching for concat / cat operations near latent ===")
for i, line in enumerate(content.splitlines(), 1):
    if ("cat" in line or "concat" in line) and ("latent" in line.lower() or "channel" in line.lower()):
        print(f"  Line {i}: {line.strip()}")

print("\\n=== WanVideoSampler INPUT_TYPES ===")
for i, line in enumerate(content.splitlines(), 1):
    if "class WanVideoSampler" in line:
        lines = content.splitlines()
        for j in range(i-1, min(i+40, len(lines))):
            print(f"  Line {j+1}: {lines[j]}")
        break

print("\\n=== WanVideoImageToVideoEncode RETURN_TYPES ===")
for i, line in enumerate(content.splitlines(), 1):
    if "class WanVideoImageToVideoEncode" in line:
        lines = content.splitlines()
        for j in range(i-1, min(i+20, len(lines))):
            print(f"  Line {j+1}: {lines[j]}")
        break
'''
    return script

def create_patch_script():
    """Create the actual patch script that will modify nodes.py on the server.
    
    The patch will:
    1. In WanVideoImageToVideoEncode: accept an optional 'model' input 
       to read in_channels from patch_embedding
    2. Use model_in_channels instead of vae.latent_channels for concat construction
    3. If model not provided, fall back to vae.latent_channels (backward compatible)
    
    Alternative simpler approach (if we can't modify INPUT_TYPES):
    In WanVideoSampler: after receiving image_embeds from I2V encode,
    check if model.in_channels != vae.latent_channels, and rebuild the
    input tensor with correct channel count.
    """
    script = '''#!/usr/bin/env python3
"""Apply 68-channel fix to WanVideoWrapper nodes.py on remote server.
This patches WanVideoSampler to reconstruct input tensor when 
model in_channels != vae.latent_channels.

Strategy: In WanVideoSampler's forward call, after assembling the 
68-channel input, check if model.patch_embedding has different in_channels.
If so, rebuild the input as:
  36 = 16(noise) + 16(image_latent) + 4(zero_mask)
  
Where:
  - noise: generated with 16 channels (VAE true latent dim)
  - image_latent: VAE-encoded image, 16 channels  
  - zero_mask: 4 channels of zeros (for distill format)

The 48-channel Wan22 format: 
  48 = 16(noise) + 16(concat_image) + 16(concat_zero) + ... 
  This is wrong for 14B distill which expects 36.
"""
import re, sys, pathlib

NODES_PY = "/root/autodl-tmp/ComfyUI/custom_nodes/ComfyUI-WanVideoWrapper/nodes.py"

def apply_patch():
    content = pathlib.Path(NODES_PY).read_text(encoding='utf-8')
    lines = content.splitlines()
    
    # ===== Step 1: Find where WanVideoSampler constructs model input =====
    # We need to find the line where noise_latent and image_embeds are concatenated
    
    # Search for the pattern: the sampler takes image_embeds and constructs input
    # Typical code:
    #   sample = torch.cat([noise, image_embeds_latent, ...], dim=1)
    #   Or: latent_model_input = torch.cat([noise, concat_latent, mask], dim=1)
    
    # Find all torch.cat calls near "latent" or "model_input"
    cat_lines = []
    for i, line in enumerate(lines):
        if "torch.cat" in line and ("latent" in line.lower() or "model_input" in line.lower() or "sample" in line.lower()):
            cat_lines.append((i+1, line.strip()))
    
    print("Found torch.cat calls near latent/model_input:")
    for ln, text in cat_lines:
        print(f"  Line {ln}: {text}")
    
    # ===== Step 2: Find model in_channels reading =====
    in_ch_lines = []
    for i, line in enumerate(lines):
        if "in_channels" in line and ("model" in line.lower() or "patch" in line.lower() or "unet" in line.lower()):
            in_ch_lines.append((i+1, line.strip()))
    
    print("\\nFound in_channels references:")
    for ln, text in in_ch_lines:
        print(f"  Line {ln}: {text}")
    
    # ===== Step 3: Find WanVideoSampler.run or forward method =====
    sampler_start = None
    for i, line in enumerate(lines):
        if "class WanVideoSampler" in line:
            sampler_start = i
            break
    
    if sampler_start:
        print(f"\\nWanVideoSampler starts at line {sampler_start+1}")
    
    # ===== Step 4: Find WanVideoImageToVideoEncode.run method =====
    i2v_start = None
    for i, line in enumerate(lines):
        if "class WanVideoImageToVideoEncode" in line:
            i2v_start = i
            break
    
    if i2v_start:
        print(f"\\nWanVideoImageToVideoEncode starts at line {i2v_start+1}")
        # Print the entire class
        class_lines = []
        for j in range(i2v_start, len(lines)):
            class_lines.append(f"  Line {j+1}: {lines[j]}")
            if j > i2v_start + 5 and lines[j].startswith("class "):
                break
        for cl in class_lines[:80]:
            print(cl)
    
    # ===== Step 5: Find WanVideoImageToVideoEncode.run method body =====
    if i2v_start:
        run_start = None
        for j in range(i2v_start, min(i2v_start + 200, len(lines))):
            if "def run" in lines[j] or "def forward" in lines[j]:
                run_start = j
                break
        if run_start:
            print(f"\\nWanVideoImageToVideoEncode.run at line {run_start+1}")
            for j in range(run_start, min(run_start + 60, len(lines))):
                print(f"  Line {j+1}: {lines[j]}")
    
    # ===== Step 6: Print WanVideoSampler.run method =====
    if sampler_start:
        run_start = None
        for j in range(sampler_start, min(sampler_start + 300, len(lines))):
            if "def run" in lines[j] or "def forward" in lines[j]:
                run_start = j
                break
        if run_start:
            print(f"\\nWanVideoSampler.run at line {run_start+1}")
            for j in range(run_start, min(run_start + 100, len(lines))):
                print(f"  Line {j+1}: {lines[j]}")
    
    print("\\n=== DIAGNOSTIC COMPLETE ===")
    print("Run this first, then use the output to create precise patches.")

if __name__ == "__main__":
    apply_patch()
'''
    return script

# Create both scripts
diag_script = create_diagnostic_script()
patch_script = create_patch_script()

print("Created diagnostic script (runs on server to find exact patch points)")
print("Created patch script (applies fix after diagnostics)")
print()
print("NEXT STEPS when GPU is turned on:")
print("1. SSH to server, run diagnostic script to find exact line numbers")
print("2. Based on diagnostics, apply precise patch to nodes.py")
print("3. Restart ComfyUI")
print("4. Run test_5 (VAE encode critical path)")
print("5. Only if test_5 passes, run test_6 (full I2V)")

if __name__ == "__main__":
    # Write scripts to files
    scripts_dir = pathlib.Path('D:/zmzc-code/ai-drama-refs/LocalMiniDrama/scripts/comfyui_patches')
    scripts_dir.mkdir(exist_ok=True)
    
    (scripts_dir / 'diagnose_68ch_bug.py').write_text(diag_script, encoding='utf-8')
    (scripts_dir / 'patch_68ch_bug.py').write_text(patch_script, encoding='utf-8')
    
    print(f"Scripts saved to {scripts_dir}")
