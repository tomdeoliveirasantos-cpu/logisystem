require('dotenv').config();
const { Pool } = require('pg');
const p = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });
(async () => {
  const r = await p.query(`SELECT rota_codigo, motorista, modelo, qtd_paradas, km_calculado_ida, km_calculado_total, valor_pago
    FROM logi_rotas WHERE status_calculo='ok' AND valor_pago IS NOT NULL ORDER BY data_rota DESC, rota_codigo LIMIT 5`);
  r.rows.forEach(x => console.log(`${x.rota_codigo} | ${(x.motorista||'?').split(' ').slice(0,2).join(' ')} | ${x.modelo} | ${x.qtd_paradas}par | ida ${x.km_calculado_ida}km / volta ${x.km_calculado_total}km | R$ ${x.valor_pago}`));
  await p.end();
})();
