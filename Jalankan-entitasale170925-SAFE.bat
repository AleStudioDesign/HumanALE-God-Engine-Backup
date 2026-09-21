@echo off
setlocal
cd /d "%~dp0"
set "DUDIDAM_APP=%CD%\Dudidam-Desktop\Dudidam.exe"

if not exist "%DUDIDAM_APP%" (
  echo Dudidam belum dibangun. Jalankan proses package desktop terlebih dahulu.
  pause
  exit /b 1
)

start "Dudidam" "%DUDIDAM_APP%"
if errorlevel 1 (
  echo Dudidam gagal dijalankan.
  pause
  exit /b 1
)

exit /b 0
