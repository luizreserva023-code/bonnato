@echo off
setlocal

set "OD_URL=http://127.0.0.1:7456"

powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $r = Invoke-WebRequest -UseBasicParsing '%OD_URL%' -TimeoutSec 5; Write-Host ('[Open Design] Online em %OD_URL% (HTTP ' + [int]$r.StatusCode + ')'); exit 0 } catch [System.Net.WebException] { if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode; Write-Host ('[Open Design] Online em %OD_URL% (HTTP ' + $code + ')'); exit 0 } Write-Host '[Open Design] Ainda nao respondeu em %OD_URL%'; exit 1 } catch { Write-Host '[Open Design] Ainda nao respondeu em %OD_URL%'; exit 1 }"

if errorlevel 1 (
  echo.
  echo Se o daemon ainda estiver subindo, aguarde alguns segundos e rode este arquivo de novo.
  exit /b 1
)

echo.
echo Agora abra uma nova thread no Codex e peca para usar o open design.
endlocal
