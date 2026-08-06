require('dotenv').config();
const { Pool } = require('pg');
const p = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });
(async () => {
  try {
    const imps = await p.query('SELECT id, organizacao_id, arquivo_nome, total_rotas, status FROM logi_rotas_importacoes ORDER BY id');
    console.log('IMPORTACOES:');
    imps.rows.forEach(i => console.log(`  id=${i.id} org=${i.organizacao_id.slice(0,8)} "${i.arquivo_nome}" total=${i.total_rotas} status=${i.status}`));
    const st = await p.query(`SELECT importacao_id, status_calculo, COUNT(*)::int n,
        COUNT(*) FILTER (WHERE km_calculado_ida IS NOT NULL)::int com_ida,
        COUNT(*) FILTER (WHERE km_calculado_total IS NOT NULL)::int com_tot,
        COUNT(*) FILTER (WHERE valor_pago IS NOT NULL)::int com_valor
      FROM logi_rotas GROUP BY importacao_id, status_calculo ORDER BY importacao_id, status_calculo`);
    console.log('\nROTAS POR IMPORTACAO/STATUS:');
    st.rows.forEach(r => console.log(`  imp=${r.importacao_id} ${r.status_calculo}: ${r.n} (ida=${r.com_ida} tot=${r.com_tot} valor=${r.com_valor})`));
    // paradas com geo
    const pg = await p.query(`SELECT COUNT(*)::int total, COUNT(*) FILTER (WHERE lat IS NOT NULL)::int com_geo FROM logi_rotas_paradas`);
    console.log(`\nPARADAS: ${pg.rows[0].total} total, ${pg.rows[0].com_geo} com coordenada`);
    // amostra de rota com falha
    const f = await p.query(`SELECT r.id, r.rota_codigo, r.km_calculado_ida, r.km_calculado_total, r.valor_pago, r.obs,
        (SELECT COUNT(*) FILTER (WHERE lat IS NOT NULL) FROM logi_rotas_paradas WHERE rota_id=r.id)::int paradas_geo,
        (SELECT COUNT(*) FROM logi_rotas_paradas WHERE rota_id=r.id)::int paradas_tot
      FROM logi_rotas r WHERE r.status_calculo='falha' LIMIT 3`);
    console.log('\nAMOSTRA FALHA:');
    f.rows.forEach(r => console.log(`  rota ${r.rota_codigo}: ${r.paradas_geo}/${r.paradas_tot} paradas com geo | ida=${r.km_calculado_ida} tot=${r.km_calculado_total} valor=${r.valor_pago} obs=${r.obs}`));
  } catch (e) { console.log('ERRO:', e.message); }
  finally { await p.end(); }
})();
