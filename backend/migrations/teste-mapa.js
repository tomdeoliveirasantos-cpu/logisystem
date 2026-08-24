require('dotenv').config();
const geo = require('../src/lib/geo');
const { Pool } = require('pg');
const p = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });
(async () => {
  try {
    const r = await p.query(`SELECT id, rota_codigo, km_calculado_ida, km_calculado_total, organizacao_id
      FROM logi_rotas WHERE status_calculo='ok' AND km_calculado_total IS NOT NULL ORDER BY qtd_paradas DESC LIMIT 1`);
    const rota = r.rows[0];
    const cfg = await p.query('SELECT * FROM logi_rotas_config WHERE organizacao_id=$1', [rota.organizacao_id]);
    const cd = { lat: cfg.rows[0].cd_lat, lng: cfg.rows[0].cd_lng };
    const par = await p.query('SELECT lat,lng FROM logi_rotas_paradas WHERE rota_id=$1 AND lat IS NOT NULL ORDER BY seq', [rota.id]);
    const pontos = [cd, ...par.rows, cd];
    const g = await geo.rotaOSRMComTracado(pontos);
    console.log(`rota ${rota.rota_codigo} | paradas=${par.rows.length}`);
    console.log(`km gravado (ida+volta)=${rota.km_calculado_total}`);
    console.log(`km do tracado=${g ? g.km : 'null'} | pontos do desenho=${g ? g.tracado.coordinates.length : 0} | ${g ? g.minutos : '?'} min`);
    console.log('CONFERE=' + (g && Math.abs(g.km - Number(rota.km_calculado_total)) < 1 ? 'SIM' : 'VERIFICAR'));
  } catch (e) { console.log('ERRO:', e.message); }
  finally { await p.end(); }
})();
