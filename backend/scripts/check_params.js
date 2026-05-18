require('dotenv').config({ path: 'C:\\Desenvolvimento\\logisystem\\backend\\.env' });
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const p = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });
const LOG = path.join(__dirname, '..', 'check_params.txt');
fs.writeFileSync(LOG, '');

(async () => {
  try {
    const r = await p.query(
      `SELECT column_name, data_type FROM information_schema.columns
       WHERE table_name = 'logi_parametros_cadastro_publico'
       ORDER BY ordinal_position`
    );
    let s = 'Tabela logi_parametros_cadastro_publico:\n';
    if (r.rows.length === 0) {
      s += '  NÃO EXISTE — precisa de migration!\n';
    } else {
      r.rows.forEach(c => s += `  ${c.column_name} (${c.data_type})\n`);
    }
    fs.writeFileSync(LOG, s);
    process.exit(0);
  } catch (e) {
    fs.writeFileSync(LOG, 'ERRO: ' + e.message);
    process.exit(1);
  }
})();
