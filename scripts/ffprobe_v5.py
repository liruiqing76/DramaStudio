import subprocess, json

result = subprocess.run(["ffprobe", "-v", "quiet", "-print_format", "json",
    "-show_format", "-show_streams", "test_cfg5_v5_00001_.mp4"],
    capture_output=True, text=True, cwd="/root/autodl-tmp/ComfyUI/output")

if result.returncode != 0:
    print(f"ffprobe error: {result.stderr}")
    # Try path with absolute
    result = subprocess.run(["ffprobe", "-v", "quiet", "-print_format", "json",
        "-show_format", "-show_streams", "/root/autodl-tmp/ComfyUI/output/test_cfg5_v5_00001_.mp4"],
        capture_output=True, text=True)

d = json.loads(result.stdout)
vs = [s for s in d["streams"] if s.get("codec_type") == "video"]
v = vs[0] if vs else {}
print(f"size={d['format']['size']} duration={d['format']['duration']}")
print(f"w={v.get('width','?')} h={v.get('height','?')} frames={v.get('nb_frames','?')} codec={v.get('codec_name','?')}")
