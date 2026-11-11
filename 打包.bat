@echo off
setlocal
cd /d "%~dp0"
title TAB STUDIO Pack
set "ELECTRON_RUN_AS_NODE="
set "ELECTRON_EXE=node_modules\electron\dist\electron.exe"

if exist "%ELECTRON_EXE%" goto build

echo [1/3] 安装依赖 ...
where node >nul 2>nul
if errorlevel 1 goto nonode

set "ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/"
set "ELECTRON_BUILDER_BINARIES_MIRROR=https://npmmirror.com/mirrors/electron-builder-binaries/"
call npm install --registry=https://registry.npmmirror.com --no-audit --no-fund
if errorlevel 1 goto installfail
if not exist "%ELECTRON_EXE%" goto installfail

:build
echo.
echo [2/3] 开始打包（首次会下载打包工具，比较慢）...
echo.
set "ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/"
set "ELECTRON_BUILDER_BINARIES_MIRROR=https://npmmirror.com/mirrors/electron-builder-binaries/"
call npm run dist
if errorlevel 1 goto buildfail

echo.
echo [3/3] 完成，产物在 release 文件夹：
echo   TAB-STUDIO-版本-x64.exe       安装版
echo   TAB-STUDIO-版本-portable.exe  免安装版
echo.
if exist "release" start "" explorer "release"
pause
goto end

:nonode
echo [错误] 没有找到 Node.js，请先安装：https://nodejs.org
pause
goto end

:installfail
echo [错误] 依赖安装失败，请查看上面的输出。
pause
goto end

:buildfail
echo [错误] 打包失败，请查看上面的输出。
pause

:end
endlocal
