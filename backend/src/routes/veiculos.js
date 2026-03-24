// ── veiculos.js ───────────────────────────────────────────────
const express = require('express');
const db = require('../db');
const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const { ag_ft, tipo } = req.query;
    const params = [];
    const where = ['v.ativo = true'];
    if (ag_ft) { params.push(ag_ft); where.push(`v.ag_ft = $${params.length}`); }
    if (tipo)  { params.push(tipo);  where.push(`v.tipo = $${params.length}`); }
    const { rows } = await db.query(
      `SELECT v.*, t.nome AS transportadora_nome
       FROM logi_veiculos v
       LEFT JOIN logi_transportadoras t ON t.id = v.transportadora_id
       WHERE ${where.join(' AND ')} ORDER BY v.placa`, params
    );
    res.json(rows);
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const { transportadora_id, placa, modelo, tipo, ano, renavam, ag_ft } = req.body;
    const { rows } = await db.query(
      `INSERT INTO logi_veiculos (transportadora_id, placa, modelo, tipo, ano, renavam, ag_ft)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [transportadora_id, placa, modelo, tipo, ano, renavam, ag_ft]
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

module.exports = router;
