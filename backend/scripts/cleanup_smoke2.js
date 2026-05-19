require('dotenv').config({ path: 'C:\\Desenvolvimento\\logisystem\\backend\\.env' });
const { Pool } = require('pg'); const fs = require('fs'); const path = require('path');
const p = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });
const LOG = path.join(__dirname, '..', 'cleanup2.txt');
fs.writeFileSync(LOG, '');
(async () => {
  try {
    const r1 = await p.query(`DELETE FROM logi_motorista_cadastros WHERE nome = 'Smoke Test User'`);
    const r2 = await p.query(`DELETE FROM logi_cadastro_convites WHERE nome_motorista = 'Smoke Test User'`);
    fs.writeFileSync(LOG, `Cadastros: ${r1.rowCount}, Convites: ${r2.rowCount}`);
    process.exit(0);
  } catch (e) { fs.writeFileSync(LOG, 'ERRO: ' + e.message); process.exit(1); }
})();
