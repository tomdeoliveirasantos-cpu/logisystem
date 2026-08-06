require('dotenv').config();
const { Pool } = require('pg');
const p = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });
(async()=>{
  try{
    const c = await p.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name='logi_organizacoes' ORDER BY ordinal_position`);
    console.log('COLUNAS:', c.rows.map(r=>r.column_name+':'+r.data_type).join(', '));
    const o = await p.query('SELECT * FROM logi_organizacoes LIMIT 3');
    console.log('AMOSTRA:', JSON.stringify(o.rows).slice(0,300));
  }catch(e){console.log('ERRO',e.message);}
  finally{await p.end();}
})();
