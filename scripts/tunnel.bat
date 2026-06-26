@echo off
REM SSH Tunnel: 本地 18188 -> 远程 ComfyUI 8188
REM 用法: tunnel.bat [start|stop|status]

set REMOTE_HOST=connect.westb.seetacloud.com
set REMOTE_PORT=23156
set REMOTE_USER=root
set SSHPASS_PWD=T9Erp7FBQgdk
set LOCAL_PORT=18188
set REMOTE_SERVICE=127.0.0.1:8188

if "%1"=="" goto :start
if "%1"=="start" goto :start
if "%1"=="stop" goto :stop
if "%1"=="status" goto :status
if "%1"=="restart" goto :restart
echo Usage: tunnel.bat [start^|stop^|status^|restart]
goto :eof

:stop
echo [STOP] Closing tunnel on port %LOCAL_PORT%...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":%LOCAL_PORT%"') do (
    taskkill /F /PID %%a 2>nul
)
timeout /t 2 /nobreak >nul
echo [STOP] Done.
goto :eof

:restart
call :stop
timeout /t 1 /nobreak >nul

:start
call :stop 2>nul

echo [TUNNEL] Starting: localhost:%LOCAL_PORT% -^> %REMOTE_HOST%:%REMOTE_SERVICE%
set SSHPASS=%SSHPASS_PWD%
start "ComfyUI-Tunnel" /B sshpass -e ssh -o StrictHostKeyChecking=no -o ServerAliveInterval=30 -o ServerAliveCountMax=3 -N -L %LOCAL_PORT%:%REMOTE_SERVICE% -p %REMOTE_PORT% %REMOTE_USER%@%REMOTE_HOST%

timeout /t 5 /nobreak >nul

echo [TUNNEL] Checking...
curl -s http://127.0.0.1:%LOCAL_PORT%/system_stats >nul 2>&1
if %errorlevel% == 0 (
    echo [TUNNEL] OK! ComfyUI reachable at http://127.0.0.1:%LOCAL_PORT%
) else (
    echo [TUNNEL] Tunnel started, waiting for ComfyUI...
)
goto :eof

:status
netstat -ano | findstr ":%LOCAL_PORT%" >nul
if %errorlevel% == 0 (
    echo [STATUS] Tunnel is ACTIVE on port %LOCAL_PORT%
    curl -s http://127.0.0.1:%LOCAL_PORT%/system_stats >nul 2>&1
    if %errorlevel% == 0 (
        echo [STATUS] ComfyUI is responding
    ) else (
        echo [STATUS] ComfyUI may not be ready
    )
) else (
    echo [STATUS] No tunnel on port %LOCAL_PORT%
)
goto :eof
