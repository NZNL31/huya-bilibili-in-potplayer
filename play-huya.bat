@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Huya Live - PotPlayer
node huya-launcher.js
if errorlevel 1 pause
