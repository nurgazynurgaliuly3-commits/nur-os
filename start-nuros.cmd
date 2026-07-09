@echo off
setlocal
set NODE_EXE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe
if exist "%NODE_EXE%" (
  "%NODE_EXE%" "%~dp0server.js" 4174
) else (
  node "%~dp0server.js" 4174
)
