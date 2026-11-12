@echo off
setlocal
cd /d "%~dp0"
title Nha Tin
rem Ban dong goi co san Node.js trong thu muc node\; neu khong co thi dung Node da cai tren may.
set "NODE=%~dp0node\node.exe"
if exist "%NODE%" goto havenode
set "NODE="
where node >nul 2>&1
if errorlevel 1 goto neednode
for /f "delims=" %%i in ('where node') do if not defined NODE set "NODE=%%i"
:havenode
"%NODE%" -e "const [a,b]=process.versions.node.split('.').map(Number);process.exit(a>22||(a===22&&b>=13)?0:1)"
if errorlevel 1 goto neednode
if not exist .env copy /y .env.example .env >nul
if exist node_modules\express\package.json goto start
where npm.cmd >nul 2>&1
if errorlevel 1 goto neednode
echo Dang cai thu vien. Lan dau can Internet, vui long cho...
call npm.cmd ci --ignore-scripts --cache "%LOCALAPPDATA%\NhaTin\npm-cache"
if errorlevel 1 goto failed
:start
echo.
echo Dang mo app. Giu cua so nay mo; dong cua so thi app dung.
echo Neu trinh duyet khong mo, truy cap http://127.0.0.1:3000
start "Mo giao dien" /b powershell.exe -NoProfile -Command "$ready=$false; for($i=0;$i -lt 30;$i++){try{$r=Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:3000/api/state' -TimeoutSec 1;if($r.StatusCode -eq 200){$ready=$true;break}}catch{};Start-Sleep -Seconds 1};if($ready){Start-Process 'http://127.0.0.1:3000'}"
"%NODE%" --env-file-if-exists=.env server.js
if errorlevel 1 goto failed
pause
exit /b 0
:neednode
echo Khong tim thay Node.js 22.13 tro len.
echo Dung ban dong goi co thu muc node\, hoac cai Node.js 24 LTS tu https://nodejs.org/
pause
exit /b 1
:failed
echo.
echo App chua chay duoc. Doc loi o tren, khong chup hoac gui khoa bi mat.
pause
exit /b 1
