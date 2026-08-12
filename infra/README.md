# Infra resiliente — WsDevSoft

Objetivo: **nenhum incidente exigir que alguém entre no servidor**.

## O problema que isto resolve

O webhook de deploy (`deploy.wsdevsoft.com`) era o único canal remoto de
operação, mas rodava **dentro do PM2**. Quando o PM2 morria, o webhook morria
junto — e a recuperação virava presencial (RDP + `pm2 resurrect`). Aconteceu
três vezes.

Além disso o webhook rodava **sem elevação**, então não conseguia reiniciar o
serviço `cloudflared`, que às vezes precisa de restart depois que o PM2 volta.

## O que a instalação faz

| # | Mudança | Efeito |
|---|---|---|
| 1 | Webhook vira **tarefa do sistema** (SYSTEM, elevado), fora do PM2 | Sobrevive à morte do PM2 e consegue reiniciar o cloudflared |
| 2 | PM2 sobe no boot | Máquina reiniciou? Serviços voltam sozinhos |
| 3 | **Watchdog a cada 1 min** | Detecta porta fora e cura: webhook → `pm2 resurrect` → `cloudflared` |

Ordem de cura do watchdog (mesma do runbook manual):
1. Webhook fora → religa a tarefa
2. Serviços PM2 fora → `pm2 resurrect`, e `restart all` se persistir
3. Portas ok mas tunnel provavelmente com conexões mortas → `Restart-Service cloudflared`
   (no máximo 1x a cada 10 min, para não entrar em loop)

## Instalação

No servidor, **terminal como Administrador**:

```
cd C:\Desenvolvimento\logisystem
git pull
infra\instalar-infra.bat
infra\trocar-token.bat
```

Leva ~2 minutos. Depois disso, verificar:

```
schtasks /Query /TN "WsDevSoft-Watchdog"
type C:\Desenvolvimento\logs\watchdog.log
```

## ⚠️ Segurança — leia antes de instalar

Com o item 1, o webhook passa a **executar comandos arbitrários como
administrador**, exposto na internet, protegido apenas por um token estático.
Isso é poderoso e perigoso. Duas proteções são **obrigatórias**:

### 1. Rotacionar o token (obrigatório)
O token atual já circulou em conversas. `trocar-token.bat` faz isso.
Se o token estiver escrito dentro de `server.js`, o script avisa — nesse caso
troque o código para ler de `process.env.DEPLOY_TOKEN`.

### 2. Cloudflare Access na frente do webhook (fortemente recomendado)
Coloca autenticação **na borda**, antes de a requisição chegar ao servidor.

No painel Cloudflare → **Zero Trust** → **Access** → **Applications**:
1. *Add an application* → **Self-hosted**
2. Subdomínio: `deploy` · domínio: `wsdevsoft.com`
3. Policy: *Allow* → por e-mail específico, ou **Service Token** (para chamadas
   automatizadas)
4. Para uso programático, criar um **Service Token** e enviar os headers
   `CF-Access-Client-Id` e `CF-Access-Client-Secret`

Com isso, mesmo que o token do webhook vaze, a requisição não passa da borda.

### 3. Alternativa mais restritiva
Se preferir não expor execução arbitrária, dá para trocar o `/exec` por
endpoints fechados (`/deploy`, `/restart`, `/migrate`) que só executam ações
pré-definidas. Menos flexível, bem mais seguro. Vale considerar quando o
desenvolvimento estabilizar.

## Manutenção

- Log do watchdog: `C:\Desenvolvimento\logs\watchdog.log`
- Desativar temporariamente: `schtasks /Change /TN "WsDevSoft-Watchdog" /DISABLE`
- Reativar: `schtasks /Change /TN "WsDevSoft-Watchdog" /ENABLE`
- Rodar cura manual: `schtasks /Run /TN "WsDevSoft-Watchdog"`

## Recuperação manual (caso tudo falhe)

Continua valendo o runbook de `docs/RUNBOOK-INCIDENTES.md` (repo equityhub):

```
pm2 resurrect
pm2 list
net stop cloudflared && net start cloudflared
```

Nunca há perda de dados: o PostgreSQL é remoto (15.235.54.115).
