# Linear + GitHub + Cursor — Ambiente de Desenvolvimento

## Fluxo de trabalho

```
Linear (tarefa) → branch no GitHub → Cursor (código) → PR → merge → deploy.bat
```

## 1. Linear — gerenciamento de projetos

### Configuração inicial
1. Crie conta em linear.app
2. Crie workspace "LogiSystem"
3. Crie projeto "LogiSystem App"
4. Configure ciclos (sprints) de 2 semanas

### Estrutura de labels sugerida
- 🐛 Bug
- ✨ Feature
- 🔧 Melhoria
- 📚 Docs
- 🚀 Deploy

### Integração com GitHub
No Linear: Settings → Integrations → GitHub → conecte o repositório
Ao criar uma issue no Linear, ele gera automaticamente uma branch no GitHub.

### Estados do workflow
```
Backlog → Em análise → Em desenvolvimento → Em revisão → Concluído
```

## 2. GitHub — repositório

### Estrutura de branches
```
main          ← produção (deploy.bat aponta para esta)
dev           ← desenvolvimento (integra features antes de ir para main)
feature/xxx   ← cada feature/bug do Linear vira uma branch
```

### Configuração inicial no servidor
```cmd
cd C:\Desenvolvimento\logi-auth-backend\logi-auth
git init
git remote add origin https://github.com/SEU_USUARIO/logisystem-backend.git
git add .
git commit -m "feat: initial commit"
git push -u origin main

cd C:\Desenvolvimento\logi-auth-frontend\logi-auth\frontend
git init
git remote add origin https://github.com/SEU_USUARIO/logisystem-frontend.git
git add .
git commit -m "feat: initial commit"
git push -u origin main
```

### Commit convention (importante para Linear auto-fechar issues)
```
feat: nova funcionalidade
fix: correção de bug
chore: manutenção/refatoração
docs: documentação
style: visual/CSS

Exemplos:
feat: adicionar campo de pedido na ordem de transporte
fix: corrigir data inválida na listagem de ordens
chore: atualizar dependências do backend

Para fechar issue do Linear automaticamente:
fix: corrigir upload de anexo (closes LOG-42)
```

## 3. Cursor — IDE com IA

### Instalação
Baixe em cursor.sh — instala igual ao VS Code.

### Configuração para o projeto
Abra a pasta do projeto no Cursor.
Crie `.cursor/rules` na raiz do projeto:

```
Você está trabalhando no LogiSystem, um sistema de gestão de transportes.

Stack:
- Frontend: React 18 + Vite, CSS com variáveis CSS (sem Tailwind)
- Backend: Node.js + Express + PostgreSQL (pg)
- Auth: JWT com middleware authMiddleware
- Tabelas: prefixo logi_ no banco wsdevsof_reciclagem

Convenções:
- Componentes em PascalCase
- Hooks começam com use
- API calls via api.get/post/put/patch/delete de src/lib/api.js
- useFetch para dados reativos
- Sempre usar variáveis CSS (--accent, --text, --border) para cores
- Toasts via useToast() de UI.jsx

Banco de dados:
- Host: 15.235.54.115
- Tabelas principais: logi_ordens_transporte, logi_clientes, logi_motoristas, logi_veiculos, logi_transportadoras

Nunca:
- Usar Tailwind (não está instalado)
- Hardcodar cores hex (usar variáveis CSS)
- Commitar o arquivo .env
```

### Atalhos úteis no Cursor
- `Ctrl+K` — editar código selecionado com IA
- `Ctrl+L` — chat com contexto do arquivo atual
- `Ctrl+Shift+P` → "Cursor: Open Chat" — chat geral

## 4. GitHub Copilot

### Ativar no Cursor
Settings → Extensions → GitHub Copilot → ativar
Faça login com sua conta GitHub.

### Dicas de uso
- Escreva um comentário descrevendo o que quer → Copilot completa
- Tab para aceitar sugestão
- Alt+] para ver próxima sugestão

## 5. OpenClaw — gestão de tarefas operacionais

OpenClaw complementa o Linear para tarefas mais simples e rápidas.
Use Linear para features e sprints, OpenClaw para tarefas do dia a dia.

## Fluxo completo de uma melhoria

1. **Linear** — cria issue: "Adicionar campo de km na ordem de transporte"
2. **GitHub** — Linear cria branch automática: `feature/LOG-15-campo-km-ordem`
3. **Cursor** — abre branch, usa IA para implementar
4. **Teste** — `npm run dev` local, testa a feature
5. **Commit** — `git commit -m "feat: adicionar campo km na ordem (closes LOG-15)"`
6. **Push** — `git push`
7. **Merge** — merge para main via GitHub
8. **Deploy** — roda `deploy.bat` no servidor via RDP
9. **Linear** — issue fecha automaticamente ✓
