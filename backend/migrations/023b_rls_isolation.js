// backend/migrations/023b_rls_isolation.js
// V2: com lock_timeout para falhar rápido, idempotente (pula tabelas já feitas).
//
// IMPORTANTE: Antes de rodar, dar `pm2 stop logisystem-api` para liberar conexões.
// Depois `pm2 start logisystem-api`.

require('dotenv').config({ path: 'C:\\Desenvolvimento\\logisystem\\backend\\.env' });
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false,
  max: 1, // Apenas 1 conexão para evitar lock conflicts
});
const LOG = path.join(__dirname, '..', 'migration_023b.log');
fs.writeFileSync(LOG, '');
const log = (m) => { fs.appendFileSync(LOG, m + '\n'); console.log(m); };

const TENANT_TABLES = [
  'logi_clientes', 'logi_transportadoras', 'logi_veiculos', 'logi_motoristas',
  'logi_ajudantes', 'logi_fornecedores', 'logi_ordens_transporte',
  'logi_ordem_paradas', 'logi_ordem_ajudantes', 'logi_ordem_anexos',
  'logi_manutencoes', 'logi_multas', 'logi_contas_pagar', 'logi_contas_receber',
  'logi_adiantamentos', 'logi_tabela_fretes', 'logi_tabela_frete_recebido',
  'logi_reajustes_frete', 'logi_historico_ordens', 'logi_cadastro_convites',
  'logi_motorista_cadastros',
];

(async () => {
  const client = await pool.connect();
  try {
    log('=== Migration 023b: RLS Isolation (idempotente) ===');
    log(`Início: ${new Date().toISOString()}\n`);

    // Configurar timeouts para falhar rápido em locks
    await client.query("SET lock_timeout = '5s'");
    await client.query("SET statement_timeout = '10s'");

    log('PASSO 3 (idempotente): Habilitar RLS + criar policies de isolamento...');
    log('(lock_timeout=5s, statement_timeout=10s)\n');

    let okCount = 0;
    let skipCount = 0;
    let errCount = 0;

    for (const t of TENANT_TABLES) {
      try {
        // Verifica se já tem RLS+policy (idempotência)
        const check = await client.query(`
          SELECT c.relrowsecurity AS rls, c.relforcerowsecurity AS force,
                 (SELECT COUNT(*)::int FROM pg_policy WHERE polrelid = c.oid AND polname = 'tenant_isolation') AS has_policy
            FROM pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace
           WHERE n.nspname = 'public' AND c.relname = $1
        `, [t]);

        if (check.rows.length === 0) {
          log(`  ${t.padEnd(30)} TABELA NÃO EXISTE — pulando`);
          continue;
        }

        const { rls, force, has_policy } = check.rows[0];
        if (rls && force && has_policy === 1) {
          log(`  ${t.padEnd(30)} já configurado — pulando`);
          skipCount++;
          continue;
        }

        await client.query('BEGIN');
        await client.query(`ALTER TABLE ${t} ENABLE ROW LEVEL SECURITY`);
        await client.query(`DROP POLICY IF EXISTS tenant_isolation ON ${t}`);
        await client.query(`
          CREATE POLICY tenant_isolation ON ${t}
          USING (
            current_setting('app.current_org_id', true) IS NULL
            OR current_setting('app.current_org_id', true) = ''
            OR current_setting('app.current_org_id', true) = 'super_admin'
            OR organizacao_id = current_setting('app.current_org_id', true)
          )
          WITH CHECK (
            current_setting('app.current_org_id', true) IS NULL
            OR current_setting('app.current_org_id', true) = ''
            OR current_setting('app.current_org_id', true) = 'super_admin'
            OR organizacao_id = current_setting('app.current_org_id', true)
          )
        `);
        await client.query(`ALTER TABLE ${t} FORCE ROW LEVEL SECURITY`);
        await client.query('COMMIT');
        log(`  ${t.padEnd(30)} RLS + policy OK`);
        okCount++;
      } catch (e) {
        await client.query('ROLLBACK').catch(() => {});
        log(`  ${t.padEnd(30)} ERRO -> ${e.message}`);
        errCount++;
      }
    }
    log(`\nResumo: ${okCount} habilitadas | ${skipCount} já configuradas | ${errCount} erros`);

    log('\n=== Verificação final ===');
    const final = await client.query(`
      SELECT c.relname AS tabela,
             c.relrowsecurity AS rls,
             c.relforcerowsecurity AS force,
             (SELECT COUNT(*)::int FROM pg_policy WHERE polrelid = c.oid) AS policies
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relname = ANY($1::text[])
       ORDER BY c.relname
    `, [TENANT_TABLES]);
    final.rows.forEach(r => {
      log(`  ${r.tabela.padEnd(30)} RLS=${r.rls} FORCE=${r.force} policies=${r.policies}`);
    });

    log(`\nConcluído: ${new Date().toISOString()}`);
    process.exit(errCount > 0 ? 1 : 0);
  } catch (err) {
    log(`\nFATAL: ${err.message}`);
    process.exit(1);
  } finally {
    client.release();
  }
})();
