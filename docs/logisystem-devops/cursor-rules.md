# Arquivo .cursor/rules para o projeto LogiSystem
# Cole este conteúdo em .cursor/rules na raiz de cada repositório

Você está trabalhando no LogiSystem, sistema de gestão de transportes em Node.js + React.

## Stack
- Frontend: React 18 + Vite, CSS puro com variáveis CSS (SEM Tailwind)
- Backend: Node.js 25 + Express 4 + pg (PostgreSQL)
- Auth: JWT — middleware authMiddleware em src/middleware/auth.js
- Deploy: PM2 + Cloudflare Tunnel no Windows Server

## Convenções de código
- Componentes React em PascalCase
- Hooks começam com `use` (useFetch, useParametros, useToast, useAuth)
- Chamadas de API via `api.get/post/put/patch/delete` de `src/lib/api.js`
- Dados reativos com `useFetch(path, deps)` de `src/hooks/useFetch.js`
- Toasts com `const { toast, showToast } = useToast()` de UI.jsx
- Modais: usar classe `modal-backdrop` > `modal` com `modal-header/body/footer`
- Tabelas: envolver em `<div className="table-wrap"><table>` para scroll horizontal
- Formulários: usar `Field`, `Input`, `Select`, `Textarea` de `../components/UI`

## CSS — SEMPRE usar variáveis CSS
Cores: --accent, --accent2, --accent-lt, --text, --text2, --text3
Backgrounds: --bg, --bg2, --bg3
Bordas: --border, --border2
Status: --green/--green-bg, --amber/--amber-bg, --red/--red-bg, --teal/--teal-bg
Layout: --radius, --radius-lg, --sidebar-w, --header-h
NUNCA hardcodar hex (#2563EB). SEMPRE usar variável.

## Banco de dados
Host: 15.235.54.115 | Banco: wsdevsof_reciclagem
Todas as tabelas têm prefixo logi_:
- logi_clientes, logi_transportadoras, logi_veiculos, logi_motoristas
- logi_ordens_transporte (campos: cliente_id, motorista_id, veiculo_id, data, numero_rota, seq, nf, peso, remessa, status, anexo_nome, anexo_path, tabela_frete_id...)
- logi_tabela_fretes, logi_contas_receber, logi_contas_pagar
- logi_manutencoes, logi_multas
- logi_usuarios (perfil: admin|operador|financeiro)
- logi_parametros (configurações do sistema)

## Regras importantes
1. Nunca commitar .env
2. Nunca hardcodar URLs — usar variável de ambiente ou constante
3. Sempre tratar erros com try/catch e showToast(e.message, 'error')
4. Uploads salvos em /uploads, banco guarda só o path
5. Token JWT via localStorage.getItem('logi_token')
6. Datas: sempre usar substring(0,10) para evitar fuso horário
7. Valores monetários: sempre .toFixed(2) ao exibir
