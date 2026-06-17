#!/bin/bash

/usr/bin/expect << 'EOF'
set timeout 60

spawn ssh -p 23011 root@connect.westc.seetacloud.com

expect "*password:*" {
    send "T9Erp7FBQgdk\r"
}

expect "*#*" {
    send "echo '=== Checking boot script ==='\r"
}

expect "*#*" {
    send "cat /root/comfyui_boot.sh\r"
}

expect "*#*" {
    send "echo '=== Starting ComfyUI in background ==='\r"
}

expect "*#*" {
    send "cd /root && chmod +x comfyui_boot.sh && bash comfyui_boot.sh &\r"
}

expect "*#*" {
    send "sleep 10 && echo '=== Checking if ComfyUI started ==='\r"
}

expect "*#*" {
    send "ps aux | grep -i comfy | grep -v grep\r"
}

expect "*#*" {
    send "netstat -tlnp 2>/dev/null | grep 8188 || ss -tlnp 2>/dev/null | grep 8188\r"
}

expect "*#*" {
    send "exit\r"
}

expect eof
EOF
