@echo off
REM Double-click this to start the new React app's dev server.
REM When it says "Local: http://localhost:5174/", open that in your browser.
cd /d "%~dp0app"
echo.
echo Starting the YDK Decoder (React rewrite)...
echo When it's ready, open:  http://localhost:5174
echo (Press Ctrl+C in this window to stop it.)
echo.
call npm run dev
pause
