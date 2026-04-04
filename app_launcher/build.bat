@echo off
taskkill /F /IM AppLauncher.exe >nul 2>&1
set CSC="C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
echo.
echo === Kompiliere Modern AppLauncher Server ===
echo.
%CSC% -nologo -target:winexe -out:AppLauncher.exe -win32icon:icon.ico AppLauncher.cs -r:System.Drawing.dll -r:System.Windows.Forms.dll
if %errorlevel% neq 0 (
    echo.
    echo Fehler beim Kompilieren!
    pause
    exit /b %errorlevel%
)
echo.
echo Erfolgreich kompiliert! 
echo Starte AppLauncher Server...
start AppLauncher.exe
pause
