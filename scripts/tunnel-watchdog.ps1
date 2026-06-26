#!/usr/bin/env pwsh
# ComfyUI SSH隧道看守器 - 自动检测并重连
param(
    [int]$LocalPort = 18188,
    [int]$RemotePort = 8188,
    [int]$SSHPort = 23156,
    [string]$User = "root",
    [string]$Hostname = "connect.westb.seetacloud.com",
    [string]$Password = "T9Erp7FBQgdk",
    [int]$CheckInterval = 15  # 每15秒检测一次
)

$ErrorActionPreference = "Continue"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$LogFile = Join-Path $ScriptDir "tunnel-watchdog.log"

function Write-Log {
    param([string]$Msg)
    $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    "$ts $Msg" | Tee-Object -FilePath $LogFile -Append | Out-Host
}

function Test-Tunnel {
    try {
        $r = Invoke-WebRequest -Uri "http://127.0.0.1:${LocalPort}/system_stats" -TimeoutSec 5 -UseBasicParsing
        return $r.StatusCode -eq 200
    } catch { return $false }
}

function Restart-RemoteComfyUI {
    Write-Log "检查远程ComfyUI状态..."
    $remoteCheck = sshpass -p $Password ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 `
        -p $SSHPort "${User}@${Hostname}" `
        'ps aux | grep "[m]ain.py.*8188" | wc -l; echo "==="; curl -s --max-time 3 http://127.0.0.1:8188/system_stats | head -c 50'
    
    Write-Log "远程状态: $remoteCheck"
    
    if ($remoteCheck -notmatch "^1") {
        Write-Log "远程ComfyUI未运行，启动中..."
        sshpass -p $Password ssh -o StrictHostKeyChecking=no -p $SSHPort "${User}@${Hostname}" `
            'cd /root/ComfyUI && nohup python main.py --listen 0.0.0.0 --port 8188 > /tmp/comfyui.log 2>&1 &'
        Start-Sleep -Seconds 15
    }
}

function Start-Tunnel {
    # 先杀掉旧隧道
    Get-NetTCPConnection -LocalPort $LocalPort -ErrorAction SilentlyContinue | 
        ForEach-Object { taskkill /PID $_.OwningProcess /F 2>$null }
    Start-Sleep -Seconds 1
    
    # 启动新隧道
    Write-Log "启动SSH隧道 $($LocalPort)->$($RemotePort)..."
    $proc = Start-Process -FilePath "sshpass" -ArgumentList @(
        "-p", $Password,
        "ssh",
        "-o", "StrictHostKeyChecking=no",
        "-o", "ServerAliveInterval=15",
        "-o", "ServerAliveCountMax=3",
        "-o", "ExitOnForwardFailure=yes",
        "-o", "TCPKeepAlive=yes",
        "-N",
        "-L", "${LocalPort}:127.0.0.1:${RemotePort}",
        "-p", "$SSHPort",
        "${User}@${Hostname}"
    ) -NoNewWindow -PassThru
    
    Start-Sleep -Seconds 4
    return $proc
}

# ========== 主循环 ==========
Write-Log "===== 隧道看守器启动 ====="
$tunnelProc = $null
$restartCooldown = 0

while ($true) {
    if ($restartCooldown -gt 0) {
        $restartCooldown -= $CheckInterval
    }
    
    $alive = Test-Tunnel
    
    if (-not $alive) {
        Write-Log "隧道断开! 重建中..."
        $tunnelProc = Start-Tunnel
        
        # 如果本地通但远程不通，重启远程ComfyUI
        Start-Sleep -Seconds 2
        if (-not (Test-Tunnel) -and $restartCooldown -le 0) {
            Restart-RemoteComfyUI
            $restartCooldown = 60  # 最多每分钟重启一次远程
        }
    }
    
    Start-Sleep -Seconds $CheckInterval
}
