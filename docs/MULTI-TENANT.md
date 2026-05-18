# MULTI-TENANT — LogiSystem

> Documento de referência da arquitetura multi-tenant do LogiSystem.
> **Fonte da verdade** para qualquer decisão envolvendo isolamento de dados
> por organização, vínculo de usuários, ou onboarding de novos clientes.
>
> Se o código em produção contradiz este documento, **abra um PR para
> reconciliar antes de evoluir** — nunca ignore.

---

## 1. O problema que estamos resolvendo

Até a Fase 1 desta migração, o LogiSystem foi construído como sistema
**single-tenant** para a Léo Madeiras. Todas as 24 tabelas operacionais
(`logi_clientes`, `logi_motoristas`, `logi_veiculos`, `logi_ordens_transporte`,
etc.) assumiam que existe apenas um conjunto de dados.

Com a chegada do segundo cliente, precisamos:

1. **Isolar dados** entre clientes (cliente 2 não pode ver nada da Léo).
2. **Onboarding rápido** — provisionar cliente novo deve ser questão de minutos,
   com sistema "vazio" pronto para os cadastros iniciais.
3. **Suportar usuários N:N** — Wellington (WsDevSoft) gerencia todos os
   clientes; um despachante da Léo só vê a Léo.
4. **Custo operacional baixo** — sem multiplicar bancos, migrations, ou
   pools de conexão por cliente.

---

## 2. Modelo escolhido — Shared Schema com `organizacao_id`

Comparamos três modelos clássicos de multi-tenancy em PostgreSQL:

| Modelo | Isolamento | Operacional | Custo | Escala |
|---|---|---|---|---|
| Database-per-tenant | Máximo | Alto | Alto | 1-20 clientes enterprise |
| Schema-per-tenant | Forte | Médio-alto | Médio | 50-500 clientes |
| **Shared schema + `organizacao_id`** | **Médio-forte (com RLS)** | **Baixo** | **Baixo** | **Centenas-milhares** |

**Escolhemos shared schema** porque:

- Onboarding de cliente novo é literalmente `INSERT INTO logi_organizacoes` — a
  tela do cliente já abre vazia porque toda query filtra por `organizacao_id` e
  o novo tenant ainda não tem registro algum.
- 1 migration aplica para todos os clientes simultaneamente.
- Dashboards cross-tenant para a WsDevSoft saem grátis (sem precisar
  consolidar dados de N bancos).
- Custo operacional é o mesmo de hoje (1 banco PostgreSQL).
- Se no futuro um cliente enterprise exigir isolamento físico, podemos mover
  **apenas aquele cliente** para banco próprio sem refazer toda a arquitetura
  ("hybrid approach").

**O risco principal** (vazamento entre clientes por bug numa query) é mitigado
com **3 camadas de defesa em profundidade** descritas na seção 4.

---

## 3. Decisões consolidadas (Wellington, Maio/2026)

| Decisão | Escolha |
|---|---|
| Vínculo usuário×organização | **N:N** via `logi_usuarios_orgs` |
| Domínio | **Único** (`app.wsdevsoft.com` para todos os clientes) |
| Tenant identifier | Vem do **JWT** (claim `organizacao_id`), nunca da URL |
| Escopo de isolamento | **Total** — todas as 16 tabelas operacionais + 5 de cadastros auxiliares |
| Super-admin WsDevSoft | **Organização especial "WsDevSoft"** com perfil `super_admin` |
| RLS (Row-Level Security) | Habilitado na **Fase 5**, após backfill completo |

---

## 4. Arquitetura — 3 camadas de defesa

Toda requisição autenticada passa por 3 camadas que garantem isolamento.
**A regra é: se uma falhar, a próxima protege.**

### Camada 1 — Middleware `requireTenant`

No início de cada rota autenticada, o middleware:

1. Decodifica o JWT (já existe `authMiddleware`).
2. Extrai `organizacao_id` e `perfil_na_org` do payload.
3. Popula `req.organizacao_id`, `req.user_id`, `req.perfil`.
4. **Valida** que o usuário tem vínculo ativo com aquela org em
   `logi_usuarios_orgs` (rejeita se foi revogado desde a emissão do token).

```js
// backend/src/middleware/tenant.js
async function requireTenant(req, res, next) {
  const { user_id, organizacao_id } = req.user; // do authMiddleware
  if (!organizacao_id) return res.status(403).json({ error: 'Org não selecionada' });

  const vinculo = await pool.query(
    `SELECT perfil_na_org, ativo FROM logi_usuarios_orgs
      WHERE usuario_id = $1 AND organizacao_id = $2`,
    [user_id, organizacao_id]
  );
  if (!vinculo.rows.length || !vinculo.rows[0].ativo) {
    return res.status(403).json({ error: 'Sem acesso a esta organização' });
  }

  req.organizacao_id = organizacao_id;
  req.perfil = vinculo.rows[0].perfil_na_org;
  next();
}
```

### Camada 2 — Helper `db.queryTenant()`

Wrapper sobre `pool.query` que **automaticamente injeta** o filtro
`organizacao_id` em todas as queries. Os desenvolvedores devem **sempre** usar
este helper em vez de `pool.query` direto para tabelas tenant-aware.

```js
// backend/src/db/tenant.js
async function queryTenant(req, sql, params = []) {
  // Seta uma variável de sessão por transação que o RLS lê
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SET LOCAL app.organizacao_id = $1`, [req.organizacao_id]);
    const result = await client.query(sql, params);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}
```

**Importante:** super-admins (perfil `super_admin` na org WsDevSoft) podem
passar uma flag `req.bypassTenant = true` para consultas cross-tenant
explícitas (relatórios da WsDevSoft, suporte). Essa flag não é setada pelo
JWT — só é setada manualmente em endpoints `/admin/*` protegidos.

### Camada 3 — PostgreSQL Row-Level Security (RLS)

Mesmo que um desenvolvedor esqueça de usar `queryTenant` ou monte uma query
manual sem WHERE, o banco rejeita o vazamento.

```sql
ALTER TABLE logi_clientes ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON logi_clientes
  USING (organizacao_id = current_setting('app.organizacao_id', true));
```

A variável `app.organizacao_id` é setada pela Camada 2 a cada transação.
Se ela não está setada (acesso direto ao banco sem passar pelo helper),
o RLS retorna 0 linhas.

**Super-admins** rodam com role `bypass_rls` no banco, configurado só em
endpoints de admin.

---

## 5. Schema do banco

### 5.1 `logi_organizacoes` (nova)

```sql
CREATE TABLE logi_organizacoes (
  id              TEXT PRIMARY KEY DEFAULT md5(((random())::text || (clock_timestamp())::text)),
  nome            VARCHAR(120) NOT NULL,        -- "Léo Madeiras"
  razao_social    VARCHAR(180),                 -- "Léo Madeiras Ltda"
  cnpj            VARCHAR(18),                  -- "12.345.678/0001-99"
  slug            VARCHAR(40) UNIQUE NOT NULL,  -- "leo-madeiras"
  logo_url        TEXT,
  cor_primaria    VARCHAR(7),                   -- #1D9E75
  plano           VARCHAR(20) NOT NULL DEFAULT 'basico',
  ativo           BOOLEAN NOT NULL DEFAULT TRUE,
  is_wsdevsoft    BOOLEAN NOT NULL DEFAULT FALSE,  -- marca a org especial
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 5.2 `logi_usuarios_orgs` (nova — junção N:N)

```sql
CREATE TABLE logi_usuarios_orgs (
  usuario_id      TEXT NOT NULL REFERENCES logi_usuarios(id) ON DELETE CASCADE,
  organizacao_id  TEXT NOT NULL REFERENCES logi_organizacoes(id) ON DELETE CASCADE,
  perfil_na_org   VARCHAR(40) NOT NULL,  -- 'admin', 'despachante', 'fiscal', 'super_admin'
  ativo           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (usuario_id, organizacao_id)
);

CREATE INDEX idx_usuarios_orgs_usuario ON logi_usuarios_orgs(usuario_id) WHERE ativo;
CREATE INDEX idx_usuarios_orgs_org ON logi_usuarios_orgs(organizacao_id) WHERE ativo;
```

**Nota:** o campo `perfil` que hoje está em `logi_usuarios` será mantido por
compatibilidade durante a transição, mas **a fonte da verdade passa a ser**
`logi_usuarios_orgs.perfil_na_org`. Um usuário pode ser admin numa org e
fiscal noutra.

### 5.3 Tabelas tenant-aware (16 operacionais + 5 cadastros)

Todas ganham:

```sql
ALTER TABLE logi_xxx ADD COLUMN organizacao_id TEXT REFERENCES logi_organizacoes(id);
CREATE INDEX idx_xxx_org ON logi_xxx(organizacao_id);
```

**Operacionais (16):** `logi_clientes`, `logi_motoristas`, `logi_veiculos`,
`logi_ordens_transporte`, `logi_ordem_paradas`, `logi_ordem_anexos`,
`logi_ordem_ajudantes`, `logi_historico_ordens`, `logi_transportadoras`,
`logi_ajudantes`, `logi_multas`, `logi_manutencoes`, `logi_contas_pagar`,
`logi_contas_receber`, `logi_adiantamentos`, `logi_fornecedores`.

**Cadastros auxiliares (5):** `logi_tabela_fretes`,
`logi_tabela_frete_recebido`, `logi_reajustes_frete`,
`logi_motorista_cadastros`, `logi_cadastro_convites`.

### 5.4 Tabelas globais (sem `organizacao_id`)

- `logi_usuarios` — uma pessoa existe uma vez, mesmo gerenciando N orgs.
- `logi_usuarios_orgs` — é a tabela que **define** o vínculo.
- `logi_webauthn_credentials` — credencial biométrica é do usuário, não da org.
- `logi_parametros` — global por enquanto; pode virar `(organizacao_id, chave, valor)` se precisar customização por cliente no futuro.
- `logi_organizacoes` — óbvio.

---

## 6. Fluxo de autenticação revisado

### 6.1 Login

```
POST /auth/login { email, senha }
↓
1. Valida email/senha → user_id
2. Busca SELECT * FROM logi_usuarios_orgs WHERE usuario_id = $1 AND ativo = TRUE
3. Resposta:
   {
     user: { id, nome, email },
     orgs: [
       { id, nome, slug, perfil_na_org, logo_url },  // Léo Madeiras
       { id, nome, slug, perfil_na_org, logo_url }   // Cliente Novo
     ],
     // Se houver 1 só org, já vem o JWT pronto:
     token: "..." (apenas se orgs.length === 1)
   }
```

### 6.2 Seleção de organização (se múltiplas)

```
POST /auth/select-org { organizacao_id }
Header: Authorization: Bearer <token_temporário_pré_seleção>
↓
1. Valida que o usuário tem vínculo ativo com aquela org
2. Emite JWT final com claims: { user_id, organizacao_id, perfil_na_org }
3. Resposta: { token, org: { id, nome, slug, ... } }
```

### 6.3 Troca de organização (durante uso)

Mesmo endpoint `POST /auth/select-org`. Frontend:
- Mostra dropdown no header com a lista de orgs.
- Ao trocar, chama o endpoint, recebe novo JWT, atualiza `localStorage`,
  recarrega o estado da app (limpa caches em memória).

### 6.4 JWT payload final

```json
{
  "user_id": "abc123...",
  "organizacao_id": "def456...",
  "perfil_na_org": "admin",
  "iat": 1716000000,
  "exp": 1716086400
}
```

---

## 7. Super-admin (WsDevSoft)

A WsDevSoft é modelada como **uma organização especial** com flag
`is_wsdevsoft = TRUE`. Usuários da WsDevSoft (Wellington, equipe de suporte)
têm em `logi_usuarios_orgs` um registro:

```
usuario_id     | organizacao_id (WsDevSoft) | perfil_na_org
---------------|----------------------------|---------------
wellington_id  | wsdevsoft_org_id           | super_admin
```

E **adicionalmente** registros para cada cliente que ele gerencia
(perfil `admin`).

### O que `super_admin` pode fazer:

- Ver lista de todas as organizações (endpoint `GET /admin/orgs`)
- Criar nova organização (`POST /admin/orgs`)
- Criar 1º usuário admin de uma org recém-criada (`POST /admin/orgs/:id/usuarios`)
- Acessar relatórios cross-tenant (`GET /admin/reports/*`)
- Suporte: temporariamente se vincular a uma org cliente para investigar
  problema (cria registro em `logi_usuarios_orgs` ativo por tempo limitado)

### Como o backend identifica:

```js
function isSuperAdmin(req) {
  return req.perfil === 'super_admin'
      && req.user_org_is_wsdevsoft === true;
}
```

Endpoints `/admin/*` exigem `isSuperAdmin(req)`. Não basta ter perfil
`super_admin` — precisa estar logado **na org WsDevSoft**.

---

## 8. Onboarding de cliente novo — passo a passo

Quando um cliente novo é fechado pela WsDevSoft:

1. **Wellington (super_admin)** entra em `/admin/orgs/nova`.
2. Preenche: nome, razão social, CNPJ, slug.
3. Sistema cria:
   - 1 registro em `logi_organizacoes`
   - 1 usuário admin inicial (`logi_usuarios` + `logi_usuarios_orgs` com perfil `admin`)
   - Senha inicial enviada por email para o cliente
4. Cliente recebe email, faz login, é forçado a trocar a senha.
5. **Sistema abre vazio** — toda query filtra por `organizacao_id` e essa org
   ainda não tem nenhum cadastro. Cliente começa a cadastrar motoristas,
   veículos, clientes, etc.

**Tempo total esperado:** 2-3 minutos.

---

## 9. Fases de implementação

### Fase 1 — Fundação do schema *(não quebra nada)*

- Migration `021_multitenant_fundacao.js`:
  - Cria `logi_organizacoes`
  - Cria `logi_usuarios_orgs`
  - Insere org **WsDevSoft** (`is_wsdevsoft = TRUE`)
  - Insere org **Léo Madeiras**
  - Backfill: para cada usuário existente em `logi_usuarios`, cria vínculo
    com Léo Madeiras (perfil herdado de `logi_usuarios.perfil`)
  - **Wellington ganha vínculo extra** com WsDevSoft (`super_admin`)
  - Adiciona `organizacao_id TEXT` (nullable) em todas as 16+5 tabelas
  - Backfill: `UPDATE logi_xxx SET organizacao_id = '<id_leo>'`
  - Cria índices em `organizacao_id`

### Fase 2 — Backend tenant-aware

- JWT passa a carregar `organizacao_id` + `perfil_na_org`
- Endpoints novos:
  - `GET /auth/me/orgs` (lista orgs do usuário logado)
  - `POST /auth/select-org` (emite novo JWT com org escolhida)
- Middleware `requireTenant`
- Helper `db.queryTenant`

### Fase 3 — Frontend tenant-aware

- Login: 1 org → entra direto; 2+ → mostra seletor
- Header: badge "Trabalhando em: X" + dropdown "Trocar empresa"
- Persistir org ativa no localStorage

### Fase 4 — Refatorar rotas existentes

- Atualizar todas as routes que tocam as 16+5 tabelas para usar `queryTenant`
- Testar criando "Org Teste" e validando isolamento

### Fase 5 — Constraints e RLS

- `organizacao_id NOT NULL` em todas as tabelas tenant-aware
- Ativar Row-Level Security
- Configurar role `bypass_rls` para super-admins

### Fase 6 — Admin super-usuário (WsDevSoft)

- Tela `/admin/orgs` com listagem e CRUD de organizações
- Tela de criação de cliente novo (org + 1º admin) em um único fluxo
- Relatórios cross-tenant

---

## 10. Regras de ouro para qualquer dev (ou Claude) trabalhando no projeto

1. **Toda nova tabela operacional ganha `organizacao_id TEXT NOT NULL REFERENCES logi_organizacoes(id)`.** Sem exceção. Se a tabela é genuinamente global, documente o porquê neste arquivo.

2. **Toda nova rota autenticada usa `requireTenant`** após `authMiddleware`.

3. **Toda nova query em tabela tenant-aware usa `db.queryTenant(req, ...)`.** Nunca `pool.query` direto. Se precisar bypassar (super-admin), use `db.queryGlobal` que explicitamente loga a operação.

4. **Nunca confiar em `organizacao_id` vindo do body ou query string** do cliente. Sempre usar `req.organizacao_id` que veio do JWT validado.

5. **Migrations seguem o padrão `0XX_descricao.js`** em `backend/migrations/`, usando `Pool` com `DATABASE_URL`, transações e logging.

6. **Cliente novo = INSERT em `logi_organizacoes` + INSERT em `logi_usuarios_orgs` para o 1º admin.** Não precisa rodar nenhum script.

7. **Nunca renomear `organizacao_id` para `tenant_id`, `empresa_id`, etc.** Padrão é `organizacao_id` em tudo.

---

## 11. Pontos abertos (decidir quando chegarmos lá)

- **Parâmetros por organização:** hoje `logi_parametros` é global. Quando um cliente quiser parâmetros próprios, vira `(organizacao_id, chave, valor)`.
- **Branding por organização:** logo customizada no header (`logi_organizacoes.logo_url` já está previsto). Implementar quando o 2º cliente pedir.
- **Limites de plano:** campo `plano` está no schema mas sem enforcement. Quando definirmos planos (básico/pro/enterprise), criar tabela `logi_planos` com limites (max usuários, max veículos, etc.).
- **Audit log cross-tenant:** super-admin acessando dados de cliente deve ficar registrado. Implementar quando houver +5 clientes.
- **Suspensão de organização:** `logi_organizacoes.ativo = FALSE` deve bloquear login de todos os usuários daquela org (gerenciar inadimplência).

---

_Última revisão: Maio/2026. Fase atual: **1 — Fundação do schema**._
