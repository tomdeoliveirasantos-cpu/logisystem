require('dotenv').config();
const { Pool } = require('pg');
const p = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });
(async()=>{
  const r = await p.query(`SELECT status_calculo, COUNT(*)::int n FROM logi_rotas WHERE importacao_id=2 GROUP BY status_calculo`);
  console.log(r.rows.map(x=>x.status_calculo+'='+x.n).join(' '));
  const parc = await p.query(`SELECT rota_codigo, obs, km_calculado_ida, valor_pago,
    (SELECT COUNT(*) FILTER(WHERE lat IS NOT NULL) FROM logi_rotas_paradas WHERE rota_id=logi_rotas.id)::int geo,
    (SELECT COUNT(*) FROM logi_rotas_paradas WHERE rota_id=logi_rotas.id)::int tot
    FROM logi_rotas WHERE importacao_id=2 AND status_calculo='parcial' LIMIT 4`);
  console.log('PARCIAIS:');
  parc.rows.forEach(x=>console.log(`  ${x.rota_codigo}: ${x.geo}/${x.tot} geo | km=${x.km_calculado_ida} | ${x.obs}`));
  await p.end();
})();
