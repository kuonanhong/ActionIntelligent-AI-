@echo off
chcp 65001 >nul
cd /d "%~dp0"
py -3 -c "import sys; sys.exit(0 if sys.version_info.major == 3 else 1)" >nul 2>&1
if not errorlevel 1 goto run_py
python -c "import sys; sys.exit(0 if sys.version_info.major == 3 else 1)" >nul 2>&1
if not errorlevel 1 goto run_python
echo 找不到 Python 3。請安裝 Python 3 並勾選加入 PATH，或使用 conda 的 Python 3 環境。
goto failed
:run_py
py -3 start_server.py %*
if errorlevel 1 goto failed
goto done
:run_python
python start_server.py %*
if errorlevel 1 goto failed
goto done
:failed
echo 網站啟動失敗。請查看上方訊息。
pause
exit /b 1
:done
exit /b 0
