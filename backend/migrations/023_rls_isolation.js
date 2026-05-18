// backend/migrations/023_rls_isolation.js
// Habilita Row Level Security (defesa em profundidade) em todas as 21 tabelas tenant.
//
// ESTRATÉGIA:
// 1. Marca organizacao_id como NOT NULL (impede registros órfãos)
// 2. Habilita RLS na tabela
// 3. Cria policy que isola por GUC app.current_org_id
//    - Se GUC vazio (current_setting com fallback NULL), a policy PERMITE TUDO
//      → conexões legadas (sem SET) continuam funcionando, mas precisamos confiar
//        no filtro WHERE do backend (defesa secundária ativa: filtros manuais).
//    - Se GUC = 'super_admin', a policy PERMITE TUDO (bypass)
//    - Caso contrário, exige organizacao_id = GUC
//
// Depois de validar tudo, uma migration 024 vai endurecer: remover o fallback,
// fazendo RLS bloquear queries sem GUC setado.

require('dotenv').config({ path: 'C:\\Desenvolvimento\\logisystem\\backend\\.env' });
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });
const LOG = path.join(__dirname, '..', 'migration_023.log');
fs.writeFileSync(LOG, '');
const log = (m) => { fs.appendFileSync(LOG, m + '\n'); console.log(m); };

// Tabelas tenant — todas têm organizacao_id TEXT
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
    log('=== Migration 023: RLS Isolation ===');
    log(`Início: ${new Date().toISOString()}\n`);

    // ── PASSO 1: Backfill organizacao_id NULL → Léo Madeiras ───────────
    // Por segurança, registros sem org viram da Léo (única org com dados de produção).
    // Isso garante que NOT NULL não vai falhar.
    const LEO_ID = '8d15631f97045237b0866eb1efe7d0d7';
    log('PASSO 1: Backfill registros órfãos para Léo...');
    for (const t of TENANT_TABLES) {
      try {
        const r = await client.query(
          `UPDATE ${t} SET organizacao_id = $1 WHERE organizacao_id IS NULL`,
          [LEO_ID]
        );
        if (r.rowCount > 0) log(`  ${t}: ${r.rowCount} órfãos vinculados à Léo`);
      } catch (e) {
        log(`  ${t}: ERRO no backfill -> ${e.message}`);
      }
    }
    log('');

    // ── PASSO 2: Marcar como NOT NULL ──────────────────────────────────
    log('PASSO 2: ALTER COLUMN organizacao_id SET NOT NULL...');
    for (const t of TENANT_TABLES) {
      try {
        // Usar SAVEPOINT pra isolar falhas individuais
        await client.query('BEGIN');
        await client.query(`ALTER TABLE ${t} ALTER COLUMN organizacao_id SET NOT NULL`);
        await client.query('COMMIT');
        log(`  ${t}: NOT NULL OK`);
      } catch (e) {
        await client.query('ROLLBACK').catch(() => {});
        log(`  ${t}: ERRO -> ${e.message}`);
      }
    }
    log('');

    // ── PASSO 3: Habilitar RLS + criar policies ──────────────────────────
    log('PASSO 3: Habilitar RLS + criar policies de isolamento...');
    for (const t of TENANT_TABLES) {
      try {
        await client.query('BEGIN');

        // Habilita RLS
        await client.query(`ALTER TABLE ${t} ENABLE ROW LEVEL SECURITY`);

        // Drop policy antiga se existir (idempotência)
        await client.query(`DROP POLICY IF EXISTS tenant_isolation ON ${t}`);

        // Cria policy:
        //   - current_setting('app.current_org_id', true) com 2º arg true = fallback NULL
        //   - Se NULL ou vazio: permite TUDO (modo soft, não quebra conexões legadas)
        //   - Se 'super_admin': permite TUDO (bypass)
        //   - Caso contrário: exige match com organizacao_id
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

        // Importante: o owner da tabela bypassa RLS por padrão.
        // Como o usuário da app (wsdevsof_dev) PODE ser o owner, forçar policy.
        await client.query(`ALTER TABLE ${t} FORCE ROW LEVEL SECURITY`);

        await client.query('COMMIT');
        log(`  ${t}: RLS + policy OK`);
      } catch (e) {
        await client.query('ROLLBACK').catch(() => {});
        log(`  ${t}: ERRO -> ${e.message}`);
      }
    }
    log('');

    // ── PASSO 4: Verificar resultado ───────────────────────────────────
    log('PASSO 4: Verificação do schema final...');
    const check = await client.query(`
      SELECT c.relname AS tabela,
             c.relrowsecurity AS rls_habilitado,
             c.relforcerowsecurity AS rls_forcado,
             (SELECT COUNT(*) FROM pg_policy WHERE polrelid = c.oid) AS num_policies
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public'
         AND c.relname = ANY($1::text[])
       ORDER BY c.relname
    `, [TENANT_TABLES]);
    check.rows.forEach(r => {
      log(`  ${r.tabela.padEnd(30)} RLS=${r.rls_habilitado} FORCE=${r.rls_forcado} policies=${r.num_policies}`);
    });

    log(`\nMigration 023 concluída: ${new Date().toISOString()}`);
    process.exit(0);
  } catch (err) {
    log(`\nFATAL: ${err.message}\n${err.stack}`);
    process.exit(1);
  } finally {
    client.release();
  }
})();
