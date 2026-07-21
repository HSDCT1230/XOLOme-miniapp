@echo off
chcp 65001 >nul
echo ========================================
echo   XOLOme X1 - 打开微信小程序项目
echo ========================================
echo.

set "PROJECT=%~dp0xolome-miniapp"
set "CLI=%LOCALAPPDATA%\微信开发者工具\cli.bat"

echo 项目目录：
echo   %PROJECT%
echo.

if not exist "%PROJECT%\project.config.json" (
    echo [错误] 未找到 project.config.json
    echo 请确认目录结构正确。
    pause
    exit /b 1
)

if exist "%CLI%" (
    echo 正在用微信开发者工具打开...
    call "%CLI%" open --project "%PROJECT%"
) else (
    echo 未检测到 CLI，请手动导入：
    echo   1. 打开微信开发者工具
    echo   2. 导入项目
    echo   3. 目录选择上面的路径
    echo   4. AppID 可留空
    start "" "%PROJECT%"
)

echo.
pause
