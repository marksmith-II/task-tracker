@echo off
setlocal

REM Double-click this file to start the Task Tracker.
REM It launches the PowerShell script with ExecutionPolicy Bypass.

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0TaskTracker.ps1"

endlocal

