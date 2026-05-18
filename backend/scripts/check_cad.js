require('dotenv').config({ path: 'C:\\Desenvolvimento\\logisystem\\backend\\.env' });
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const p = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });
const LOG = path.join(__dirname, '..', 'check_cad.txt');
fs.writeFileSync(LOG, '');

(async () => {
  try {
    const cols = await p.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'logi_motorista_cadastros'
         AND column_name IN ('cpf','rg','cnh_numero','cnh_categoria','cnh_validade')
       ORDER BY column_name`
    );
    let s = 'Colunas relevantes em logi_motorista_cadastros:\n';
    cols.rows.forEach(c => s += `  ${c.column_name}\n`);
    fs.writeFileSync(LOG, s);
    process.exit(0);
  } catch (e) {
    fs.writeFileSync(LOG, 'ERRO: ' + e.message);
    process.exit(1);
  }
})();
