@echo off
setlocal
cd /d "%~dp0"
set "HUMANALE_APP=%CD%\HumanALE-God-Engine-Desktop\HumanALE-God-Engine.exe"

if not exist "%HUMANALE_APP%" (
  echo HumanALE god egine belum dibangun. Jalankan proses package desktop terlebih dahulu.
  pause
  exit /b 1
)

start "HumanALE god egine" "%HUMANALE_APP%"
if errorlevel 1 (
  echo HumanALE god egine gagal dijalankan.
  pause
  exit /b 1
)

exit /b 0
