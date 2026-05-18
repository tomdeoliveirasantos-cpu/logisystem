require('dotenv').config({ path: 'C:\\Desenvolvimento\\logisystem\\backend\\.env' });
const { Pool } = require('pg');
const fs = require('fs'); const path = require('path');
const p = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });
const LOG = path.join(__dirname, '..', 'check_end.txt');
fs.writeFileSync(LOG, '');
(async () => {
  try {
    const r = await p.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'logi_motorista_cadastros'
         AND column_name ~ '(endereco|numero|num|bairro|cidade|estado|cep|complemento)'
       ORDER BY column_name`
    );
    let s = '';
    r.rows.forEach(c => s += `${c.column_name}\n`);
    fs.writeFileSync(LOG, s);
    process.exit(0);
  } catch (e) {
    fs.writeFileSync(LOG, 'ERRO: ' + e.message);
    process.exit(1);
  }
})();
