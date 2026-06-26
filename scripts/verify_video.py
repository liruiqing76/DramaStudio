#!/usr/bin/env python3
"""Verify video quality - check frame count, resolution, unique colors"""
import subprocess, json, os

for f in ["wan21_exact_v1_00001_.webm", "wan21_exact_v2_00001_.mp4"]:
    fp = f"/root/autodl-tmp/ComfyUI/output/{f}"
    if not os.path.exists(fp):
        print(f"{f}: NOT FOUND")
        continue
    sz = os.path.getsize(fp)
    print(f"\n{f}: {sz/1024:.0f}KB")
    
    # Try cv2 first, then ffprobe
    try:
        import cv2
        cap = cv2.VideoCapture(fp)
        n = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        fps = cap.get(cv2.CAP_PROP_FPS)
        print(f"  cv2: {n} frames, {w}x{h}, {fps:.1f}fps")
        
        # Read first frame and count unique colors
        ret, frame = cap.read()
        if ret:
            import numpy as np
            # Downsample to speed up unique counting
            flat = frame.reshape(-1, 3)
            # Sample 10000 pixels
            idx = np.random.choice(len(flat), min(10000, len(flat)), replace=False)
            sample = flat[idx]
            unique = len(np.unique(sample, axis=0))
            print(f"  First frame unique colors (10K sample): {unique}")
            
            # Read middle frame
            cap.set(cv2.CAP_PROP_POS_FRAMES, n // 2)
            ret2, frame2 = cap.read()
            if ret2:
                flat2 = frame2.reshape(-1, 3)
                idx2 = np.random.choice(len(flat2), min(10000, len(flat2)), replace=False)
                unique2 = len(np.unique(flat2[idx2], axis=0))
                print(f"  Middle frame unique colors (10K sample): {unique2}")
        cap.release()
    except ImportError:
        print("  cv2 not available, trying ffprobe...")
        try:
            r = subprocess.run(["ffprobe", "-v", "quiet", "-print_format", "json", "-show_streams", fp],
                             capture_output=True, text=True, timeout=10)
            if r.returncode == 0:
                d = json.loads(r.stdout)
                for s in d.get("streams", []):
                    print(f"  {s.get('codec_name','?')} {s.get('width','?')}x{s.get('height','?')} {s.get('nb_frames','?')}frames {s.get('duration','?')}s")
        except Exception as e:
            print(f"  ffprobe err: {e}")
