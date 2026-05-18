require('dotenv').config({ path: 'C:\\Desenvolvimento\\logisystem\\backend\\.env' });
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });
const LOG = path.join(__dirname, '..', 'rls_check.txt');
fs.writeFileSync(LOG, '');

(async () => {
  try {
    const r = await pool.query(`
      SELECT c.relname AS tabela,
             c.relrowsecurity AS rls,
             c.relforcerowsecurity AS force,
             (SELECT COUNT(*)::int FROM pg_policy WHERE polrelid = c.oid) AS policies
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public'
         AND c.relname LIKE 'logi_%'
       ORDER BY c.relname
    `);
    let s = '';
    r.rows.forEach(row => {
      s += `${row.tabela.padEnd(30)} RLS=${row.rls} FORCE=${row.force} policies=${row.policies}\n`;
    });
    fs.writeFileSync(LOG, s);
    process.exit(0);
  } catch (e) {
    fs.writeFileSync(LOG, 'ERRO: ' + e.message);
    process.exit(1);
  }
})();
