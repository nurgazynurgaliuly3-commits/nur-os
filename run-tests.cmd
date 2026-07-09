@echo off
setlocal
set "ROOT=%~dp0"
set "BUNDLED_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"

if exist "%BUNDLED_NODE%" (
  set "NODE_EXE=%BUNDLED_NODE%"
) else (
  set "NODE_EXE=node"
)

cd /d "%ROOT%"
"%NODE_EXE%" tests\config-report.js || exit /b 1
"%NODE_EXE%" tests\env-validation.js || exit /b 1
"%NODE_EXE%" tests\static-smoke.js || exit /b 1
"%NODE_EXE%" tests\api-smoke.js || exit /b 1
"%NODE_EXE%" tests\production-gates.js || exit /b 1
echo all-tests ok
