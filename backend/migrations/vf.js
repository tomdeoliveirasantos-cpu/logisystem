require('dotenv').config();
const { Pool } = require('pg');
const p = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });
(async()=>{
  const ORG='8d15631f97045237b0866eb1efe7d0d7';
  const v = await p.query('SELECT placa, tipo FROM logi_veiculos WHERE organizacao_id=$1 AND ativo ORDER BY placa',[ORG]);
  console.log('VEICULOS(' + v.rows.length + '): ' + v.rows.map(r=>r.placa+'/'+r.tipo).join(', '));
  const m = await p.query('SELECT nome FROM logi_motoristas WHERE organizacao_id=$1 AND ativo ORDER BY nome',[ORG]);
  console.log('MOTORISTAS(' + m.rows.length + '): ' + m.rows.map(r=>r.nome).join(' | '));
  await p.end();
})().catch(e=>{console.log('ERRO',e.message);p.end();});
