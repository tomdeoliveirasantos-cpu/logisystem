require('dotenv').config({ path: 'C:\\Desenvolvimento\\logisystem\\backend\\.env' });
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const p = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });
const LOG = path.join(__dirname, '..', 'leo_clientes.txt');
fs.writeFileSync(LOG, '');

(async () => {
  try {
    const r = await p.query(`
      SELECT c.id, c.nome, o.nome AS org
      FROM logi_clientes c
      JOIN logi_organizacoes o ON o.id = c.organizacao_id
      ORDER BY o.nome, c.nome
    `);
    let s = '';
    r.rows.forEach(c => s += `${c.org} | ${c.nome} | id=${c.id}\n`);
    fs.writeFileSync(LOG, s);
    process.exit(0);
  } catch (e) {
    fs.writeFileSync(LOG, 'ERRO: ' + e.message);
    process.exit(1);
  }
})();
