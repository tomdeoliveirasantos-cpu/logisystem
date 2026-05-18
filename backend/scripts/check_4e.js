require('dotenv').config({ path: 'C:\\Desenvolvimento\\logisystem\\backend\\.env' });
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const p = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });
const LOG = path.join(__dirname, '..', 'check_4e.txt');
fs.writeFileSync(LOG, '');

(async () => {
  try {
    let s = '';
    const tables = ['logi_cadastro_convites','logi_motorista_cadastros','logi_motoristas'];
    for (const t of tables) {
      const cols = await p.query(
        `SELECT column_name, data_type FROM information_schema.columns
         WHERE table_name=$1 ORDER BY ordinal_position`, [t]
      );
      s += `\n${t}:\n`;
      cols.rows.forEach(c => s += `  ${c.column_name} (${c.data_type})\n`);
    }
    // Contagem por org
    for (const t of ['logi_cadastro_convites','logi_motorista_cadastros']) {
      try {
        const r = await p.query(`SELECT COALESCE(o.nome,'—') AS org, COUNT(*) AS c
                                  FROM ${t} x LEFT JOIN logi_organizacoes o ON o.id=x.organizacao_id
                                  GROUP BY o.nome ORDER BY o.nome`);
        s += `\n${t}:\n`;
        r.rows.forEach(x => s += `  ${x.org}: ${x.c}\n`);
      } catch (e) {
        s += `\n${t}: ERRO -> ${e.message}\n`;
      }
    }
    fs.writeFileSync(LOG, s);
    process.exit(0);
  } catch (e) {
    fs.writeFileSync(LOG, 'ERRO: ' + e.message);
    process.exit(1);
  }
})();
