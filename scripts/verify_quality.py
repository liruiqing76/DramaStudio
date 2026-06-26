import cv2
from collections import Counter

cap = cv2.VideoCapture("/root/autodl-tmp/ComfyUI/output/test_cfg5_v5_00001_.mp4")
w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
n = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
print(f"Video: {w}x{h} {n} frames")

# Check frame 0
ret, frame = cap.read()
if ret:
    pixels = frame.reshape(-1, 3)
    unique = len(set(tuple(p) for p in pixels))
    print(f"Frame0 unique colors: {unique}")
    avg = pixels.mean(axis=0)
    print(f"Frame0 avg: R={avg[0]:.0f} G={avg[1]:.0f} B={avg[2]:.0f}")
    # Check if all same color
    first_pixel = tuple(pixels[0])
    all_same = all(tuple(p) == first_pixel for p in pixels[:100])
    print(f"Frame0 first 100 pixels all same color: {all_same}")
else:
    print("Cannot read frame 0")

# Check frame 20
cap.set(cv2.CAP_PROP_POS_FRAMES, 20)
ret, frame = cap.read()
if ret:
    pixels = frame.reshape(-1, 3)
    unique = len(set(tuple(p) for p in pixels))
    print(f"Frame20 unique colors: {unique}")
    avg = pixels.mean(axis=0)
    print(f"Frame20 avg: R={avg[0]:.0f} G={avg[1]:.0f} B={avg[2]:.0f}")

# Check last frame
cap.set(cv2.CAP_PROP_POS_FRAMES, n-1)
ret, frame = cap.read()
if ret:
    pixels = frame.reshape(-1, 3)
    unique = len(set(tuple(p) for p in pixels))
    print(f"Frame{n-1} unique colors: {unique}")
    avg = pixels.mean(axis=0)
    print(f"Frame{n-1} avg: R={avg[0]:.0f} G={avg[1]:.0f} B={avg[2]:.0f}")

cap.release()

# File size
import os
fsize = os.path.getsize("/root/autodl-tmp/ComfyUI/output/test_cfg5_v5_00001_.mp4")
print(f"File size: {fsize} bytes ({fsize/1024:.1f} KB)")
