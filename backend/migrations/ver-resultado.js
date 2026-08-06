require('dotenv').config();
const { Pool } = require('pg');
const p = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });
(async () => {
  try {
    const imp = await p.query("SELECT * FROM logi_rotas_importacoes ORDER BY created_at DESC LIMIT 1");
    console.log('IMPORTAÇÃO:', imp.rows[0].arquivo_nome, '| rotas:', imp.rows[0].total_rotas);
    const amostra = await p.query(`SELECT data_rota, rota_codigo, motorista, modelo, qtd_paradas, km_calculado_ida, km_calculado_total, valor_pago, status_calculo
      FROM logi_rotas WHERE importacao_id=$1 AND status_calculo='ok' ORDER BY valor_pago DESC LIMIT 5`, [imp.rows[0].id]);
    console.log('\nTOP 5 ROTAS POR VALOR:');
    amostra.rows.forEach(r => console.log(`  ${r.rota_codigo} | ${(r.motorista||'?').split(' ').slice(0,2).join(' ')} | ${r.modelo} | ${r.qtd_paradas}par | ${r.km_calculado_ida}km ida / ${r.km_calculado_total}km volta | R$ ${r.valor_pago}`));
    const tot = await p.query(`SELECT COUNT(*)::int rotas, COUNT(*) FILTER(WHERE status_calculo='ok')::int ok,
      ROUND(SUM(km_calculado_total)::numeric,0) km, ROUND(SUM(valor_pago)::numeric,2) valor FROM logi_rotas WHERE importacao_id=$1`, [imp.rows[0].id]);
    const t = tot.rows[0];
    console.log(`\nTOTAIS: ${t.rotas} rotas | ${t.ok} calculadas | ${t.km} km | R$ ${t.valor}`);
  } catch (e) { console.log('ERRO:', e.message); }
  finally { await p.end(); }
})();
