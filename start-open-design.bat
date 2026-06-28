@echo off
setlocal

set "NODE_EXE=C:\Program Files\nodejs\node.exe"
set "OD_CLI=C:\Users\luisg\AppData\Local\OpenDesignSource\apps\daemon\dist\cli.js"
set "OD_DATA_DIR=C:\Users\luisg\AppData\Local\OpenDesignSource\.od"
set "OD_URL=http://127.0.0.1:7456"

if not exist "%NODE_EXE%" (
  echo [Open Design] Node nao encontrado em:
  echo %NODE_EXE%
  pause
  exit /b 1
)

if not exist "%OD_CLI%" (
  echo [Open Design] CLI nao encontrado em:
  echo %OD_CLI%
  pause
  exit /b 1
)

echo Iniciando Open Design em %OD_URL%...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$env:OD_DATA_DIR='%OD_DATA_DIR%'; Start-Process -FilePath '%NODE_EXE%' -ArgumentList '\"%OD_CLI%\" --host 127.0.0.1 --port 7456 --no-open' -WindowStyle Hidden"

timeout /t 3 /nobreak >nul
call "%~dp0check-open-design.bat"

endlocal
