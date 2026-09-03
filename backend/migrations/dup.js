require('dotenv').config();
const { Pool } = require('pg');
const p = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });
const ORG='8d15631f97045237b0866eb1efe7d0d7';
(async()=>{
  // "GUILHEME" (grafia antiga, com erro) x "Guilherme" (criado agora) -> duplicado
  const r = await p.query(`SELECT id, nome, created_at FROM logi_motoristas
     WHERE organizacao_id=$1 AND upper(nome) LIKE 'GUILH%' ORDER BY created_at`,[ORG]);
  r.rows.forEach(x=>console.log(`  ${x.id.slice(0,8)} | ${x.nome} | criado ${String(x.created_at).slice(0,10)}`));
  if (r.rows.length === 2) {
    const antigo = r.rows[0], novo = r.rows[1];
    // mantém o registro antigo (tem histórico), corrige a grafia e desativa o duplicado
    await p.query('UPDATE logi_motoristas SET nome=$1 WHERE id=$2', ['Guilherme do Nascimento Silva', antigo.id]);
    await p.query('UPDATE logi_motoristas SET ativo=false WHERE id=$1', [novo.id]);
    console.log('RESOLVIDO: mantido o registro com histórico (grafia corrigida), duplicado desativado');
  }
  await p.end();
})().catch(e=>{console.log('ERRO',e.message);p.end();});
