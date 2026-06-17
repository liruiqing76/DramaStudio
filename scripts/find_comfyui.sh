#!/bin/bash

/usr/bin/expect << 'EOF'
set timeout 30

spawn ssh -p 23011 root@connect.westc.seetacloud.com

expect "*password:*" {
    send "T9Erp7FBQgdk\r"
}

expect "*#*" {
    send "echo '=== Finding ComfyUI ==='\r"
}

expect "*#*" {
    send "find /root -name 'ComfyUI' -type d 2>/dev/null\r"
}

expect "*#*" {
    send "find /root -name 'main.py' -path '*/ComfyUI/*' 2>/dev/null\r"
}

expect "*#*" {
    send "ls -la /root/ | grep -i comfy\r"
}

expect "*#*" {
    send "ls -la /root/autodl-tmp/ | grep -i comfy\r"
}

expect "*#*" {
    send "which comfy || echo 'comfy not in PATH'\r"
}

expect "*#*" {
    send "exit\r"
}

expect eof
EOF
