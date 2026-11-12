@echo off
setlocal
cd /d "%~dp0"
echo Ket noi Zalo KHONG CHINH THUC, co nguy co bi khoa tai khoan.
echo Nen dung tai khoan phu da tham gia nhom can doc.
echo Script nay chi bat ket noi; ban tu quet QR trong giao dien.
choice /c YN /n /m "Chap nhan rui ro va bat ket noi? Y=Co, N=Khong: "
if errorlevel 2 exit /b 0
if not exist .env copy /y .env.example .env >nul
powershell.exe -NoProfile -Command "$p=Join-Path (Get-Location) '.env';$s=[IO.File]::ReadAllText($p);if($s -match '(?m)^ZALO_ENABLED=.*$'){$s=[regex]::Replace($s,'(?m)^ZALO_ENABLED=.*$','ZALO_ENABLED=true')}else{$s+=[Environment]::NewLine+'ZALO_ENABLED=true'+[Environment]::NewLine};[IO.File]::WriteAllText($p,$s,(New-Object Text.UTF8Encoding($false)))"
if errorlevel 1 (
 echo Khong luu duoc cau hinh.
 pause
 exit /b 1
)
echo Da bat. Neu app dang chay, dong no truoc khi mo lai CHAY-APP.bat.
echo Trong app, bam Ket noi Zalo va quet QR bang dien thoai.
pause
