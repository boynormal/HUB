@echo off
cd /d "%~dp0.."
if not exist ".env" (
  echo ไม่พบไฟล์ .env
  pause
  exit /b 1
)
if not exist ".next\BUILD_ID" (
  echo ยังไม่มีไฟล์บิลด์ ให้รัน npm run build ก่อน
  pause
  exit /b 1
)
start "HubWorker" cmd /k "set NODE_ENV=production&& npm run worker"
set HOSTNAME=127.0.0.1
set PORT=3110
set NODE_ENV=production
npm run start
