import av, numpy as np
for f in ["wan21_official_41f_00001_.mp4", "wan21_official_params_00001_.mp4"]:
    path = f"/root/autodl-tmp/ComfyUI/output/{f}"
    try:
        c = av.open(path)
        # Check stream info
        vs = c.streams.video[0]
        print(f"{f}: codec={vs.codec_context.name}, pix_fmt={vs.codec_context.pix_fmt}, size={vs.width}x{vs.height}, frames={vs.frames}")
        
        # Try RGB decode
        for i, frame in enumerate(c.decode(video=0)):
            if i == 0:
                a = frame.to_ndarray(format='rgb24')
                print(f"  Frame0 RGB: shape={a.shape}, dtype={a.dtype}")
                colors = len(np.unique(a.reshape(-1, 3), axis=0))
                print(f"  RGB colors={colors}, mean=({a[:,:,0].mean():.1f},{a[:,:,1].mean():.1f},{a[:,:,2].mean():.1f}), std=({a[:,:,0].std():.1f},{a[:,:,1].std():.1f},{a[:,:,2].std():.1f})")
                # Check if all channels are same (grayscale masquerading as RGB)
                diff_rg = np.abs(a[:,:,0].astype(int) - a[:,:,1].astype(int))
                diff_rb = np.abs(a[:,:,0].astype(int) - a[:,:,2].astype(int))
                print(f"  R-G diff: mean={diff_rg.mean():.1f}, max={diff_rg.max()}")
                print(f"  R-B diff: mean={diff_rb.mean():.1f}, max={diff_rb.max()}")
            if i == 10:
                a10 = frame.to_ndarray(format='rgb24')
                colors10 = len(np.unique(a10.reshape(-1, 3), axis=0))
                print(f"  Frame10 RGB colors={colors10}, mean=({a10[:,:,0].mean():.1f},{a10[:,:,1].mean():.1f},{a10[:,:,2].mean():.1f})")
            if i >= 10:
                break
    except Exception as e:
        print(f"{f}: ERROR {e}")
