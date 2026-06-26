import av, numpy as np
path = "/root/autodl-tmp/ComfyUI/output/wan21_person_81f_00001_.mp4"
c = av.open(path)
vs = c.streams.video[0]
print(f"codec={vs.codec_context.name} pix_fmt={vs.codec_context.pix_fmt}")
print(f"frames={vs.frames} width={vs.codec_context.width} height={vs.codec_context.height}")
for i, frame in enumerate(c.decode(video=0)):
    img = frame.to_ndarray(format='rgb24')
    colors = len(np.unique(img.reshape(-1,3), axis=0))
    stds = img.std(axis=(0,1))
    means = img.mean(axis=(0,1))
    if i in [0, 20, 40, 60, 80]:
        print(f"  F{i}: colors={colors} std={stds.round(1)} mean={means.round(1)}")
    if i >= 80:
        break
