@echo off
chcp 65001 > nul
cd /d "%~dp0"

where python >nul 2>&1
if not errorlevel 1 (
    python fill_attendance.py
    goto :end
)

where py >nul 2>&1
if not errorlevel 1 (
    py fill_attendance.py
    goto :end
)

echo Python not found. Please install it from:
echo https://www.python.org/downloads/windows/

:end
pause
