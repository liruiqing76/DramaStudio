import subprocess, time, sys

# Kill old
subprocess.run("fuser -k 8188/tcp 2>/dev/null", shell=True)
time.sleep(2)

# Start ComfyUI
proc = subprocess.Popen(
    ["/root/miniconda3/bin/python3.10", "main.py", "--listen", "0.0.0.0", "--port", "8188"],
    cwd="/root/ComfyUI",
    stdout=open("/tmp/comfyui_boot.log", "a"),
    stderr=subprocess.STDOUT
)
print(f"PID={proc.pid}")

# Wait for startup
for i in range(60):
    time.sleep(5)
    try:
        r = subprocess.run(["curl", "-s", "-o", "/dev/null", "-w", "%{http_code}", "http://localhost:8188/system_stats"],
                         capture_output=True, text=True, timeout=5)
        if "200" in r.stdout:
            print(f"UP! ({(i+1)*5}s)")
            sys.exit(0)
    except:
        pass
    print(f"[{(i+1)*5}s] waiting...")

print("TIMEOUT")
sys.exit(1)
