@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Clean playback cache

rem ------------------------------------------------------------
rem  One-click cleanup of the HLS segment cache.
rem  relay.js deletes the cache itself on exit; this is the
rem  fallback for a hard-killed window, a crashed player that
rem  still holds the .ts files, or old %TEMP%\huya-hls-* dirs.
rem
rem  This file stays pure ASCII on purpose: cmd.exe misreads
rem  UTF-8 batch files longer than one 512-byte block.
rem ------------------------------------------------------------

if exist "%~dp0runtime\node.exe" goto RUN_LOCAL
where node >nul 2>nul
if not errorlevel 1 goto RUN_SYSTEM
echo.
echo   Node.js not found.
echo   Run play-huya^&bili.bat once to prepare the portable runtime,
echo   or install Node.js. Then run this again.
echo.
pause
exit /b 1

:RUN_LOCAL
"%~dp0runtime\node.exe" "%~dp0clean-cache.js" %*
goto DONE

:RUN_SYSTEM
node "%~dp0clean-cache.js" %*
goto DONE

:DONE
pause
exit /b 0
