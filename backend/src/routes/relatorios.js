const express = require('express');
const db = require('../db');

const router = express.Router();

// GET /api/relatorios/faturamento?mes=2026-01
router.get('/faturamento', async (req, res, next) => {
  try {
    const { mes } = req.query; // formato YYYY-MM
    const params = mes ? [`${mes}%`] : ['%'];
    const { rows } = await db.query(
      `SELECT
         v.tipo                              AS veiculo_tipo,
         COUNT(DISTINCT o.numero_rota)       AS total_rotas,
         COUNT(o.id)                         AS total_entregas,
         SUM(CASE WHEN o.status='entregue' THEN 1 ELSE 0 END) AS entregas_ok,
         SUM(CASE WHEN o.status='devolucao' THEN 1 ELSE 0 END) AS devolucoes,
         COALESCE(SUM(cr.valor), 0)          AS valor_receber,
         COALESCE(SUM(cp.valor), 0)          AS valor_pagar,
         COALESCE(SUM(cr.valor) - SUM(cp.valor), 0) AS margem
       FROM logi_ordens_transporte o
       LEFT JOIN logi_veiculos v          ON v.id = o.veiculo_id
       LEFT JOIN logi_contas_receber cr   ON cr.ordem_id = o.id
       LEFT JOIN logi_contas_pagar cp     ON cp.ordem_id = o.id
       WHERE o.data::text LIKE $1
       GROUP BY v.tipo
       ORDER BY valor_receber DESC`,
      params
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// GET /api/relatorios/resumo-diario?data=2026-01-05
router.get('/resumo-diario', async (req, res, next) => {
  try {
    const { data } = req.query;
    const params = data ? [data] : [new Date().toISOString().split('T')[0]];
    const { rows } = await db.query(
      `SELECT
         o.numero_rota,
         m.nome                               AS motorista,
         v.placa, v.tipo                      AS veiculo,
         COUNT(o.id)                          AS paradas,
         SUM(o.peso)                          AS peso_total,
         SUM(CASE WHEN o.status='entregue'   THEN 1 ELSE 0 END) AS entregues,
         SUM(CASE WHEN o.status='devolucao'  THEN 1 ELSE 0 END) AS devolucoes,
         SUM(CASE WHEN o.status='pendente'   THEN 1 ELSE 0 END) AS pendentes,
         ROUND(
           SUM(CASE WHEN o.status='entregue' THEN 1 ELSE 0 END)::numeric /
           NULLIF(COUNT(o.id),0) * 100, 1
         )                                    AS pct_entrega
       FROM logi_ordens_transporte o
       LEFT JOIN logi_motoristas m ON m.id = o.motorista_id
       LEFT JOIN logi_veiculos   v ON v.id = o.veiculo_id
       WHERE o.data = $1
       GROUP BY o.numero_rota, m.nome, v.placa, v.tipo
       ORDER BY o.numero_rota`,
      params
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// GET /api/relatorios/evolucao-diaria?inicio=2026-01-01&fim=2026-01-31
router.get('/evolucao-diaria', async (req, res, next) => {
  try {
    const { inicio, fim } = req.query;
    const params = [inicio || '2026-01-01', fim || new Date().toISOString().split('T')[0]];
    const { rows } = await db.query(
      `SELECT
         o.data,
         COUNT(DISTINCT o.numero_rota)         AS rotas,
         COUNT(o.id)                           AS total_paradas,
         SUM(CASE WHEN o.status='entregue' THEN 1 ELSE 0 END) AS entregas,
         SUM(CASE WHEN o.status='devolucao' THEN 1 ELSE 0 END) AS devolucoes,
         COALESCE(SUM(cr.valor), 0)            AS faturado
       FROM logi_ordens_transporte o
       LEFT JOIN logi_contas_receber cr ON cr.ordem_id = o.id
       WHERE o.data BETWEEN $1 AND $2
       GROUP BY o.data
       ORDER BY o.data`,
      params
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// GET /api/relatorios/contas-pagar-resumo
router.get('/contas-pagar-resumo', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT
         t.nome AS transportadora,
         COUNT(cp.id)                          AS lancamentos,
         SUM(cp.valor)                         AS total,
         SUM(CASE WHEN cp.status='pendente' THEN cp.valor ELSE 0 END) AS em_aberto,
         SUM(CASE WHEN cp.status='pago'     THEN cp.valor ELSE 0 END) AS pago,
         SUM(CASE WHEN cp.status='vencido'  THEN cp.valor ELSE 0 END) AS vencido
       FROM logi_contas_pagar cp
       LEFT JOIN logi_transportadoras t ON t.id = cp.transportadora_id
       GROUP BY t.nome ORDER BY total DESC`
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// GET /api/relatorios/contas-receber-resumo
router.get('/contas-receber-resumo', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT
         cr.cliente,
         COUNT(cr.id)                          AS lancamentos,
         SUM(cr.valor)                         AS total,
         SUM(CASE WHEN cr.status='pendente'  THEN cr.valor ELSE 0 END) AS em_aberto,
         SUM(CASE WHEN cr.status='recebido'  THEN cr.valor ELSE 0 END) AS recebido,
         SUM(CASE WHEN cr.status='vencido'   THEN cr.valor ELSE 0 END) AS vencido
       FROM logi_contas_receber cr
       GROUP BY cr.cliente ORDER BY total DESC LIMIT 50`
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// GET /api/relatorios/rentabilidade-regiao?mes=2026-03
router.get('/rentabilidade-regiao', async (req, res, next) => {
  try {
    const { mes } = req.query;
    const params = mes ? [`${mes}%`] : ['%'];
    const { rows } = await db.query(
      `SELECT
         o.regiao,
         COUNT(o.id) AS total_ordens,
         COALESCE(SUM(cr.valor), 0) AS valor_receber,
         COALESCE(SUM(cp.valor), 0) AS valor_pagar,
         COALESCE(SUM(cr.valor) - SUM(cp.valor), 0) AS margem,
         CASE WHEN COALESCE(SUM(cr.valor),0) > 0
           THEN ROUND((SUM(cr.valor) - SUM(cp.valor))::numeric / SUM(cr.valor) * 100, 1)
           ELSE 0 END AS pct_margem
       FROM logi_ordens_transporte o
       LEFT JOIN logi_contas_receber cr ON cr.ordem_id = o.id AND cr.status != 'cancelado'
       LEFT JOIN logi_contas_pagar cp ON cp.ordem_id = o.id AND cp.status != 'cancelado'
       WHERE o.data::text LIKE $1 AND o.status != 'cancelado'
       GROUP BY o.regiao
       HAVING o.regiao IS NOT NULL
       ORDER BY margem DESC`,
      params
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// GET /api/relatorios/fechamento-mensal?mes=2026-03
router.get('/fechamento-mensal', async (req, res, next) => {
  try {
    const { mes } = req.query;
    const like = mes ? `${mes}%` : `${new Date().toISOString().slice(0,7)}%`;

    const [ordens, receber, pagar] = await Promise.all([
      db.query(
        `SELECT
           COUNT(id) AS total_ordens,
           SUM(CASE WHEN status='entregue' THEN 1 ELSE 0 END) AS entregues,
           SUM(CASE WHEN status='devolucao' THEN 1 ELSE 0 END) AS devolucoes,
           SUM(CASE WHEN status='cancelado' THEN 1 ELSE 0 END) AS cancelados,
           SUM(CASE WHEN status='pendente' THEN 1 ELSE 0 END) AS pendentes,
           COUNT(DISTINCT numero_rota) AS total_rotas,
           COUNT(DISTINCT motorista_id) AS motoristas_ativos,
           COUNT(DISTINCT veiculo_id) AS veiculos_ativos
         FROM logi_ordens_transporte WHERE data::text LIKE $1`, [like]
      ),
      db.query(
        `SELECT
           COUNT(id) AS lancamentos,
           SUM(valor) AS total,
           SUM(CASE WHEN status='pendente' THEN valor ELSE 0 END) AS em_aberto,
           SUM(CASE WHEN status='recebido' THEN valor ELSE 0 END) AS recebido,
           SUM(CASE WHEN status='cancelado' THEN valor ELSE 0 END) AS cancelado
         FROM logi_contas_receber WHERE vencimento::text LIKE $1`, [like]
      ),
      db.query(
        `SELECT
           COUNT(id) AS lancamentos,
           SUM(valor) AS total,
           SUM(CASE WHEN status='pendente' THEN valor ELSE 0 END) AS em_aberto,
           SUM(CASE WHEN status='pago' THEN valor ELSE 0 END) AS pago,
           SUM(CASE WHEN status='cancelado' THEN valor ELSE 0 END) AS cancelado,
           SUM(CASE WHEN tipo_lancamento='frete_agregado' THEN valor ELSE 0 END) AS frete_agregado,
           SUM(CASE WHEN tipo_lancamento='diaria_motorista' THEN valor ELSE 0 END) AS diaria_motorista,
           SUM(CASE WHEN tipo_lancamento='diaria_ajudante' THEN valor ELSE 0 END) AS diaria_ajudante
         FROM logi_contas_pagar WHERE vencimento::text LIKE $1`, [like]
      ),
    ]);

    res.json({
      mes: mes || new Date().toISOString().slice(0,7),
      ordens: ordens.rows[0],
      receber: receber.rows[0],
      pagar: pagar.rows[0],
      margem: (Number(receber.rows[0]?.total) || 0) - (Number(pagar.rows[0]?.total) || 0),
    });
  } catch (err) { next(err); }
});

// GET /api/relatorios/notificacoes — contas vencendo/vencidas
router.get('/notificacoes', async (req, res, next) => {
  try {
    const hoje = new Date().toISOString().split('T')[0];
    const em7dias = new Date(Date.now() + 7*86400000).toISOString().split('T')[0];

    const [cpVencidas, crVencidas, cpVencendo, crVencendo] = await Promise.all([
      db.query("SELECT count(*)::int as c, COALESCE(sum(valor),0) as v FROM logi_contas_pagar WHERE status='pendente' AND vencimento < $1", [hoje]),
      db.query("SELECT count(*)::int as c, COALESCE(sum(valor),0) as v FROM logi_contas_receber WHERE status='pendente' AND vencimento < $1", [hoje]),
      db.query("SELECT count(*)::int as c, COALESCE(sum(valor),0) as v FROM logi_contas_pagar WHERE status='pendente' AND vencimento BETWEEN $1 AND $2", [hoje, em7dias]),
      db.query("SELECT count(*)::int as c, COALESCE(sum(valor),0) as v FROM logi_contas_receber WHERE status='pendente' AND vencimento BETWEEN $1 AND $2", [hoje, em7dias]),
    ]);

    res.json({
      pagar_vencidas: cpVencidas.rows[0],
      receber_vencidas: crVencidas.rows[0],
      pagar_vencendo_7d: cpVencendo.rows[0],
      receber_vencendo_7d: crVencendo.rows[0],
    });
  } catch (err) { next(err); }
});

// GET /api/relatorios/romaneio?data=2026-03-26&rota=4800
router.get('/romaneio', async (req, res, next) => {
  try {
    const { data, rota } = req.query;
    if (!data) return res.status(400).json({ error: 'Data é obrigatória' });

    const params = [data];
    const where = ['o.data = $1'];
    if (rota) { params.push(rota); where.push(`o.numero_rota = $${params.length}`); }

    const { rows } = await db.query(
      `SELECT o.*, m.nome AS motorista_nome, v.placa, v.tipo AS veiculo_tipo,
              c.nome AS cliente_cadastrado, c.logradouro, c.numero AS cli_numero, c.bairro, c.cidade
       FROM logi_ordens_transporte o
       LEFT JOIN logi_motoristas m ON m.id = o.motorista_id
       LEFT JOIN logi_veiculos v ON v.id = o.veiculo_id
       LEFT JOIN logi_clientes c ON c.id = o.cliente_id
       WHERE ${where.join(' AND ')}
       ORDER BY o.numero_rota, o.seq`,
      params
    );

    // Agrupar por rota
    const rotas = {};
    rows.forEach(r => {
      const key = r.numero_rota || 'sem_rota';
      if (!rotas[key]) rotas[key] = { rota: r.numero_rota, motorista: r.motorista_nome, veiculo: `${r.veiculo_tipo} - ${r.placa}`, paradas: [] };
      rotas[key].paradas.push(r);
    });

    res.json({ data, rotas: Object.values(rotas) });
  } catch (err) { next(err); }
});

// GET /api/relatorios/km-por-veiculo?mes=2026-03
router.get('/km-por-veiculo', async (req, res, next) => {
  try {
    const { mes } = req.query;
    const like = mes ? `${mes}%` : `${new Date().toISOString().slice(0,7)}%`;
    const { rows } = await db.query(
      `SELECT v.placa, v.tipo, v.modelo,
              COUNT(o.id) AS viagens,
              COALESCE(SUM(o.km_chegada - o.km_saida), 0) AS km_total,
              COALESCE(AVG(o.km_chegada - o.km_saida), 0) AS km_medio
       FROM logi_ordens_transporte o
       JOIN logi_veiculos v ON v.id = o.veiculo_id
       WHERE o.data::text LIKE $1 AND o.km_saida IS NOT NULL AND o.km_chegada IS NOT NULL
       GROUP BY v.placa, v.tipo, v.modelo
       ORDER BY km_total DESC`,
      [like]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

module.exports = router;
