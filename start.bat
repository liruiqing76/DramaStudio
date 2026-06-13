@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

set ROOT=%~dp0
set BACKEND_DIR=%ROOT%backend-node
set FRONTEND_DIR=%ROOT%frontweb

echo.
echo ================================================
echo    LocalMiniDrama 一键开发环境启动
echo ================================================
echo.

:: ====== 1. 检查 Node.js ======
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [X] 未找到 Node.js，请先安装 https://nodejs.org/
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('node -v') do echo [✓] Node.js: %%i

:: ====== 2. 检查 npm 依赖 ======
if not exist "%BACKEND_DIR%\node_modules" (
    echo [!] 后端依赖未安装，正在安装...
    cd /d "%BACKEND_DIR%"
    call npm install
    if %errorlevel% neq 0 (
        echo [X] 后端依赖安装失败
        pause
        exit /b 1
    )
    echo [✓] 后端依赖安装完成
)

if not exist "%FRONTEND_DIR%\node_modules" (
    echo [!] 前端依赖未安装，正在安装...
    cd /d "%FRONTEND_DIR%"
    call npm install
    if %errorlevel% neq 0 (
        echo [X] 前端依赖安装失败
        pause
        exit /b 1
    )
    echo [✓] 前端依赖安装完成
)

:: ====== 3. 数据库初始化 ======
echo.
echo [*] 初始化数据库...
cd /d "%BACKEND_DIR%"
call node src/db/migrate.js >nul 2>&1
echo [✓] 数据库已就绪

:: ====== 4. 杀掉旧进程 ======
echo.
echo [*] 清理旧端口占用...
netstat -ano > "%TEMP%\lmd_netstat.txt" 2>&1

:: 后端端口 5679
findstr ":5679 " "%TEMP%\lmd_netstat.txt" | findstr "LISTENING" > "%TEMP%\lmd_port.txt" 2>&1
for /f "tokens=5" %%a in (%TEMP%\lmd_port.txt) do (
    echo   - 杀掉端口 5679 的进程 PID %%a
    taskkill /PID %%a /F >nul 2>&1
)

:: SSH 隧道端口 8188
findstr ":8188 " "%TEMP%\lmd_netstat.txt" | findstr "LISTENING" > "%TEMP%\lmd_port2.txt" 2>&1
for /f "tokens=5" %%a in (%TEMP%\lmd_port2.txt) do (
    echo   - 杀掉端口 8188 的进程 PID %%a
    taskkill /PID %%a /F >nul 2>&1
)

del "%TEMP%\lmd_netstat.txt" >nul 2>&1
del "%TEMP%\lmd_port.txt" >nul 2>&1
del "%TEMP%\lmd_port2.txt" >nul 2>&1

:: ====== 5. SSH 隧道（ComfyUI 视频生成） ======
echo.
echo ================================================
echo    SSH 隧道（ComfyUI 视频生成）
echo ================================================
echo.
echo 此工具用于连接远程 ComfyUI 模型服务。
echo.

:: 检查 SSH 客户端
where ssh >nul 2>&1
if %errorlevel% neq 0 (
    echo [⚠] 未检测到 SSH 客户端，视频生成将不可用
    echo     请安装 OpenSSH Client 或使用 Git Bash
    echo.
    goto :skip_ssh
)

:: 读取 SSH 配置（如果存在）
set SSH_HOST=connect.westc.seetacloud.com
set SSH_PORT=23011
set SSH_USER=root
set REMOTE_PORT=8188
set LOCAL_PORT=8188

if exist "%ROOT%\ssh_config.txt" (
    for /f "tokens=1,2 delims==" %%a in (%ROOT%\ssh_config.txt) do (
        if "%%a"=="HOST" set SSH_HOST=%%b
        if "%%a"=="PORT" set SSH_PORT=%%b
        if "%%a"=="USER" set SSH_USER=%%b
        if "%%a"=="REMOTE_PORT" set REMOTE_PORT=%%b
        if "%%a"=="LOCAL_PORT" set LOCAL_PORT=%%b
    )
    echo [✓] 从 ssh_config.txt 读取 SSH 配置
)

echo 远程服务器: %SSH_USER%@%SSH_HOST%:%SSH_PORT%
echo ComfyUI 服务: localhost:%REMOTE_PORT% -^> 本地端口:%LOCAL_PORT%
echo.

:: 尝试建立 SSH 隧道
echo [*] 正在建立 SSH 隧道...
start "ComfyUI-SSH-Tunnel" cmd /k "ssh -o StrictHostKeyChecking=no -o ServerAliveInterval=60 -o ServerAliveCountMax=3 -p %SSH_PORT% -L %LOCAL_PORT%:localhost:%REMOTE_PORT% %SSH_USER%@%SSH_HOST% -N -v && echo. && echo [通知] SSH 隧道已断开，请关闭此窗口" 
echo [✓] SSH 隧道已启动（新窗口）

:: 等待端口就绪
echo [*] 等待 SSH 隧道建立（最多 30 秒）...
set TUNNEL_OK=0
for /l %%i in (1,1,30) do (
    timeout /t 1 /nobreak >nul
    netstat -ano | findstr ":%LOCAL_PORT% " | findstr "LISTENING" >nul 2>&1
    if !errorlevel! equ 0 (
        set TUNNEL_OK=1
        echo [✓] SSH 隧道已连通（耗时 %%i 秒）
        goto :tunnel_done
    )
)
:tunnel_done

if !TUNNEL_OK! equ 0 (
    echo [⚠] SSH 隧道建立超时，视频生成可能不可用
    echo     请检查 ssh_config.txt 中的服务器信息是否正确
    echo     或手动测试：ssh -p %SSH_PORT% %SSH_USER%@%SSH_HOST%
    echo.
)

:: ====== 6. 验证 ComfyUI ======
:skip_ssh
echo.
echo [*] 验证 ComfyUI 服务...
curl -s -o nul -w "%%{http_code}" http://localhost:%LOCAL_PORT%/system_stats >nul 2>&1
if %errorlevel% equ 0 (
    echo [✓] ComfyUI 服务正常
) else (
    echo [!] 无法连接 ComfyUI（视频生成将不可用，其他功能正常）
)

:: ====== 7. 启动服务 ======
echo.
echo ================================================
echo    启动服务
echo ================================================
echo.

echo [1/2] 后端 API 服务 (http://127.0.0.1:5679)...
start "Backend-API" cmd /k "cd /d %BACKEND_DIR% && echo LocalMiniDrama 后端 API 服务 && echo http://127.0.0.1:5679 && echo. && npm run dev"

echo [2/2] 前端页面 (http://127.0.0.1:3013)...
start "Frontend-Web" cmd /k "cd /d %FRONTEND_DIR% && echo LocalMiniDrama 前端页面 && echo http://127.0.0.1:3013 && echo. && npm run dev"

:: ====== 8. 等待并打开浏览器 ======
timeout /t 5 /nobreak >nul
echo.
echo ================================================
echo    ✓ 全部启动完成！
echo ================================================
echo.
echo   前端页面: http://127.0.0.1:3013
echo   后端 API: http://127.0.0.1:5679
echo   ComfyUI : http://127.0.0.1:8188
echo.
echo   关闭此窗口不会停止服务。
echo   如需停止服务，请关闭"Backend-API"和"Frontend-Web"窗口。
echo.
start http://127.0.0.1:3013

pause
