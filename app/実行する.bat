@echo off
chcp 65001 > nul
cd /d "%~dp0"

where python > nul 2>&1
if %errorlevel% == 0 (
    python fill_attendance.py
) else (
    where py > nul 2>&1
    if %errorlevel% == 0 (
        py fill_attendance.py
    ) else (
        echo Pythonが見つかりません。インストールしてください。
        echo https://www.python.org/downloads/windows/
    )
)
pause
