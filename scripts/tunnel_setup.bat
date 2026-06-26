@echo off
sshpass -p T9Erp7FBQgdk ssh -o StrictHostKeyChecking=no -o ServerAliveInterval=30 -o ServerAliveCountMax=5 -f -N -L 18188:127.0.0.1:8188 -p 23156 root@connect.westb.seetacloud.com
echo Tunnel started
