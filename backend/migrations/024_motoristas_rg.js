// backend/migrations/024_motoristas_rg.js
// Adiciona coluna rg na tabela logi_motoristas (faltante).
// Idempotente — se a coluna já existir, pula.

require('dotenv').config({ path: 'C:\\Desenvolvimento\\logisystem\\backend\\.env' });
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false, max: 1 });
const LOG = path.join(__dirname, '..', 'migration_024.log');
fs.writeFileSync(LOG, '');
const log = (m) => { fs.appendFileSync(LOG, m + '\n'); console.log(m); };

(async () => {
  const client = await pool.connect();
  try {
    log('=== Migration 024: Adicionar RG em logi_motoristas ===');
    log(`Início: ${new Date().toISOString()}\n`);

    await client.query("SET lock_timeout = '5s'");
    await client.query("SET statement_timeout = '10s'");

    // Verifica se a coluna já existe
    const check = await client.query(
      `SELECT 1 FROM information_schema.columns
       WHERE table_name = 'logi_motoristas' AND column_name = 'rg'`
    );

    if (check.rows.length > 0) {
      log('Coluna rg já existe — pulando.');
    } else {
      await client.query('BEGIN');
      await client.query(`ALTER TABLE logi_motoristas ADD COLUMN rg VARCHAR(20)`);
      await client.query('COMMIT');
      log('Coluna rg adicionada com sucesso.');
    }

    // Verificação final
    const final = await client.query(
      `SELECT column_name, data_type FROM information_schema.columns
       WHERE table_name = 'logi_motoristas' AND column_name IN ('cpf', 'rg', 'cnh')
       ORDER BY column_name`
    );
    log('\nColunas de documento finais:');
    final.rows.forEach(r => log(`  ${r.column_name} (${r.data_type})`));

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
