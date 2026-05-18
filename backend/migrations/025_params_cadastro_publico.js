// backend/migrations/025_params_cadastro_publico.js
// Cria tabela logi_parametros_cadastro_publico (por org).
// Estrutura: organizacao_id PK + parametros JSONB
//   {
//     "campo_chave": "obrigatorio" | "opcional" | "oculto",
//     ...
//   }

require('dotenv').config({ path: 'C:\\Desenvolvimento\\logisystem\\backend\\.env' });
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false, max: 1 });
const LOG = path.join(__dirname, '..', 'migration_025.log');
fs.writeFileSync(LOG, '');
const log = (m) => { fs.appendFileSync(LOG, m + '\n'); console.log(m); };

(async () => {
  const client = await pool.connect();
  try {
    log('=== Migration 025: Parametros do Cadastro Publico ===');
    log(`Início: ${new Date().toISOString()}\n`);

    await client.query("SET lock_timeout = '5s'");
    await client.query("SET statement_timeout = '15s'");

    // Verifica se já existe
    const check = await client.query(`
      SELECT 1 FROM information_schema.tables
       WHERE table_schema='public' AND table_name='logi_parametros_cadastro_publico'
    `);

    if (check.rows.length > 0) {
      log('Tabela logi_parametros_cadastro_publico já existe — pulando criação.');
    } else {
      await client.query('BEGIN');
      await client.query(`
        CREATE TABLE logi_parametros_cadastro_publico (
          organizacao_id TEXT PRIMARY KEY REFERENCES logi_organizacoes(id) ON DELETE CASCADE,
          parametros JSONB NOT NULL DEFAULT '{}'::jsonb,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_by TEXT
        )
      `);
      await client.query('COMMIT');
      log('Tabela criada com sucesso.');
    }

    // RLS — mesma policy padrão das outras tabelas tenant
    try {
      await client.query('BEGIN');
      await client.query('ALTER TABLE logi_parametros_cadastro_publico ENABLE ROW LEVEL SECURITY');
      await client.query('DROP POLICY IF EXISTS tenant_isolation ON logi_parametros_cadastro_publico');
      await client.query(`
        CREATE POLICY tenant_isolation ON logi_parametros_cadastro_publico
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
      await client.query('ALTER TABLE logi_parametros_cadastro_publico FORCE ROW LEVEL SECURITY');
      await client.query('COMMIT');
      log('RLS + policy aplicados.');
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      log(`Aviso RLS: ${e.message}`);
    }

    log(`\nConcluído: ${new Date().toISOString()}`);
    process.exit(0);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    log(`FATAL: ${err.message}`);
    process.exit(1);
  } finally {
    client.release();
  }
})();
