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

:: 前端端口 3013
findstr ":3013 " "%TEMP%\lmd_netstat.txt" | findstr "LISTENING" > "%TEMP%\lmd_port2.txt" 2>&1
for /f "tokens=5" %%a in (%TEMP%\lmd_port2.txt) do (
    echo   - 杀掉端口 3013 的进程 PID %%a
    taskkill /PID %%a /F >nul 2>&1
)

del "%TEMP%\lmd_netstat.txt" >nul 2>&1
del "%TEMP%\lmd_port.txt" >nul 2>&1
del "%TEMP%\lmd_port2.txt" >nul 2>&1

:: ====== 5. 启动服务 ======
echo.
echo ================================================
echo    启动服务
echo ================================================
echo.

echo [1/2] 后端 API 服务 (http://127.0.0.1:5679)...
start "Backend-API" cmd /k "cd /d %BACKEND_DIR% && echo LocalMiniDrama 后端 API 服务 && echo http://127.0.0.1:5679 && echo. && npm run dev"

echo [2/2] 前端页面 (http://127.0.0.1:3013)...
start "Frontend-Web" cmd /k "cd /d %FRONTEND_DIR% && echo LocalMiniDrama 前端页面 && echo http://127.0.0.1:3013 && echo. && npm run dev"

:: ====== 6. 等待并打开浏览器 ======
timeout /t 5 /nobreak >nul
echo.
echo ================================================
echo    ✓ 全部启动完成！
echo ================================================
echo.
echo   前端页面: http://127.0.0.1:3013
echo   后端 API: http://127.0.0.1:5679
echo.
echo   关闭此窗口不会停止服务。
echo   如需停止服务，请关闭"Backend-API"和"Frontend-Web"窗口。
echo.
start http://127.0.0.1:3013

pause
