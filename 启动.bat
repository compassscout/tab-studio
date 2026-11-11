@echo off
setlocal
cd /d "%~dp0"
title TAB STUDIO
rem 某些工具会残留这个变量，它会让 Electron 变成纯 Node 模式导致不启动
set "ELECTRON_RUN_AS_NODE="

set "ELECTRON_EXE=node_modules\electron\dist\electron.exe"

if exist "%ELECTRON_EXE%" goto launch

echo.
echo [1/2] 首次启动，正在安装运行环境（约 100MB，只装一次）
echo       已配置国内镜像，稍等即可。
echo.

where node >nul 2>nul
if errorlevel 1 goto nonode

set "ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/"
set "ELECTRON_BUILDER_BINARIES_MIRROR=https://npmmirror.com/mirrors/electron-builder-binaries/"
call npm install --registry=https://registry.npmmirror.com --no-audit --no-fund
if errorlevel 1 goto installfail
if not exist "%ELECTRON_EXE%" goto installfail

:launch
echo [2/2] 启动 TAB STUDIO ...
echo       改完源码按 Ctrl+R 立即生效，F12 打开开发者工具。
echo.
"%ELECTRON_EXE%" .
if errorlevel 1 goto runfail
goto end

:nonode
echo [错误] 没有找到 Node.js，无法安装运行环境。
echo 请先安装 Node.js 18 或更高版本：https://nodejs.org
echo.
pause
goto end

:installfail
echo.
echo [错误] 依赖安装失败。可手动在本目录执行：
echo   npm install --registry=https://registry.npmmirror.com
echo.
pause
goto end

:runfail
echo.
echo [错误] 程序异常退出，请把上面的报错信息留存。
pause

:end
endlocal
