#!/usr/bin/env python3
"""在容器环境中设置 ComfyUI 开机自启动"""
import subprocess, os, sys

def run(cmd):
    try:
        return subprocess.check_output(cmd, shell=True, stderr=subprocess.STDOUT, text=True).strip()
    except subprocess.CalledProcessError as e:
        return f"[FAILED: {e.returncode}] {e.output.strip()}"

def main():
    print("=== ComfyUI 自启动设置 ===")
    print()

    # 1. 检查 crond 是否可用
    print("[1] 检查 crond 服务...")
    cron_status = run("ps aux | grep -E 'crond|cron' | grep -v grep")
    if not cron_status:
        print("  [!] crond 未运行，尝试启动...")
        out = run("crond 2>&1; echo EXIT:$?")
        print(f"  {out}")
        cron_check = run("ps aux | grep crond | grep -v grep")
        if not cron_check:
            print("  [X] crond 无法启动，尝试备用方案")
            use_cron = False
        else:
            print("  [OK] crond 已启动")
            use_cron = True
    else:
        print(f"  [OK] crond 运行中: {cron_status}")
        use_cron = True

    # 2. 创建自启动脚本
    print("\n[2] 创建 ComfyUI 自启动脚本...")
    boot_script = "/root/comfyui_boot.sh"
    with open(boot_script, "w") as f:
        f.write("""#!/bin/bash
# ComfyUI 开机自启动脚本 (AutoDL/SeetaCloud 容器环境)
set -e

# 等待网络就绪
for i in $(seq 1 30); do
    if ping -c1 -W1 8.8.8.8 >/dev/null 2>&1; then break; fi
    sleep 2
done

# 等待 GPU 就绪
for i in $(seq 1 30); do
    if nvidia-smi >/dev/null 2>&1; then break; fi
    sleep 2
done

export PATH="/root/miniconda3/bin:$PATH"
export CUDA_VISIBLE_DEVICES=0
export PYTHONUNBUFFERED=1

# 杀掉旧进程
fuser -k 8188/tcp 2>/dev/null || true
sleep 2

echo "[$(date)] ComfyUI auto-starting..."
cd /root/ComfyUI
exec /root/miniconda3/bin/python3.10 main.py --listen 0.0.0.0 --port 8188 >> /tmp/comfyui_boot.log 2>&1
""")
    os.chmod(boot_script, 0o755)
    print(f"  [OK] 已创建 {boot_script}")

    # 3. 设置 crontab @reboot
    if use_cron:
        print("\n[3] 设置 crontab @reboot...")
        cron_line = f"@reboot sleep 10 && nohup /bin/bash {boot_script} &"
        try:
            existing = subprocess.check_output(["crontab", "-l"], text=True)
        except subprocess.CalledProcessError:
            existing = ""
        
        if cron_line in existing:
            print("  [OK] crontab 已存在，跳过")
        else:
            new_crontab = existing.strip() + "\n" + cron_line + "\n"
            subprocess.run(["crontab", "-"], input=new_crontab, text=True)
            print(f"  [OK] crontab 已添加")
        
        result = subprocess.check_output(["crontab", "-l"], text=True)
        print(f"  当前 crontab:\n{result}")
    else:
        print("\n[3] crond 不可用，尝试写入 /init/boot/ 钩子...")
        boot_dir = "/init/boot/others"
        if os.path.isdir(boot_dir):
            hook_file = os.path.join(boot_dir, "comfyui.sh")
            with open(hook_file, "w") as f:
                f.write(f"""#!/bin/bash
nohup /bin/bash {boot_script} > /tmp/comfyui_hook.log 2>&1 &
""")
            os.chmod(hook_file, 0o755)
            print(f"  [OK] 已写入启动钩子: {hook_file}")
        else:
            print("  [!] /init/boot/others 不存在")
            print("  [*] 尝试写入 root 的 .bashrc...")
            with open("/root/.bashrc", "a") as f:
                f.write(f"\n# ComfyUI auto-start\nif [ -z \"$COMFYUI_STARTED\" ]; then\n  export COMFYUI_STARTED=1\n  nohup /bin/bash {boot_script} > /tmp/comfyui_boot.log 2>&1 &\nfi\n")
            print("  [OK] 已添加 .bashrc 自启动（首次 SSH 登录时自动启动）")

    # 4. 验证
    print("\n=== 设置完成 ===")
    print()
    print(f"  启动脚本: {boot_script}")
    print(f"  日志文件: /tmp/comfyui_boot.log")
    print(f"  下次开机后检查: curl http://localhost:8188/system_stats")
    print()

if __name__ == "__main__":
    main()
