@echo off
REM ============================================================
REM  WsDevSoft - Instalacao da infra resiliente
REM  RODAR COMO ADMINISTRADOR (botao direito > Executar como administrador)
REM
REM  O que faz:
REM   1. Webhook como tarefa do sistema (SYSTEM, elevado) - sai do PM2
REM   2. PM2 sobe sozinho no boot
REM   3. Watchdog a cada 1 min: cura PM2, webhook e cloudflared
REM ============================================================
setlocal

echo.
echo === WsDevSoft - Instalacao da infra resiliente ===
echo.

REM --- confere elevacao ---
net session >nul 2>&1
if %errorlevel% neq 0 (
  echo [ERRO] Este script precisa ser executado como ADMINISTRADOR.
  echo        Feche, clique com o botao direito e escolha "Executar como administrador".
  pause
  exit /b 1
)

set REPO=C:\Desenvolvimento\logisystem
set WEBHOOK_DIR=C:\Desenvolvimento\deploy-webhook
set LOGDIR=C:\Desenvolvimento\logs
if not exist "%LOGDIR%" mkdir "%LOGDIR%"

REM --- localiza o node ---
for /f "delims=" %%i in ('where node 2^>nul') do set NODE=%%i
if "%NODE%"=="" set NODE=C:\Program Files\nodejs\node.exe
echo Node encontrado em: %NODE%

echo.
echo --- [1/4] Removendo webhook do PM2 (passa a ser tarefa do sistema) ---
call pm2 delete deploy-webhook 2>nul
call pm2 save 2>nul
echo     ok

echo.
echo --- [2/4] Webhook como tarefa do sistema (SYSTEM, elevado, no boot) ---
schtasks /Delete /TN "WsDevSoft-Webhook" /F >nul 2>&1
schtasks /Create /TN "WsDevSoft-Webhook" /RU SYSTEM /RL HIGHEST /SC ONSTART /DELAY 0000:30 ^
  /TR "\"%REPO%\infra\start-webhook.bat\"" /F
if %errorlevel% neq 0 (echo [ERRO] Falha ao criar a tarefa do webhook & pause & exit /b 1)
schtasks /Run /TN "WsDevSoft-Webhook" >nul 2>&1
echo     ok - webhook agora roda fora do PM2 e com privilegio de admin

echo.
echo --- [3/4] PM2 subindo sozinho no boot ---
schtasks /Delete /TN "WsDevSoft-PM2" /F >nul 2>&1
schtasks /Create /TN "WsDevSoft-PM2" /RU SYSTEM /RL HIGHEST /SC ONSTART /DELAY 0001:00 ^
  /TR "cmd /c set PM2_HOME=C:\Users\admin\.pm2 && pm2 resurrect" /F
echo     ok

echo.
echo --- [4/4] Watchdog a cada 1 minuto ---
schtasks /Delete /TN "WsDevSoft-Watchdog" /F >nul 2>&1
schtasks /Create /TN "WsDevSoft-Watchdog" /RU SYSTEM /RL HIGHEST /SC MINUTE /MO 1 ^
  /TR "powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File \"%REPO%\infra\watchdog.ps1\"" /F
if %errorlevel% neq 0 (echo [ERRO] Falha ao criar o watchdog & pause & exit /b 1)
schtasks /Run /TN "WsDevSoft-Watchdog" >nul 2>&1
echo     ok

echo.
echo === Instalacao concluida ===
echo.
echo Tarefas criadas: WsDevSoft-Webhook, WsDevSoft-PM2, WsDevSoft-Watchdog
echo.
echo Log do watchdog: %LOGDIR%\watchdog.log
echo.
echo IMPORTANTE: rode agora o script trocar-token.bat para rotacionar o token
echo             do webhook (o atual ja foi exposto em conversas).
echo.
pause
