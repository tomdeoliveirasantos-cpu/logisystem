require('dotenv').config({ path: 'C:\\Desenvolvimento\\logisystem\\backend\\.env' });
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const p = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });
const LOG = path.join(__dirname, '..', 'precheck_022.txt');
fs.writeFileSync(LOG, '');
const log = (m) => fs.appendFileSync(LOG, m + '\n');

(async () => {
  try {
    const cols = await p.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema='public' AND table_name='logi_usuarios'
      ORDER BY ordinal_position
    `);
    log('=== logi_usuarios — todas as colunas ===');
    cols.rows.forEach(r => log(`- ${r.column_name} ${r.data_type} ${r.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'} ${r.column_default ? 'DEFAULT '+r.column_default : ''}`));
    log('\nOK');
    process.exit(0);
  } catch (e) {
    log('ERRO: ' + e.message);
    process.exit(1);
  }
})();
