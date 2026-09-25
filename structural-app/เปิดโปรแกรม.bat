@echo off
rem ดับเบิลคลิกไฟล์นี้เพื่อเปิดโปรแกรมคำนวณในเบราว์เซอร์
rem ใช้ที่อยู่ http://localhost:5173 ทุกครั้ง เพราะงานที่บันทึกในเบราว์เซอร์ผูกกับที่อยู่นี้
cd /d "%~dp0"
title Structural Calc - http://localhost:5173

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js not found. Install the LTS version from https://nodejs.org then run this file again.
  pause
  exit /b 1
)

if not exist node_modules (
  echo First run: installing packages, please wait...
  call npm install
  if errorlevel 1 (
    pause
    exit /b 1
  )
)

rem ถ้าโปรแกรมเปิดอยู่แล้ว เปิดแค่เบราว์เซอร์
netstat -ano | findstr /r /c:":5173 .*LISTENING" >nul
if not errorlevel 1 (
  start "" http://localhost:5173
  exit /b 0
)

echo Starting at http://localhost:5173
echo Keep this window open while working. Close it to stop the program.
call npm run dev -- --port 5173 --strictPort --open
pause
