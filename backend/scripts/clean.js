require('dotenv').config({ path: 'C:\\Desenvolvimento\\logisystem\\backend\\.env' });
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const p = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });
const LOG = path.join(__dirname, '..', 'clean.txt');
fs.writeFileSync(LOG, '');
(async () => {
  try {
    const r = await p.query(
      `DELETE FROM logi_motoristas WHERE nome = 'João Teste' AND organizacao_id = 'fcb4f2ec605481cb49c6ee7807db0565'`
    );
    fs.writeFileSync(LOG, `Removidos: ${r.rowCount}`);
    process.exit(0);
  } catch (e) {
    fs.writeFileSync(LOG, 'ERRO: ' + e.message);
    process.exit(1);
  }
})();
