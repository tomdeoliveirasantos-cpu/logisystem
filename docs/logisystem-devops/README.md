# LogiSystem 🚛

Sistema de gestão de transportes — rotas, ordens, financeiro e relatórios.

## Stack
- **Frontend**: React 18 + Vite + Recharts
- **Backend**: Node.js + Express + Multer
- **Banco**: PostgreSQL (remoto)
- **Deploy**: PM2 + Cloudflare Tunnel
- **Auth**: JWT com níveis de acesso (admin, operador, financeiro)

## Estrutura
```
logisystem/
├── backend/          # API Node.js
│   ├── src/
│   │   ├── routes/   # Endpoints REST
│   │   ├── db/       # Conexão PostgreSQL
│   │   └── middleware/
│   ├── uploads/      # Arquivos enviados (não commitado)
│   └── migrate_*.js  # Scripts de migração
├── frontend/         # React + Vite
│   └── src/
│       ├── pages/
│       ├── components/
│       ├── hooks/
│       ├── lib/
│       └── context/
└── scripts/
    └── deploy.bat    # Deploy no servidor Windows
```

## Setup local
```bash
# Backend
cd backend
cp .env.example .env   # configure as variáveis
npm install
node migrate_v2.js     # cria tabelas
npm run dev            # porta 3000

# Frontend
cd frontend
npm install
npm run dev            # porta 5173
```

## Deploy
```bat
scripts\deploy.bat
```

## Variáveis de ambiente (.env)
```
DATABASE_URL=postgresql://user:pass@host:5432/db
JWT_SECRET=seu_secret_aqui
PORT=3000
NODE_ENV=production
```

## Perfis de acesso
| Perfil | Acesso |
|--------|--------|
| Admin | Tudo + usuários + parâmetros |
| Operador | Cadastros + ordens + manutenção + multas |
| Financeiro | Contas + relatórios + clientes + ordens |
