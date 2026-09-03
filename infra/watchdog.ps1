# WsDevSoft - Watchdog de infraestrutura
# Roda a cada minuto como SYSTEM (tarefa agendada).
# Verifica as portas dos servicos e cura automaticamente:
#   1. Webhook fora        -> inicia o processo do webhook
#   2. Processos PM2 fora  -> pm2 resurrect
#   3. Portas ok mas borda -> reinicia o cloudflared
# Objetivo: nenhum incidente exigir alguem entrar no servidor.

$ErrorActionPreference = 'SilentlyContinue'
$LogDir  = 'C:\Desenvolvimento\logs'
$LogFile = Join-Path $LogDir 'watchdog.log'
$StateFile = Join-Path $LogDir 'watchdog-state.json'
if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Path $LogDir -Force | Out-Null }

# PM2 do usuario admin (SYSTEM tem outro PM2_HOME por padrao)
$env:PM2_HOME = 'C:\Users\admin\.pm2'
$PM2 = 'C:\Users\admin\AppData\Roaming\npm\pm2.cmd'
$NODE = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $NODE) { $NODE = 'C:\Program Files\nodejs\node.exe' }

function Log($msg) {
  $linha = "{0} {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $msg
  Add-Content -Path $LogFile -Value $linha
  # mantem o log enxuto (ultimas 2000 linhas)
  $c = Get-Content $LogFile -ErrorAction SilentlyContinue
  if ($c.Count -gt 2000) { $c[-1500..-1] | Set-Content $LogFile }
}

function PortaViva($porta) {
  $r = Test-NetConnection -ComputerName '127.0.0.1' -Port $porta -InformationLevel Quiet -WarningAction SilentlyContinue
  return $r
}

# --- Estado anterior (para nao ficar reiniciando cloudflared em loop) ---
$state = @{ ultimoCloudflared = [datetime]'2000-01-01' }
if (Test-Path $StateFile) {
  try { $j = Get-Content $StateFile -Raw | ConvertFrom-Json; $state.ultimoCloudflared = [datetime]$j.ultimoCloudflared } catch {}
}

# --- 1. Portas dos servicos ---
$servicos = @{
  'logisystem-api'      = 3000
  'logisystem-frontend' = 8091
  'deploy-webhook'      = 9000
  'equityhub-api'       = 3001
  'equityhub-frontend'  = 8092
}
$fora = @()
foreach ($nome in $servicos.Keys) {
  if (-not (PortaViva $servicos[$nome])) { $fora += $nome }
}

# --- 1b. Portas ok NAO garante que o usuario consegue acessar.
# O tunnel pode entregar erro mesmo com os servicos vivos, e foi assim que
# uma queda passou despercebida. Entao testamos tambem pela internet.
function UrlOk($url) {
  try {
    $r = Invoke-WebRequest -Uri $url -Method Head -TimeoutSec 12 -UseBasicParsing -ErrorAction Stop
    return ($r.StatusCode -lt 500)
  } catch {
    $code = $_.Exception.Response.StatusCode.value__
    if ($code -and $code -lt 500) { return $true }  # 4xx e resposta valida da app
    return $false
  }
}

if ($fora.Count -eq 0) {
  $publicas = @(
    'https://equityhub.wsdevsoft.com',
    'https://api-equityhub.wsdevsoft.com/api/health',
    'https://app.wsdevsoft.com',
    'https://api.wsdevsoft.com'
  )
  $foraPublico = @()
  foreach ($u in $publicas) { if (-not (UrlOk $u)) { $foraPublico += $u } }

  if ($foraPublico.Count -gt 0) {
    Log ("BORDA FORA (portas ok): " + ($foraPublico -join ', '))
    $desdeUltimo = (Get-Date) - $state.ultimoCloudflared
    if ($desdeUltimo.TotalMinutes -ge 10) {
      Log "Reiniciando cloudflared (servicos vivos, inacessiveis pela internet)"
      Restart-Service cloudflared -Force -ErrorAction SilentlyContinue
      $state.ultimoCloudflared = Get-Date
      @{ ultimoCloudflared = $state.ultimoCloudflared.ToString('o') } | ConvertTo-Json | Set-Content $StateFile
      Start-Sleep -Seconds 10
      $aindaFora = @()
      foreach ($u in $foraPublico) { if (-not (UrlOk $u)) { $aindaFora += $u } }
      if ($aindaFora.Count -eq 0) { Log "Acesso externo restabelecido" }
      else { Log ("AINDA FORA apos restart do cloudflared: " + ($aindaFora -join ', ')) }
    } else {
      Log ("cloudflared reiniciado ha {0:N0} min - aguardando janela" -f $desdeUltimo.TotalMinutes)
    }
    exit 0
  }

  if ((Get-Date).Minute -eq 0) { Log "OK - servicos e acesso externo no ar" }
  exit 0
}

Log ("FORA: " + ($fora -join ', '))

# --- 2. Webhook fora e' o caso critico: sem ele nao ha acesso remoto ---
if ($fora -contains 'deploy-webhook') {
  $temProc = Get-Process node -ErrorAction SilentlyContinue | Where-Object { $_.Path -like '*node*' }
  Log "Webhook fora - iniciando via tarefa agendada"
  schtasks /Run /TN "WsDevSoft-Webhook" | Out-Null
  Start-Sleep -Seconds 6
}

# --- 3. Processos PM2 fora -> resurrect ---
$pm2Fora = $fora | Where-Object { $_ -ne 'deploy-webhook' }
if ($pm2Fora.Count -gt 0) {
  Log "PM2 com servicos fora - executando resurrect"
  & $PM2 resurrect 2>&1 | Out-Null
  Start-Sleep -Seconds 8
  # se ainda faltar algum, tenta start pelo dump e depois restart all
  $aindaFora = @()
  foreach ($nome in $servicos.Keys) {
    if ($nome -eq 'deploy-webhook') { continue }
    if (-not (PortaViva $servicos[$nome])) { $aindaFora += $nome }
  }
  if ($aindaFora.Count -gt 0) {
    Log ("Ainda fora apos resurrect: " + ($aindaFora -join ', ') + " - restart all")
    & $PM2 restart all 2>&1 | Out-Null
    Start-Sleep -Seconds 8
  }
}

# --- 4. Portas voltaram? Entao a borda (cloudflared) pode ter perdido as conexoes ---
$portasOk = $true
foreach ($nome in $servicos.Keys) {
  if (-not (PortaViva $servicos[$nome])) { $portasOk = $false }
}

if ($portasOk) {
  # Quando o PM2 reinicia, o tunnel costuma manter conexoes mortas para
  # localhost:PORT. Reiniciar o cloudflared restabelece. Limite: 1x a cada 10 min.
  $desdeUltimo = (Get-Date) - $state.ultimoCloudflared
  if ($desdeUltimo.TotalMinutes -ge 10) {
    Log "Servicos no ar - reiniciando cloudflared para restabelecer o tunnel"
    Restart-Service cloudflared -Force -ErrorAction SilentlyContinue
    $state.ultimoCloudflared = Get-Date
    @{ ultimoCloudflared = $state.ultimoCloudflared.ToString('o') } | ConvertTo-Json | Set-Content $StateFile
  } else {
    Log ("cloudflared reiniciado ha {0:N0} min - aguardando janela" -f $desdeUltimo.TotalMinutes)
  }
  Log "Recuperacao concluida"
} else {
  Log "ATENCAO: servicos ainda fora apos tentativa de recuperacao"
}
