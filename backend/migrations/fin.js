require('dotenv').config();
const { Pool } = require('pg');
const p = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });
(async()=>{
  const t = await p.query(`SELECT COUNT(*)::int rotas, COUNT(*) FILTER(WHERE status_calculo='ok')::int ok,
    COUNT(*) FILTER(WHERE status_calculo='falha')::int falha,
    ROUND(SUM(km_calculado_ida)::numeric,0) km_ida, ROUND(SUM(km_calculado_total)::numeric,0) km_tot,
    ROUND(SUM(valor_pago)::numeric,2) total FROM logi_rotas WHERE importacao_id=2`);
  const x=t.rows[0];
  console.log(`ROTAS=${x.rotas} OK=${x.ok} SEM_ENDERECO=${x.falha}`);
  console.log(`KM_IDA=${x.km_ida} KM_IDA_VOLTA=${x.km_tot} TOTAL=R$${x.total}`);
  const mot = await p.query(`SELECT motorista, COUNT(*)::int rotas, ROUND(SUM(km_calculado_total)::numeric,0) km, ROUND(SUM(valor_pago)::numeric,2) valor
    FROM logi_rotas WHERE importacao_id=2 AND valor_pago IS NOT NULL GROUP BY motorista ORDER BY valor DESC LIMIT 6`);
  console.log('\nTOP MOTORISTAS:');
  mot.rows.forEach(m=>console.log(`  ${(m.motorista||'?').split(' ').slice(0,2).join(' ')}: ${m.rotas} rotas | ${m.km} km | R$ ${m.valor}`));
  await p.end();
})();
