// backend/src/db/index.js
// Pool de conexões com isolamento por tenant via Postgres RLS.
//
// Estratégia:
// 1. AsyncLocalStorage guarda o organizacao_id da request atual
// 2. Quando alguém chama db.query() ou db.pool.connect(), pegamos uma conexão
//    e setamos `app.current_org_id` (SET LOCAL) numa transação implícita,
//    ou via SET (não-local) na conexão e RESET ao devolver.
// 3. Se não há contexto (jobs, scripts), nenhum GUC é setado → modo soft
//    onde a policy permite tudo (preserva compatibilidade).
//
// Para super-admin queries cross-tenant: setar org='super_admin' no contexto.

const { Pool } = require('pg');
const { AsyncLocalStorage } = require('async_hooks');

const tenantStorage = new AsyncLocalStorage();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('connect', () => console.log('✓ Conectado ao PostgreSQL em 15.235.54.115'));
pool.on('error', (err) => console.error('✗ Erro no pool:', err.message));

// Pega o GUC a ser setado a partir do contexto atual.
// Retorna null se não há contexto (ex: script CLI).
function getOrgContextGuc() {
  const ctx = tenantStorage.getStore();
  if (!ctx) return null;
  if (ctx.isSuperAdmin) return 'super_admin';
  return ctx.organizacaoId || null;
}

/**
 * Executa uma query com o contexto de tenant aplicado.
 * Wrapper transparente sobre pool.query.
 */
async function query(text, params) {
  const guc = getOrgContextGuc();

  if (!guc) {
    // Sem contexto — query global (modo soft, RLS permite tudo)
    return pool.query(text, params);
  }

  // Com contexto: pega conexão dedicada, seta GUC, executa, RESET, devolve
  const client = await pool.connect();
  try {
    // SET é por sessão; aplicado apenas a esta conexão.
    // Usamos set_config (que aceita parâmetro) para evitar SQL injection.
    await client.query("SELECT set_config('app.current_org_id', $1, false)", [guc]);
    return await client.query(text, params);
  } finally {
    // RESET antes de devolver ao pool, pra próxima request pegar conexão limpa
    try {
      await client.query("SELECT set_config('app.current_org_id', '', false)");
    } catch (_) { /* ignore */ }
    client.release();
  }
}

/**
 * Connect com GUC já setado. Usar em fluxos de transação manual:
 *   const c = await db.pool.connect();
 *   try { ... } finally { c.release(); }
 * Este wrapper aplica o GUC antes de devolver e garante RESET no release.
 *
 * NOTA: o release continua sendo o do pg padrão; o RESET é feito ANTES do release
 * via um proxy.
 */
async function connectWithTenant() {
  const guc = getOrgContextGuc();
  const client = await pool.connect();
  if (guc) {
    await client.query("SELECT set_config('app.current_org_id', $1, false)", [guc]);
  }
  const origRelease = client.release.bind(client);
  client.release = async (...args) => {
    try {
      await client.query("SELECT set_config('app.current_org_id', '', false)");
    } catch (_) { /* ignore */ }
    return origRelease(...args);
  };
  return client;
}

/**
 * Middleware Express: roda o resto da request dentro de um AsyncLocalStorage
 * com o organizacao_id resolvido pelo requireTenant. Deve ser chamado APÓS
 * o requireTenant.
 */
function tenantContextMiddleware(req, res, next) {
  if (!req.organizacao_id) return next();
  const ctx = {
    organizacaoId: req.organizacao_id,
    isSuperAdmin: req.is_super_admin === true,
  };
  tenantStorage.run(ctx, () => next());
}

/**
 * Helper para rodar bloco com contexto específico (útil em jobs/scripts).
 */
function runWithTenant(organizacaoId, fn, opts = {}) {
  return tenantStorage.run(
    { organizacaoId, isSuperAdmin: !!opts.isSuperAdmin },
    fn
  );
}

async function testConnection() {
  try {
    const client = await pool.connect();
    const { rows } = await client.query('SELECT NOW() AS agora, current_database() AS banco');
    console.log(`✓ Banco: ${rows[0].banco} | Servidor: ${rows[0].agora}`);
    client.release();
    return true;
  } catch (err) {
    console.error('✗ Falha ao conectar:', err.message);
    return false;
  }
}

// Proxy do pool: intercepta .connect() para aplicar GUC automaticamente
const wrappedPool = new Proxy(pool, {
  get(target, prop) {
    if (prop === 'connect') {
      // Se há contexto, usa o wrapper; senão, usa o connect raw
      return () => {
        const guc = getOrgContextGuc();
        if (guc) return connectWithTenant();
        return target.connect();
      };
    }
    return target[prop];
  },
});

module.exports = {
  query,
  pool: wrappedPool,
  testConnection,
  tenantContextMiddleware,
  runWithTenant,
  tenantStorage,
};
