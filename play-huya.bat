@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Huya Live - PotPlayer

rem ------------------------------------------------------------
rem  setup.ps1 checks the runtime and fills in whatever is missing
rem  (portable Node.js + ffmpeg). It exits quietly when all is set.
rem
rem  Then pick a Node.js to run with:
rem    1. runtime\node.exe   portable copy, no install needed
rem    2. node in PATH       user already installed one
rem
rem  This file stays pure ASCII on purpose: cmd.exe misreads
rem  UTF-8 batch files longer than one 512-byte block, which
rem  turns Chinese lines into garbage commands.
rem ------------------------------------------------------------

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup.ps1"

if exist "%~dp0runtime\node.exe" goto RUN_LOCAL
where node >nul 2>nul
if not errorlevel 1 goto RUN_SYSTEM
goto FAIL

:RUN_LOCAL
"%~dp0runtime\node.exe" "%~dp0huya-launcher.js"
goto DONE

:RUN_SYSTEM
node "%~dp0huya-launcher.js"
goto DONE

:FAIL
echo.
echo   Setup failed. See the messages above for what to do.
echo.
pause
exit /b 1

:DONE
if errorlevel 1 pause
exit /b 0
