require('dotenv').config();
const { Pool } = require('pg');
const p = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });
const PLACAS = ['FDB5C22','EVL1I34','BPB4D10','HGH2D38','FMP3C90','BYB3J54','OLI7G64','LUH8D61','JJI8F78','JAI4A92','FHG7D90','DMN3127'];
const MOTS = ['Adenilton','Edison Peres','Guilherme do Nascimento','Henrique Cesar','João Victor','Jose Felipe','Marcio Kendy','Michel Felipe','Oswaldo','Paulo Henrique','Rafael Nunes','Rodrigo De Godoi','Rodrigo Siqueira','Ronaldo Andrade'];
(async()=>{
  const orgs = await p.query('SELECT id, nome FROM logi_organizacoes WHERE ativo');
  console.log('ORGS: ' + orgs.rows.map(o=>o.nome+'='+o.id.slice(0,8)).join(' | '));
  for (const o of orgs.rows) {
    const v = await p.query(`SELECT COUNT(*)::int c FROM logi_veiculos WHERE organizacao_id=$1 AND replace(upper(placa),'-','') = ANY($2)`, [o.id, PLACAS]);
    const m = await p.query(`SELECT COUNT(*)::int c FROM logi_motoristas WHERE organizacao_id=$1`, [o.id]);
    const vt = await p.query(`SELECT COUNT(*)::int c FROM logi_veiculos WHERE organizacao_id=$1`, [o.id]);
    console.log(`  ${o.nome}: veiculos=${vt.rows[0].c} (${v.rows[0].c} das 12 placas) | motoristas=${m.rows[0].c}`);
  }
  // motoristas que batem com a lista
  const mm = await p.query(`SELECT organizacao_id, nome FROM logi_motoristas WHERE ativo ORDER BY nome`);
  const bate = mm.rows.filter(r=>MOTS.some(n=>r.nome.toLowerCase().includes(n.toLowerCase().split(' ')[0])));
  console.log('motoristas cadastrados que batem com a lista: ' + bate.length);
  bate.slice(0,6).forEach(r=>console.log('   ' + r.nome + ' (org ' + String(r.organizacao_id).slice(0,8) + ')'));
  await p.end();
})().catch(e=>{console.log('ERRO',e.message);p.end();});
