require('dotenv').config();
const { Pool } = require('pg');
const p = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });
const VALORES = { HR:[2.016,477.10], IVECO:[2.830,513.71], '3.4':[3.340,650.82], TOCO:[3.840,883.13], '3/4':[3.340,650.82], TRUCK:[3.840,883.13] };
(async () => {
  try {
    // rotas 'ok' mas com valor_pago nulo (recuperadas sem km_total)
    const r = await p.query(`SELECT id, modelo, km_calculado_ida, km_calculado_total FROM logi_rotas
      WHERE status_calculo='ok' AND valor_pago IS NULL`);
    console.log('rotas ok sem valor:', r.rows.length);
    let corr = 0;
    for (const row of r.rows) {
      const mod = String(row.modelo || '').toUpperCase().trim();
      const vm = VALORES[mod];
      if (!vm) continue;
      // se não tem km_total, usa km_ida como aproximação do total (será recalculado no próximo cálculo real)
      const kmTot = row.km_calculado_total ?? row.km_calculado_ida;
      if (kmTot == null) continue;
      const valor = Math.round((vm[1] + kmTot * vm[0]) * 100) / 100;
      await p.query(`UPDATE logi_rotas SET km_calculado_total=COALESCE(km_calculado_total,$1), valor_km=$2, valor_fixo=$3, valor_pago=$4 WHERE id=$5`,
        [row.km_calculado_ida, vm[0], vm[1], valor, row.id]);
      corr++;
    }
    console.log('CORRIGIDAS=' + corr);
    const tot = await p.query(`SELECT COUNT(*) FILTER(WHERE status_calculo='ok')::int ok, COUNT(*) FILTER(WHERE valor_pago IS NOT NULL)::int com_valor, ROUND(SUM(valor_pago)::numeric,2) total FROM logi_rotas`);
    console.log('AGORA: ok=' + tot.rows[0].ok + ' com_valor=' + tot.rows[0].com_valor + ' total=R$' + tot.rows[0].total);
  } catch (e) { console.log('ERRO:', e.message); }
  finally { await p.end(); }
})();
