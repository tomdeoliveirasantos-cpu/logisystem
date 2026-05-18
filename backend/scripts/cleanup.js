require('dotenv').config({ path: 'C:\\Desenvolvimento\\logisystem\\backend\\.env' });
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const p = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });
const LOG = path.join(__dirname, '..', 'cleanup.txt');
fs.writeFileSync(LOG, '');
const log = (m) => fs.appendFileSync(LOG, m + '\n');

(async () => {
  try {
    const r = await p.query(
      `DELETE FROM logi_motoristas WHERE nome = 'João Motorista Teste' RETURNING id`
    );
    log(`Motoristas de teste removidos: ${r.rowCount}`);

    // Estado final
    const m = await p.query(`
      SELECT o.nome AS org, COUNT(*) AS c
      FROM logi_motoristas mo JOIN logi_organizacoes o ON o.id = mo.organizacao_id
      GROUP BY o.nome ORDER BY o.nome
    `);
    log('\nEstado final de logi_motoristas:');
    m.rows.forEach(x => log(`  ${x.org}: ${x.c}`));
    process.exit(0);
  } catch (e) {
    log('ERRO: ' + e.message);
    process.exit(1);
  }
})();
