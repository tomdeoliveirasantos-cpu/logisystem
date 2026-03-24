// ── motoristas.js ─────────────────────────────────────────────
const express = require('express');
const db = require('../db');

const motoristasRouter = express.Router();

motoristasRouter.get('/', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT mo.*, t.nome AS transportadora_nome
       FROM logi_motoristas mo
       LEFT JOIN logi_transportadoras t ON t.id = mo.transportadora_id
       WHERE mo.ativo = true ORDER BY mo.nome`
    );
    res.json(rows);
  } catch (err) { next(err); }
});

motoristasRouter.post('/', async (req, res, next) => {
  try {
    const { transportadora_id, nome, cnh, telefone } = req.body;
    const { rows } = await db.query(
      `INSERT INTO logi_motoristas (transportadora_id, nome, cnh, telefone)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [transportadora_id, nome, cnh, telefone]
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

// ── manutencoes.js ────────────────────────────────────────────
const manutencoesRouter = express.Router();

manutencoesRouter.get('/', async (req, res, next) => {
  try {
    const { veiculo_id } = req.query;
    const params = [];
    const where = [];
    if (veiculo_id) { params.push(veiculo_id); where.push(`m.veiculo_id = $1`); }
    const wc = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const { rows } = await db.query(
      `SELECT m.*, v.placa, v.modelo, v.tipo AS veiculo_tipo
       FROM logi_manutencoes m
       JOIN logi_veiculos v ON v.id = m.veiculo_id
       ${wc} ORDER BY m.data_manutencao DESC`, params
    );
    res.json(rows);
  } catch (err) { next(err); }
});

manutencoesRouter.post('/', async (req, res, next) => {
  try {
    const { veiculo_id, tipo_manutencao, componente, descricao,
            valor_orcamento, aprovado_por, data_manutencao } = req.body;
    const { rows } = await db.query(
      `INSERT INTO logi_manutencoes
        (veiculo_id, tipo_manutencao, componente, descricao,
         valor_orcamento, aprovado_por, data_manutencao)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [veiculo_id, tipo_manutencao, componente, descricao,
       valor_orcamento, aprovado_por, data_manutencao || new Date()]
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

// ── multas.js ─────────────────────────────────────────────────
const multasRouter = express.Router();

multasRouter.get('/', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT mu.*, v.placa, v.modelo, v.tipo AS veiculo_tipo, mo.nome AS motorista_nome
       FROM logi_multas mu
       JOIN logi_veiculos v  ON v.id  = mu.veiculo_id
       LEFT JOIN logi_motoristas mo ON mo.id = mu.motorista_id
       ORDER BY mu.data_infracao DESC`
    );
    res.json(rows);
  } catch (err) { next(err); }
});

multasRouter.post('/', async (req, res, next) => {
  try {
    const { veiculo_id, motorista_id, valor, motorista_indicado,
            cabe_recurso, data_infracao, descricao } = req.body;
    const { rows } = await db.query(
      `INSERT INTO logi_multas
        (veiculo_id, motorista_id, valor, motorista_indicado,
         cabe_recurso, data_infracao, descricao)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [veiculo_id, motorista_id, valor, motorista_indicado,
       cabe_recurso, data_infracao, descricao]
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

module.exports = { motoristasRouter, manutencoesRouter, multasRouter };
