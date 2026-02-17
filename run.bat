@echo off
echo ------------------------------------------------
echo    CareFate Setup & Launcher
echo ------------------------------------------------

echo [1/2] Checking and installing dependencies...
pip install -r requirements.txt

echo.
echo [2/2] Starting server...
echo.
python start_server.py
pause
