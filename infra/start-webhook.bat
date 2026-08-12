@echo off
REM Wrapper de inicializacao do webhook de deploy.
REM Roda como SYSTEM pela tarefa "WsDevSoft-Webhook".
REM Precisa preparar o ambiente porque o SYSTEM nao herda o PATH nem o
REM PM2_HOME do usuario admin — sem isso, comandos "pm2" falham no /status.

set PM2_HOME=C:\Users\admin\.pm2
set PATH=%PATH%;C:\Users\admin\AppData\Roaming\npm;C:\Program Files\nodejs
cd /d C:\Desenvolvimento\deploy-webhook
"C:\Program Files\nodejs\node.exe" server.js
