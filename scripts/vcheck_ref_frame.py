import av, numpy as np
c = av.open("/root/autodl-tmp/ComfyUI/output/wan21_ref_frame_00001_.mp4")
vs = c.streams.video[0]
print(f"codec={vs.codec_context.name} {vs.width}x{vs.height} frames={vs.frames}")

f0 = next(c.decode(vs))
rgb = f0.to_ndarray(format="rgb24")
print(f"Frame0: {rgb.shape} colors={len(np.unique(rgb.reshape(-1,3),axis=0))} mean={rgb.mean(axis=(0,1)).round(1)} std={rgb.std(axis=(0,1)).round(1)}")

fl = list(c.decode(vs))
fn = fl[len(fl)//2]
r2 = fn.to_ndarray(format="rgb24")
print(f"MidFrame: colors={len(np.unique(r2.reshape(-1,3),axis=0))} mean={r2.mean(axis=(0,1)).round(1)} std={r2.std(axis=(0,1)).round(1)}")
print(f"Total frames decoded: {len(fl)+1}")

# Frame-to-frame motion diff
diffs = []
prev = rgb
for i, fr in enumerate(fl[:10]):
    cur = fr.to_ndarray(format="rgb24")
    d = np.abs(cur.astype(float) - prev.astype(float)).mean()
    diffs.append(round(d, 2))
    prev = cur
print(f"Frame diffs(0-10): {diffs}")
