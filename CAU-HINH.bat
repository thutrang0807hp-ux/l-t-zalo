@echo off
setlocal
cd /d "%~dp0"
if not exist .env copy /y .env.example .env >nul
echo File cau hinh chi luu tren may ban. Khong gui khoa vao chat.
echo Sua xong, luu file va khoi dong lai app.
start /wait notepad.exe .env
