// Copia para a importação destino as rotas que faltam, a partir de outra
// importação da MESMA planilha (já calculada). Ajusta a organização.
require('dotenv').config();
const { Pool } = require('pg');
const p = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false, max: 2 });
(async () => {
  try {
    const origem = Number(process.argv[2]);   // ex: 1
    const destino = Number(process.argv[3]);  // ex: 2
    const dest = await p.query('SELECT organizacao_id FROM logi_rotas_importacoes WHERE id=$1', [destino]);
    const orgDest = dest.rows[0].organizacao_id;

    // tabela de valores da org destino (os valores podem diferir por org)
    const tab = await p.query('SELECT modelo, valor_km, valor_fixo FROM logi_rotas_tabela_valor WHERE organizacao_id=$1', [orgDest]);
    const vpm = {}; tab.rows.forEach((t) => { vpm[String(t.modelo).toUpperCase().trim()] = t; });
    const cfg = await p.query('SELECT incluir_volta FROM logi_rotas_config WHERE organizacao_id=$1', [orgDest]);
    const incluirVolta = cfg.rows[0] ? cfg.rows[0].incluir_volta : true;

    // rotas que existem na origem mas não no destino (chave: data + código)
    const faltam = await p.query(
      `SELECT o.* FROM logi_rotas o
        WHERE o.importacao_id = $1
          AND NOT EXISTS (
            SELECT 1 FROM logi_rotas d
             WHERE d.importacao_id = $2
               AND d.rota_codigo = o.rota_codigo
               AND d.data_rota IS NOT DISTINCT FROM o.data_rota)`,
      [origem, destino]
    );
    console.log('FALTAM=' + faltam.rows.length);

    let copiadas = 0;
    for (const r of faltam.rows) {
      const vm = vpm[String(r.modelo || '').toUpperCase().trim()];
      const kmPag = incluirVolta ? r.km_calculado_total : r.km_calculado_ida;
      const valor = (vm && kmPag != null && Number(kmPag) > 0)
        ? Math.round((Number(vm.valor_fixo) + Number(kmPag) * Number(vm.valor_km)) * 100) / 100 : null;
      const nova = await p.query(
        `INSERT INTO logi_rotas (organizacao_id, importacao_id, data_rota, rota_codigo, motorista, placa, modelo,
            regiao, qtd_paradas, km_planilha, km_calculado_ida, km_calculado_total, valor_km, valor_fixo, valor_pago, status_calculo, obs)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING id`,
        [orgDest, destino, r.data_rota, r.rota_codigo, r.motorista, r.placa, r.modelo, r.regiao, r.qtd_paradas,
         r.km_planilha, r.km_calculado_ida, r.km_calculado_total, vm ? vm.valor_km : null, vm ? vm.valor_fixo : null,
         valor, r.status_calculo, r.obs]
      );
      // copia as paradas
      await p.query(
        `INSERT INTO logi_rotas_paradas (rota_id, seq, endereco, cliente, pedido, lat, lng, geo_ok)
         SELECT $1, seq, endereco, cliente, pedido, lat, lng, geo_ok FROM logi_rotas_paradas WHERE rota_id=$2`,
        [nova.rows[0].id, r.id]
      );
      copiadas++;
    }
    // atualiza contadores da importação
    const tot = await p.query(
      `SELECT COUNT(*)::int rotas, SUM(qtd_paradas)::int paradas,
              COUNT(*) FILTER(WHERE status_calculo='ok')::int ok,
              ROUND(SUM(km_calculado_total)::numeric,0) km,
              ROUND(SUM(valor_pago)::numeric,2) valor
         FROM logi_rotas WHERE importacao_id=$1`, [destino]);
    const t = tot.rows[0];
    await p.query('UPDATE logi_rotas_importacoes SET total_rotas=$1, total_paradas=$2 WHERE id=$3', [t.rotas, t.paradas, destino]);
    console.log(`COMPLETADA copiadas=${copiadas} | rotas=${t.rotas} ok=${t.ok} km=${t.km} total=R$${t.valor}`);
  } catch (e) { console.log('ERRO:', e.message); }
  finally { await p.end(); }
})();
