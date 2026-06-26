import av, numpy as np
for f in ["wan21_official_41f_00001_.mp4", "wan21_official_params_00001_.mp4"]:
    path = f"/root/autodl-tmp/ComfyUI/output/{f}"
    try:
        c = av.open(path)
        frame = next(c.decode(video=0))
        a = frame.to_ndarray()
        print(f"{f}: dtype={a.dtype}, shape={a.shape}, ndim={a.ndim}")
        if a.ndim == 2:
            # grayscale or single channel
            colors = len(np.unique(a))
            print(f"  GRAY: colors={colors}, mean={a.mean():.1f}, std={a.std():.1f}")
        elif a.ndim == 3:
            colors = len(np.unique(a.reshape(-1, a.shape[2]), axis=0))
            print(f"  RGB: colors={colors}, meanRGB=({a[:,:,0].mean():.1f},{a[:,:,1].mean():.1f},{a[:,:,2].mean():.1f})")
    except Exception as e:
        print(f"{f}: ERROR {e}")
