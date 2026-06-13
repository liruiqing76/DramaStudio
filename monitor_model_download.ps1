# 监控ComfyUI模型下载进度
# 使用方法：powershell -ExecutionPolicy Bypass -File monitor_model_download.ps1

$server = "root@116.172.93.163"
$modelDir = "/root/comfyui/models/checkpoints"
$logFile = "d:\zmzc-code\ai-drama-refs\LocalMiniDrama\model_download_log.txt"

function Write-Log {
    param($Message)
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logMessage = "[$timestamp] $Message"
    Write-Host $logMessage
    Add-Content -Path $logFile -Value $logMessage
}

function Get-ModelStatus {
    param($ModelName)
    
    $cmd = "ls -lh $modelDir/*$ModelName* 2>/dev/null | awk '{print `$5, `$9}'"
    $result = ssh $server $cmd 2>&1
    
    if ($LASTEXITCODE -eq 0 -and $result) {
        return @{
            Exists = $true
            Info = $result
        }
    } else {
        return @{
            Exists = $false
            Info = "未找到"
        }
    }
}

function Get-DownloadProgress {
    $cmd = "ps aux | grep -i 'wget\|curl\|git\|modelscope' | grep -v grep | head -5"
    $result = ssh $server $cmd 2>&1
    
    if ($LASTEXITCODE -eq 0 -and $result) {
        return $result
    } else {
        return "无活跃下载进程"
    }
}

function Get-DiskUsage {
    $cmd = "df -h $modelDir | tail -1 | awk '{print \$3\"/\"\$2 \" (可用: \"\$4\")\"}'"
    $result = ssh $server $cmd 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        return $result
    } else {
        return "无法获取"
    }
}

# 清空日志
if (Test-Path $logFile) {
    Clear-Content -Path $logFile
}

Write-Log "===== 开始监控LTX Video模型下载 ====="
Write-Log "服务器: $server"
Write-Log "模型目录: $modelDir"
Write-Log ""

$models = @("ltx-video-13b", "ltx-video-13b-distilled", "ltx-video-2b")

while ($true) {
    Clear-Host
    Write-Host "===== LTX Video模型下载监控 =====" -ForegroundColor Cyan
    Write-Host "时间: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Yellow
    Write-Host ""
    
    # 检查磁盘空间
    $diskUsage = Get-DiskUsage
    Write-Host "磁盘使用情况: $diskUsage" -ForegroundColor Green
    Write-Host ""
    
    # 检查每个模型
    Write-Host "模型状态:" -ForegroundColor Yellow
    foreach ($model in $models) {
        $status = Get-ModelStatus -ModelName $model
        if ($status.Exists) {
            Write-Host "  ✓ $model : $($status.Info)" -ForegroundColor Green
            Write-Log "$model : 已下载 - $($status.Info)"
        } else {
            Write-Host "  ✗ $model : 未找到" -ForegroundColor Red
        }
    }
    
    Write-Host ""
    
    # 检查下载进程
    Write-Host "下载进程:" -ForegroundColor Yellow
    $progress = Get-DownloadProgress
    if ($progress -match "无活跃下载进程") {
        Write-Host "  $progress" -ForegroundColor Gray
    } else {
        Write-Host "  $progress" -ForegroundColor Magenta
        Write-Log "下载进程: $progress"
    }
    
    Write-Host ""
    Write-Host "按 Ctrl+C 停止监控" -ForegroundColor Gray
    Write-Host "下次刷新: 30秒后" -ForegroundColor Gray
    
    # 等待30秒
    Start-Sleep -Seconds 30
}

Write-Log "===== 监控结束 ====="
