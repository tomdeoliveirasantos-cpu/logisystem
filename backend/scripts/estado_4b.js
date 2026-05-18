require('dotenv').config({ path: 'C:\\Desenvolvimento\\logisystem\\backend\\.env' });
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const p = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });
const LOG = path.join(__dirname, '..', 'estado_4b.txt');
fs.writeFileSync(LOG, '');

(async () => {
  try {
    const tabelas = [
      'logi_clientes', 'logi_transportadoras', 'logi_veiculos',
      'logi_fornecedores', 'logi_ajudantes',
    ];

    let s = '=== Distribuição por organização após Fase 4b ===\n\n';
    for (const t of tabelas) {
      const r = await p.query(`
        SELECT COALESCE(o.nome,'— SEM ORG —') AS org, COUNT(*) AS c
        FROM ${t} x LEFT JOIN logi_organizacoes o ON o.id = x.organizacao_id
        GROUP BY o.nome ORDER BY o.nome
      `);
      s += `${t}:\n`;
      if (!r.rows.length) s += `  (vazia)\n`;
      else r.rows.forEach(x => s += `  ${x.org} = ${x.c}\n`);
      s += '\n';
    }
    fs.writeFileSync(LOG, s);
    process.exit(0);
  } catch (e) {
    fs.writeFileSync(LOG, 'ERRO: ' + e.message);
    process.exit(1);
  }
})();
