@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0.."
title VisionWiz Mixly Wireless Blockly Installer

if not exist "py39\python.exe" (
  echo [ERROR] Python runtime not found: py39\python.exe
  echo Run this installer from the VisionWiz project directory.
  pause
  exit /b 1
)

echo.
echo ===========================================
echo VisionWiz - Mixly wireless image sync
echo ===========================================
echo.
echo Step 1: Checking installed Mixly files (read-only)...
"py39\python.exe" "scripts\sync-mixly-wireless-blocks.py" --check
if errorlevel 1 goto error

if /I "%~1"=="--check" goto check_done

echo.
echo Six Mixly files will be backed up before updating.
echo Five NEW wireless camera blocks will be added.
echo Existing wired camera blocks will be kept.
echo Close Mixly before continuing.
echo.
choice /C YN /N /M "Proceed with Mixly update? [Y/N] "
if errorlevel 2 goto cancelled

echo.
echo Step 2: Back up and update external Mixly files...
"py39\python.exe" "scripts\sync-mixly-wireless-blocks.py" --apply
if errorlevel 1 goto error

:verified
echo.
echo Step 3: Verify all five wireless blocks are installed...
"py39\python.exe" "scripts\sync-mixly-wireless-blocks.py" --verify-installed
if errorlevel 1 goto error
echo.
echo [SUCCESS] Mixly wireless blocks are ready.
echo Restart Mixly and reopen the Image Sync block category.
goto end

:check_done
echo.
echo [CHECK ONLY] External Mixly files have not been changed.
goto end

:cancelled
echo.
echo [CANCELLED] No Mixly files changed.
goto end

:error
echo.
echo [ERROR] Installation or validation failed.
echo Check the message above. Do not erase original files.

:end
echo.
if /I "%~1"=="--check" (
  endlocal
  exit /b 0
)
pause
endlocal
