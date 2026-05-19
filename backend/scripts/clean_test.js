require('dotenv').config({ path: 'C:\\Desenvolvimento\\logisystem\\backend\\.env' });
const { Pool } = require('pg'); const fs = require('fs'); const path = require('path');
const p = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });
const LOG = path.join(__dirname, '..', 'ct.txt');
fs.writeFileSync(LOG, '');
(async () => {
  try {
    const r = await p.query(
      `DELETE FROM logi_cadastro_convites
       WHERE nome_motorista IN ('Teste Duplicacao XYZ', 'Stress Test ABC')`
    );
    fs.writeFileSync(LOG, `Removidos: ${r.rowCount}`);
    process.exit(0);
  } catch (e) { fs.writeFileSync(LOG, 'ERRO: ' + e.message); process.exit(1); }
})();
