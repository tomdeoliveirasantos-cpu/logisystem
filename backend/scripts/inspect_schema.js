require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const LOG = path.join(__dirname, '..', 'schema_inspect.txt');
fs.writeFileSync(LOG, '');
const log = (msg) => fs.appendFileSync(LOG, msg + '\n');

log('DATABASE_URL set=' + (!!process.env.DATABASE_URL));

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

(async () => {
  try {
    const tables = await pool.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name LIKE 'logi_%'
      ORDER BY table_name
    `);
    log(`\n=== TABELAS LOGI_* (${tables.rows.length}) ===`);
    tables.rows.forEach(r => log(`- ${r.table_name}`));

    const orgCols = await pool.query(`
      SELECT table_name, column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name LIKE 'logi_%'
        AND (column_name ILIKE '%empresa%' OR column_name ILIKE '%organiz%' OR column_name ILIKE '%tenant%' OR column_name ILIKE '%cliente_sistema%')
      ORDER BY table_name, column_name
    `);
    log(`\n=== COLUNAS EMPRESA/ORG (${orgCols.rows.length}) ===`);
    orgCols.rows.forEach(r => log(`- ${r.table_name}.${r.column_name} (${r.data_type})`));

    const userCols = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'logi_usuarios'
      ORDER BY ordinal_position
    `);
    log(`\n=== logi_usuarios SCHEMA ===`);
    userCols.rows.forEach(r => log(`- ${r.column_name} ${r.data_type}${r.is_nullable === 'NO' ? ' NOT NULL' : ''}`));

    // Conta registros nas principais tabelas
    log(`\n=== CONTAGEM DE REGISTROS ===`);
    for (const t of tables.rows) {
      try {
        const r = await pool.query(`SELECT COUNT(*) as c FROM ${t.table_name}`);
        log(`- ${t.table_name}: ${r.rows[0].c}`);
      } catch (e) {
        log(`- ${t.table_name}: ERRO ${e.message.substring(0, 40)}`);
      }
    }

    log('\nOK');
    process.exit(0);
  } catch (e) {
    log('ERRO: ' + e.message);
    log('STACK: ' + e.stack);
    process.exit(1);
  }
})();
