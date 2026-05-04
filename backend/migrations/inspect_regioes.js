require('dotenv').config({ path: 'C:\\Desenvolvimento\\logisystem\\backend\\.env' });
const { Pool } = require('pg');
const fs = require('fs');
const p = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });
(async () => {
  const log = [];
  const r1 = await p.query(`SELECT DISTINCT regiao, sub_tabela, tipo_frete FROM logi_tabela_fretes ORDER BY 1,2`);
  log.push('=== Regiões na logi_tabela_fretes ===');
  r1.rows.forEach(r => log.push(JSON.stringify(r)));
  const r2 = await p.query(`SELECT DISTINCT regiao FROM logi_tabela_fretes WHERE tipo_frete='terceiro' AND sub_tabela='sp' ORDER BY 1`);
  log.push('\n=== Endpoint /regioes vai retornar (filtro tipo=terceiro AND sub=sp) ===');
  r2.rows.forEach(r => log.push(r.regiao));
  fs.writeFileSync(__dirname + '/regioes.log', log.join('\n'));
  await p.end();
  process.exit(0);
})();
