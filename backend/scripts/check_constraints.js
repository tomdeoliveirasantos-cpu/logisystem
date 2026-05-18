require('dotenv').config({ path: 'C:\\Desenvolvimento\\logisystem\\backend\\.env' });
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const p = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });
const LOG = path.join(__dirname, '..', 'constraints.txt');
fs.writeFileSync(LOG, '');

(async () => {
  try {
    const tables = ['logi_motoristas','logi_ajudantes','logi_veiculos','logi_clientes','logi_transportadoras','logi_fornecedores'];
    let s = '';

    for (const t of tables) {
      const r = await p.query(`
        SELECT i.relname AS idx_name, a.attname AS col, ix.indisunique AS uniq
        FROM pg_index ix
        JOIN pg_class c ON c.oid = ix.indrelid
        JOIN pg_class i ON i.oid = ix.indexrelid
        JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = ANY(ix.indkey)
        WHERE c.relname = $1
          AND ix.indisunique = TRUE
        ORDER BY i.relname
      `, [t]);
      s += `${t}:\n`;
      r.rows.forEach(c => s += `  - ${c.idx_name} on ${c.col} unique=${c.uniq}\n`);
      if (!r.rows.length) s += `  (sem constraints unique)\n`;
      s += '\n';
    }
    fs.writeFileSync(LOG, s);
    process.exit(0);
  } catch (e) {
    fs.writeFileSync(LOG, 'ERRO: ' + e.message);
    process.exit(1);
  }
})();
