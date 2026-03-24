# Cloudflare Tunnel — HTTPS gratuito para o servidor local

## O que é
O Cloudflare Tunnel cria um túnel seguro entre seu servidor e a rede Cloudflare,
expondo o sistema via HTTPS sem precisar abrir portas no roteador ou ter IP fixo.

## Pré-requisitos
- Conta gratuita em cloudflare.com
- Um domínio (pode ser domínio próprio ou usar o *.trycloudflare.com gratuito)

## Instalação no Windows Server

### 1. Baixar cloudflared
Acesse: https://github.com/cloudflare/cloudflared/releases
Baixe: `cloudflared-windows-amd64.msi`
Instale normalmente.

### 2. Autenticar
```cmd
cloudflared tunnel login
```
Abre o navegador → faça login na Cloudflare → autorize.

### 3. Criar o tunnel
```cmd
cloudflared tunnel create logisystem
```
Anote o ID do tunnel gerado (ex: abc123-def456-...)

### 4. Criar arquivo de configuração
Crie o arquivo: `C:\Users\admin\.cloudflared\config.yml`

```yaml
tunnel: SEU_TUNNEL_ID_AQUI
credentials-file: C:\Users\admin\.cloudflared\SEU_TUNNEL_ID_AQUI.json

ingress:
  # Frontend — URL principal do sistema
  - hostname: logisystem.seudominio.com
    service: http://localhost:8091

  # API — subdomínio para a API
  - hostname: api.logisystem.seudominio.com
    service: http://localhost:3000

  # Regra catch-all obrigatória
  - service: http_status:404
```

### 5. Apontar DNS na Cloudflare
No painel Cloudflare → DNS → adicionar:
- Tipo: CNAME | Nome: logisystem | Valor: SEU_TUNNEL_ID_AQUI.cfargotunnel.com
- Tipo: CNAME | Nome: api.logisystem | Valor: SEU_TUNNEL_ID_AQUI.cfargotunnel.com

### 6. Instalar como serviço Windows (roda automático)
```cmd
cloudflared service install
net start cloudflared
```

### 7. Atualizar a URL da API no frontend
No arquivo `frontend/src/lib/api.js` e `frontend/src/pages/Ordens.jsx`,
troque `http://wsdevsoft.ddns.net:3000` por `https://api.logisystem.seudominio.com`

Rebuild o frontend:
```cmd
cd C:\Desenvolvimento\logi-auth-frontend\logi-auth\frontend
npm run build
pm2 restart logisystem-frontend
```

## Resultado
- Sistema acessível em: https://logisystem.seudominio.com
- API em: https://api.logisystem.seudominio.com
- HTTPS automático e gratuito via Cloudflare
- Sem precisar abrir portas no roteador
- Certificado SSL gerenciado automaticamente

## Teste rápido (sem domínio próprio)
```cmd
cloudflared tunnel --url http://localhost:8091
```
Gera uma URL temporária tipo: https://xxx.trycloudflare.com
