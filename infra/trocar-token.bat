@echo off
REM ============================================================
REM  WsDevSoft - Rotacao do token do webhook de deploy
REM  RODAR COMO ADMINISTRADOR
REM
REM  O token atual foi exposto em conversas. Este script troca por
REM  um novo e reinicia o webhook.
REM ============================================================
setlocal enabledelayedexpansion

net session >nul 2>&1
if %errorlevel% neq 0 (
  echo [ERRO] Execute como ADMINISTRADOR.
  pause
  exit /b 1
)

set WEBHOOK_DIR=C:\Desenvolvimento\deploy-webhook
set NOVO=800aa53f73b2ab2ee67e36c00fd19ac424a37f28b5d5387ccec663d0ae2dd14d

echo.
echo === Rotacao do token do webhook ===
echo.
echo Novo token: %NOVO%
echo.

cd /d "%WEBHOOK_DIR%"

REM --- backup ---
if exist .env copy /y .env .env.bak >nul

REM --- se existe .env, atualiza a chave; senao cria ---
if exist .env (
  findstr /V /C:"DEPLOY_TOKEN" .env > .env.tmp
  move /y .env.tmp .env >nul
)
echo DEPLOY_TOKEN=%NOVO%>> .env
echo Token gravado em %WEBHOOK_DIR%\.env

REM --- avisa se o token estiver hardcoded no server.js ---
findstr /C:"343ee80aead24e4993836a2e2e29cb1129c154bb17e1f92b9030fef1fcfb0ff5" server.js >nul 2>&1
if %errorlevel% equ 0 (
  echo.
  echo [ATENCAO] O token antigo esta ESCRITO DENTRO do server.js.
  echo           Edite o arquivo e troque para ler de process.env.DEPLOY_TOKEN
  echo           ou substitua o valor antigo pelo novo token acima.
  echo.
)

echo.
echo Reiniciando o webhook...
schtasks /End /TN "WsDevSoft-Webhook" >nul 2>&1
timeout /t 2 >nul
schtasks /Run /TN "WsDevSoft-Webhook" >nul 2>&1
timeout /t 4 >nul

echo.
echo Pronto. Guarde o novo token e informe ao Claude para atualizar as chamadas.
echo Backup do .env anterior: %WEBHOOK_DIR%\.env.bak
echo.
pause
