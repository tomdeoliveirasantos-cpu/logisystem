require('dotenv').config({ path: 'C:\\Desenvolvimento\\logisystem\\backend\\.env' });
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const p = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });
const LOG = path.join(__dirname, '..', 'check_user_cols.txt');
fs.writeFileSync(LOG, '');
const log = (m) => fs.appendFileSync(LOG, m + '\n');

(async () => {
  try {
    const r = await p.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema='public' AND table_name='logi_usuarios'
      ORDER BY ordinal_position
    `);
    log('=== logi_usuarios columns ===');
    r.rows.forEach(c => log(`- ${c.column_name} ${c.data_type} nullable=${c.is_nullable} default=${c.column_default || '—'}`));

    // valores distintos de perfil
    const p2 = await p.query(`SELECT DISTINCT perfil FROM logi_usuarios ORDER BY perfil`);
    log(`\nperfis distintos: ${p2.rows.map(x => x.perfil).join(', ')}`);

    log('OK');
    process.exit(0);
  } catch (e) { log('ERRO: '+e.message); process.exit(1); }
})();
