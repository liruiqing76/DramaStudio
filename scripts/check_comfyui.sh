#!/bin/bash

# 使用 expect 自动输入密码并执行命令
/usr/bin/expect << 'EOF'
set timeout 30

spawn ssh -p 23011 root@connect.westc.seetacloud.com

expect {
    "yes/no" {
        send "yes\r"
        exp_continue
    }
    "*password:*" {
        send "T9Erp7FBQgdk\r"
    }
}

expect "*#*" {
    send "echo '=== ComfyUI Process Check ==='\r"
}

expect "*#*" {
    send "ps aux | grep -i comfy | grep -v grep\r"
}

expect "*#*" {
    send "echo '=== Port 8188 Check ==='\r"
}

expect "*#*" {
    send "netstat -tlnp 2>/dev/null | grep 8188 || ss -tlnp 2>/dev/null | grep 8188 || echo '8188 not listening'\r"
}

expect "*#*" {
    send "echo '=== Disk Space ==='\r"
}

expect "*#*" {
    send "df -h\r"
}

expect "*#*" {
    send "exit\r"
}

expect eof
EOF
