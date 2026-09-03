require('dotenv').config();
const { Pool } = require('pg');
const p = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });
(async()=>{
  const q = await p.query(`SELECT table_name, column_name, data_type, is_nullable, column_default
     FROM information_schema.columns
    WHERE (table_name='logi_motoristas' AND column_name='id')
       OR (table_name='logi_veiculos' AND column_name IN ('id','ag_ft','tipo','modelo'))
       OR (table_name='logi_ajudantes' AND column_name='id')
    ORDER BY table_name, column_name`);
  q.rows.forEach(r=>console.log(`${r.table_name}.${r.column_name}: ${r.data_type} null=${r.is_nullable} default=${r.column_default||'-'}`));
  const v = await p.query(`SELECT ag_ft, tipo, modelo FROM logi_veiculos LIMIT 3`);
  console.log('amostra veiculos: ' + JSON.stringify(v.rows));
  await p.end();
})().catch(e=>{console.log('ERRO',e.message);p.end();});
