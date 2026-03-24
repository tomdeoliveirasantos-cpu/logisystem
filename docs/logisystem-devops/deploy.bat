@echo off
echo.
echo ========================================
echo   LogiSystem - Deploy Automatico
echo ========================================
echo.

set BACKEND_DIR=C:\Desenvolvimento\logi-auth-backend\logi-auth
set FRONTEND_DIR=C:\Desenvolvimento\logi-auth-frontend\logi-auth\frontend
set LOG_FILE=C:\Desenvolvimento\deploy.log

echo [%date% %time%] Iniciando deploy... >> %LOG_FILE%

:: ── BACKEND ──────────────────────────────────
echo [1/5] Atualizando backend...
cd /d %BACKEND_DIR%
git pull origin main
if %errorlevel% neq 0 (
  echo ERRO: git pull backend falhou >> %LOG_FILE%
  echo ERRO no git pull do backend!
  pause
  exit /b 1
)

echo [2/5] Instalando dependencias do backend...
npm install --production
if %errorlevel% neq 0 (
  echo ERRO: npm install backend falhou >> %LOG_FILE%
  pause
  exit /b 1
)

:: ── FRONTEND ─────────────────────────────────
echo [3/5] Atualizando frontend...
cd /d %FRONTEND_DIR%
git pull origin main
if %errorlevel% neq 0 (
  echo ERRO: git pull frontend falhou >> %LOG_FILE%
  pause
  exit /b 1
)

echo [4/5] Buildando frontend...
npm install
npm run build
if %errorlevel% neq 0 (
  echo ERRO: build frontend falhou >> %LOG_FILE%
  pause
  exit /b 1
)

:: ── RESTART PM2 ──────────────────────────────
echo [5/5] Reiniciando servicos...
pm2 restart logisystem-api
pm2 restart logisystem-frontend
pm2 save

echo.
echo [%date% %time%] Deploy concluido com sucesso! >> %LOG_FILE%
echo ========================================
echo   Deploy finalizado com sucesso!
echo ========================================
echo.
pause
