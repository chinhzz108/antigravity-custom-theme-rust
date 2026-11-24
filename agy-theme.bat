@echo off
setlocal EnableExtensions
chcp 65001 >nul

set "REPO_ROOT=%~dp0"
if "%REPO_ROOT:~-1%"=="\" set "REPO_ROOT=%REPO_ROOT:~0,-1%"
set "CLI_EXE=%REPO_ROOT%\target\release\agy-theme.exe"
set "DAEMON_EXE=%REPO_ROOT%\target\release\agy-theme-daemon.exe"

pushd "%REPO_ROOT%" >nul 2>&1

call :ensure_built
if errorlevel 1 (
    popd >nul 2>&1
    pause
    exit /b 1
)

rem Direct CLI pass-through if arguments were provided (e.g. agy-theme.bat install)
if not "%~1"=="" (
    "%CLI_EXE%" --root "%REPO_ROOT%" %*
    set "EXIT_CODE=%ERRORLEVEL%"
    popd >nul 2>&1
    exit /b %EXIT_CODE%
)

:menu
cls
echo ============================================================
echo   Antigravity Custom Theme - Rust Edition (Low RAM / Fast)
echo ============================================================
echo   Thu muc: %REPO_ROOT%
echo.
echo   [1] Cai dat ^& Chay ngam tu dong (Install + Task Scheduler)
echo   [2] Build lai theme (sau khi sua themes\themes.json)
echo   [3] Kiem tra trang thai ^& RAM thuc te (Status)
echo   [4] Kiem tra live tren Antigravity (Verify CDP)
echo   [5] Xem danh sach preset (Themes)
echo   [6] Chay ngam + tu build khi sua themes.json (Watch Mode)
echo   [7] Tam dung daemon (Stop)
echo   [8] Go cai dat ^& Khoi phuc giao dien mac dinh (Uninstall)
echo   [9] Build lai binary Rust (cargo build --release)
echo   [0] Thoat
echo ============================================================
echo.
set "CHOICE="
set /p "CHOICE=Chon chuc nang (0-9): "
echo.

if "%CHOICE%"=="1" goto do_install
if "%CHOICE%"=="2" goto do_build
if "%CHOICE%"=="3" goto do_status
if "%CHOICE%"=="4" goto do_verify
if "%CHOICE%"=="5" goto do_themes
if "%CHOICE%"=="6" goto do_watch
if "%CHOICE%"=="7" goto do_stop
if "%CHOICE%"=="8" goto do_uninstall
if "%CHOICE%"=="9" goto do_rebuild_rust
if "%CHOICE%"=="0" goto do_exit

echo [!] Lua chon khong hop le. Vui long nhap so tu 0 den 9.
pause
goto menu

:do_install
"%CLI_EXE%" --root "%REPO_ROOT%" install
echo.
echo [Luu y] Neu day la lan cai dau tien (Antigravity v2.33.0+):
echo   1. Chuot phai icon Antigravity o System Tray -^> Quit (thoat han).
echo   2. Mo lai Antigravity tu shortcut Desktop hoac Start Menu.
echo   3. Bam nut "Custom theme" o sidebar trai de doi theme.
echo.
pause
goto menu

:do_build
"%CLI_EXE%" --root "%REPO_ROOT%" build
echo.
pause
goto menu

:do_status
"%CLI_EXE%" --root "%REPO_ROOT%" status
echo.
pause
goto menu

:do_verify
"%CLI_EXE%" --root "%REPO_ROOT%" verify
echo.
pause
goto menu

:do_themes
"%CLI_EXE%" --root "%REPO_ROOT%" themes
echo.
pause
goto menu

:do_watch
"%CLI_EXE%" --root "%REPO_ROOT%" install --watch-themes
echo.
pause
goto menu

:do_stop
"%CLI_EXE%" --root "%REPO_ROOT%" stop
echo.
pause
goto menu

:do_uninstall
"%CLI_EXE%" --root "%REPO_ROOT%" uninstall
echo.
pause
goto menu

:do_rebuild_rust
where cargo >nul 2>&1
if errorlevel 1 (
    echo [Loi] Khong tim thay Rust (cargo). Tai Rust tai: https://rustup.rs/
    pause
    goto menu
)
"%CLI_EXE%" --root "%REPO_ROOT%" stop >nul 2>&1
powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command "Stop-ScheduledTask -TaskName 'AntigravityCustomTheme' -ErrorAction SilentlyContinue" >nul 2>&1
timeout /t 1 /nobreak >nul
echo [Build] Dang bien dich ban Release (cargo build --release)...
cargo build --release
if errorlevel 1 (
    echo [Loi] Bien dich that bai!
) else (
    echo [OK] Bien dich thanh cong!
)
echo.
pause
goto menu

:do_exit
popd >nul 2>&1
exit /b 0

:ensure_built
if exist "%CLI_EXE%" if exist "%DAEMON_EXE%" exit /b 0
echo [Setup] Chua co file release binary. Dang kiem tra Rust (cargo)...
where cargo >nul 2>&1
if errorlevel 1 (
    echo [Loi] Chua cai Rust toolchain ^(cargo^).
    echo Hay cai Rust tai https://rustup.rs/ roi mo lai agy-theme.bat.
    exit /b 1
)
echo [Setup] Dang bien dich lan dau (cargo build --release)...
cargo build --release
if errorlevel 1 (
    echo [Loi] cargo build --release that bai.
    exit /b 1
)
exit /b 0
