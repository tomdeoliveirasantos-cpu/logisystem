const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../db');

const router = express.Router();

const validate = [
  body('nome').notEmpty().withMessage('Nome obrigatório'),
  body('cnpj').matches(/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/).withMessage('CNPJ inválido'),
  body('tipo').isIn(['proprio','terceiros']).withMessage('Tipo inválido'),
];

// GET /api/transportadoras
router.get('/', async (req, res, next) => {
  try {
    const { tipo, ativo = true } = req.query;
    let q = 'SELECT * FROM logi_transportadoras WHERE ativo = $1';
    const params = [ativo];
    if (tipo) { params.push(tipo); q += ` AND tipo = $${params.length}`; }
    q += ' ORDER BY nome';
    const { rows } = await db.query(q, params);
    res.json(rows);
  } catch (err) { next(err); }
});

// GET /api/transportadoras/:id
router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM logi_transportadoras WHERE id = $1', [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Não encontrado' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// POST /api/transportadoras
router.post('/', validate, async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });
  try {
    const { nome, cnpj, email_operacional, email_financeiro,
            telefone_contato, telefone_financeiro, tipo } = req.body;
    const { rows } = await db.query(
      `INSERT INTO logi_transportadoras
        (nome, cnpj, email_operacional, email_financeiro,
         telefone_contato, telefone_financeiro, tipo)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [nome, cnpj, email_operacional, email_financeiro,
       telefone_contato, telefone_financeiro, tipo]
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

// PUT /api/transportadoras/:id
router.put('/:id', validate, async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });
  try {
    const { nome, cnpj, email_operacional, email_financeiro,
            telefone_contato, telefone_financeiro, tipo } = req.body;
    const { rows } = await db.query(
      `UPDATE logi_transportadoras SET
        nome=$1, cnpj=$2, email_operacional=$3, email_financeiro=$4,
        telefone_contato=$5, telefone_financeiro=$6, tipo=$7, updated_at=NOW()
       WHERE id=$8 RETURNING *`,
      [nome, cnpj, email_operacional, email_financeiro,
       telefone_contato, telefone_financeiro, tipo, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Não encontrado' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// DELETE /api/transportadoras/:id  (soft delete)
router.delete('/:id', async (req, res, next) => {
  try {
    await db.query(
      'UPDATE logi_transportadoras SET ativo=false, updated_at=NOW() WHERE id=$1',
      [req.params.id]
    );
    res.status(204).send();
  } catch (err) { next(err); }
});

module.exports = router;
