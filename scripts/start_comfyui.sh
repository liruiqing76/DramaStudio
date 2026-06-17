#!/bin/bash

/usr/bin/expect << 'EOF'
set timeout 60

spawn ssh -p 23011 root@connect.westc.seetacloud.com

expect "*password:*" {
    send "T9Erp7FBQgdk\r"
}

expect "*#*" {
    send "echo '=== Starting ComfyUI ==='\r"
}

expect "*#*" {
    send "cd /root && bash comfyui_boot.sh\r"
}

# Wait for ComfyUI to start
expect {
    "*Running on*" {
        send_user "\nComfyUI started successfully!\n"
    }
    timeout {
        send_user "\nTimeout waiting for ComfyUI to start\n"
    }
}

expect "*#*" {
    send "echo '=== Verifying ComfyUI ==='\r"
}

expect "*#*" {
    send "sleep 5 && netstat -tlnp 2>/dev/null | grep 8188 || ss -tlnp 2>/dev/null | grep 8188\r"
}

expect "*#*" {
    send "exit\r"
}

expect eof
EOF
