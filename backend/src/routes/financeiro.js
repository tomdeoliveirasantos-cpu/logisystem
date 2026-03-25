const express = require('express');
const db = require('../db');

const router = express.Router();

// ── CONTAS A RECEBER ──────────────────────────────────────────
// GET /api/financeiro/receber
router.get('/receber', async (req, res, next) => {
  try {
    const { status, vencimento_ate } = req.query;
    const params = [];
    const where = [];
    if (status) { params.push(status); where.push(`cr.status = $${params.length}`); }
    if (vencimento_ate) { params.push(vencimento_ate); where.push(`cr.vencimento <= $${params.length}`); }
    const wc = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const { rows } = await db.query(
      `SELECT cr.*, o.numero_rota, o.data AS data_entrega,
              v.tipo AS veiculo_tipo, tf.regiao, tf.valor_base AS frete_referencia
       FROM logi_contas_receber cr
       LEFT JOIN logi_ordens_transporte o ON o.id = cr.ordem_id
       LEFT JOIN logi_ordens_transporte ot ON ot.id = cr.ordem_id
       LEFT JOIN logi_veiculos v ON v.id = ot.veiculo_id
       LEFT JOIN logi_tabela_fretes tf ON tf.id = cr.tabela_frete_id
       ${wc} ORDER BY cr.vencimento`, params
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// POST /api/financeiro/receber
router.post('/receber', async (req, res, next) => {
  try {
    const { ordem_id, tabela_frete_id, cliente, valor, vencimento, obs } = req.body;
    const { rows } = await db.query(
      `INSERT INTO logi_contas_receber (ordem_id, tabela_frete_id, cliente, valor, vencimento, obs)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [ordem_id, tabela_frete_id, cliente, valor, vencimento, obs]
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

// PATCH /api/financeiro/receber/:id/pagar
router.patch('/receber/:id/receber', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `UPDATE logi_contas_receber
       SET status='recebido', data_pagamento=CURRENT_DATE
       WHERE id=$1 RETURNING *`, [req.params.id]
    );
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// ── CONTAS A PAGAR ────────────────────────────────────────────
// GET /api/financeiro/pagar
router.get('/pagar', async (req, res, next) => {
  try {
    const { status } = req.query;
    const params = [];
    const where = [];
    if (status) { params.push(status); where.push(`cp.status = $${params.length}`); }
    const wc = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const { rows } = await db.query(
      `SELECT cp.*, t.nome AS transportadora_nome, m.nome AS motorista_nome,
              tf.regiao, tf.valor_base AS frete_referencia,
              cp.tipo_lancamento, cp.descricao
       FROM logi_contas_pagar cp
       LEFT JOIN logi_transportadoras t ON t.id = cp.transportadora_id
       LEFT JOIN logi_motoristas m ON m.id = cp.motorista_id
       LEFT JOIN logi_tabela_fretes tf ON tf.id = cp.tabela_frete_id
       ${wc} ORDER BY cp.vencimento`, params
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// POST /api/financeiro/pagar
router.post('/pagar', async (req, res, next) => {
  try {
    const { ordem_id, tabela_frete_id, transportadora_id, motorista_id, valor, vencimento, obs } = req.body;
    const { rows } = await db.query(
      `INSERT INTO logi_contas_pagar
        (ordem_id, tabela_frete_id, transportadora_id, motorista_id, valor, vencimento, obs)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [ordem_id, tabela_frete_id, transportadora_id, motorista_id, valor, vencimento, obs]
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

// PATCH /api/financeiro/pagar/:id/pagar
router.patch('/pagar/:id/pagar', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `UPDATE logi_contas_pagar
       SET status='pago', data_pagamento=CURRENT_DATE
       WHERE id=$1 RETURNING *`, [req.params.id]
    );
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// GET /api/financeiro/fretes  (tabela de referência)
router.get('/fretes', async (req, res, next) => {
  try {
    const { tipo_frete, tipo_veiculo } = req.query;
    const params = [];
    const where = [];
    if (tipo_frete)   { params.push(tipo_frete);   where.push(`tipo_frete = $${params.length}`); }
    if (tipo_veiculo) { params.push(tipo_veiculo); where.push(`tipo_veiculo = $${params.length}`); }
    const wc = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const { rows } = await db.query(
      `SELECT * FROM logi_tabela_fretes ${wc} ORDER BY tipo_frete, regiao, tipo_veiculo`, params
    );
    res.json(rows);
  } catch (err) { next(err); }
});


// ── CRUD TABELA FRETES ────────────────────────────────────────
router.post('/fretes', async (req, res, next) => {
  try {
    const { regiao, tipo_veiculo, km_max, valor_base, tipo_frete } = req.body;
    const { rows } = await db.query(
      `INSERT INTO logi_tabela_fretes (regiao,tipo_veiculo,km_max,valor_base,tipo_frete)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [regiao, tipo_veiculo, km_max||null, valor_base, tipo_frete]
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

router.put('/fretes/:id', async (req, res, next) => {
  try {
    const { regiao, tipo_veiculo, km_max, valor_base, tipo_frete } = req.body;
    const { rows } = await db.query(
      `UPDATE logi_tabela_fretes SET regiao=$1,tipo_veiculo=$2,km_max=$3,valor_base=$4,tipo_frete=$5
       WHERE id=$6 RETURNING *`,
      [regiao, tipo_veiculo, km_max||null, valor_base, tipo_frete, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Não encontrado' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

router.delete('/fretes/:id', async (req, res, next) => {
  try {
    await db.query('DELETE FROM logi_tabela_fretes WHERE id=$1', [req.params.id]);
    res.status(204).send();
  } catch (err) { next(err); }
});

module.exports = router;
