require('dotenv').config();
const { Pool } = require('pg');
const p = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });
(async()=>{
  const r = await p.query(`SELECT importacao_id,
    COUNT(*)::int rotas,
    COUNT(*) FILTER (WHERE km_planilha IS NOT NULL)::int com_planilha,
    COUNT(*) FILTER (WHERE km_planilha IS NOT NULL AND km_calculado_total IS NOT NULL)::int comparaveis,
    ROUND(SUM(km_planilha) FILTER (WHERE km_planilha IS NOT NULL AND km_calculado_total IS NOT NULL)::numeric,1) km_planilha,
    ROUND(SUM(km_calculado_total) FILTER (WHERE km_planilha IS NOT NULL AND km_calculado_total IS NOT NULL)::numeric,1) km_calc_volta,
    ROUND(SUM(km_calculado_ida) FILTER (WHERE km_planilha IS NOT NULL AND km_calculado_ida IS NOT NULL)::numeric,1) km_calc_ida
    FROM logi_rotas GROUP BY importacao_id ORDER BY importacao_id`);
  r.rows.forEach(x=>console.log(`imp=${x.importacao_id} rotas=${x.rotas} com_planilha=${x.com_planilha} comparaveis=${x.comparaveis} | planilha=${x.km_planilha} ida=${x.km_calc_ida} ida+volta=${x.km_calc_volta}`));
  await p.end();
})();
