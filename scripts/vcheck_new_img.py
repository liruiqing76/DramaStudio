import av, numpy as np
path = "/root/autodl-tmp/ComfyUI/output/wan21_new_img_00001_.mp4"
c = av.open(path)
vs = c.streams.video[0]
print(f"codec={vs.codec_context.name}, pix_fmt={vs.codec_context.pix_fmt}, size={vs.width}x{vs.height}, frames={vs.frames}")

for i, frame in enumerate(c.decode(video=0)):
    a = frame.to_ndarray(format='rgb24')
    colors = len(np.unique(a.reshape(-1, 3), axis=0))
    print(f"Frame{i}: shape={a.shape}, colors={colors}, meanRGB=({a[:,:,0].mean():.1f},{a[:,:,1].mean():.1f},{a[:,:,2].mean():.1f}), std=({a[:,:,0].std():.1f},{a[:,:,1].std():.1f},{a[:,:,2].std():.1f})")
    if i >= 15:
        break
