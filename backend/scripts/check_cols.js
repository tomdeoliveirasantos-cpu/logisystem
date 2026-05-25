require('dotenv').config({ path: 'C:\\Desenvolvimento\\logisystem\\backend\\.env' });
const { Pool } = require('pg'); const fs = require('fs'); const path = require('path');
const p = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });
const LOG = path.join(__dirname, '..', 'cols.txt');
fs.writeFileSync(LOG, '');
(async () => {
  try {
    const r = await p.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'logi_usuarios_orgs'`
    );
    fs.writeFileSync(LOG, r.rows.map(c => c.column_name).join('\n'));
    process.exit(0);
  } catch (e) { fs.writeFileSync(LOG, 'ERRO: ' + e.message); process.exit(1); }
})();
