@echo off
title NovaKart GitHub Sync Tool
echo Pushing NovaKart project to GitHub...
set PATH=C:\Program Files\Git\cmd;%PATH%
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0push_to_github.ps1"
pause
