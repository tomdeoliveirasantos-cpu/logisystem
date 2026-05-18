// backend/migrations/025_endereco_numero_complemento.js
// Adiciona colunas numero/complemento em logi_motorista_cadastros (cadastro público)
// e em logi_motoristas (cadastro interno — só endereço residencial), pois hoje
// só temos endereco_numero / endereco_complemento internamente.

require('dotenv').config({ path: 'C:\\Desenvolvimento\\logisystem\\backend\\.env' });
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false, max: 1 });
const LOG = path.join(__dirname, '..', 'migration_025.log');
fs.writeFileSync(LOG, '');
const log = (m) => { fs.appendFileSync(LOG, m + '\n'); console.log(m); };

const COLS_TO_ADD = [
  // Cadastro público — endereço residencial
  { table: 'logi_motorista_cadastros', col: 'numero',       type: 'VARCHAR(20)' },
  { table: 'logi_motorista_cadastros', col: 'complemento',  type: 'VARCHAR(100)' },
  // Cadastro público — endereço PJ
  { table: 'logi_motorista_cadastros', col: 'numero_pj',      type: 'VARCHAR(20)' },
  { table: 'logi_motorista_cadastros', col: 'complemento_pj', type: 'VARCHAR(100)' },
];

(async () => {
  const client = await pool.connect();
  try {
    log('=== Migration 025: numero/complemento no cadastro público ===');
    log(`Início: ${new Date().toISOString()}\n`);

    await client.query("SET lock_timeout = '5s'");
    await client.query("SET statement_timeout = '10s'");

    for (const { table, col, type } of COLS_TO_ADD) {
      try {
        const ex = await client.query(
          `SELECT 1 FROM information_schema.columns
           WHERE table_name = $1 AND column_name = $2`,
          [table, col]
        );
        if (ex.rows.length > 0) {
          log(`  ${table}.${col} já existe — pulando`);
          continue;
        }
        await client.query('BEGIN');
        await client.query(`ALTER TABLE ${table} ADD COLUMN ${col} ${type}`);
        await client.query('COMMIT');
        log(`  ${table}.${col} (${type}) adicionada`);
      } catch (e) {
        await client.query('ROLLBACK').catch(() => {});
        log(`  ${table}.${col}: ERRO -> ${e.message}`);
      }
    }

    log(`\nConcluído: ${new Date().toISOString()}`);
    process.exit(0);
  } catch (err) {
    log(`FATAL: ${err.message}`);
    process.exit(1);
  } finally {
    client.release();
  }
})();
