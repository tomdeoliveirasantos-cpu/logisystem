require('dotenv').config();
const { Pool } = require('pg');
const p = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });
(async()=>{
  for (const t of ['logi_motoristas','logi_veiculos','logi_usuarios','logi_ajudantes']) {
    const c = await p.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name=$1 ORDER BY ordinal_position`,[t]);
    console.log(t + ': ' + c.rows.map(r=>r.column_name).join(', '));
  }
  const u = await p.query(`SELECT DISTINCT perfil_na_org FROM logi_usuarios_organizacoes`).catch(()=>({rows:[]}));
  console.log('perfis em uso: ' + u.rows.map(r=>r.perfil_na_org).join(', '));
  await p.end();
})().catch(e=>{console.log('ERRO',e.message);p.end();});
