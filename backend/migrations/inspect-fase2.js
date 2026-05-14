require('dotenv').config({ path: 'C:\\Desenvolvimento\\logisystem\\backend\\.env' });
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const p = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });

(async () => {
  const out = [];
  const log = (m) => { console.log(m); out.push(m); };

  // logi_motoristas (foco: cpf, senha)
  log('=== logi_motoristas (cols) ===');
  const m = await p.query(`SELECT column_name, udt_name, character_maximum_length FROM information_schema.columns WHERE table_name='logi_motoristas' ORDER BY ordinal_position`);
  m.rows.forEach(c => log(`  ${c.column_name.padEnd(28)} ${c.udt_name}${c.character_maximum_length?'('+c.character_maximum_length+')':''}`));

  // logi_ordem_paradas (foco: tudo)
  log('\n=== logi_ordem_paradas (cols) ===');
  const op = await p.query(`SELECT column_name, udt_name FROM information_schema.columns WHERE table_name='logi_ordem_paradas' ORDER BY ordinal_position`);
  op.rows.forEach(c => log(`  ${c.column_name.padEnd(28)} ${c.udt_name}`));

  // sample do status atual
  log('\n=== status distintos em logi_ordem_paradas ===');
  const s = await p.query(`SELECT status, count(*) FROM logi_ordem_paradas GROUP BY status ORDER BY count(*) DESC`);
  s.rows.forEach(r => log(`  ${r.status?.padEnd(20)} : ${r.count}`));

  fs.writeFileSync(path.join(__dirname,'inspect-fase2.log'), out.join('\n'));
  await p.end();
  process.exit(0);
})();
