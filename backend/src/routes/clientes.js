// ── clientes.js ───────────────────────────────────────────────
const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../db');
const router = express.Router();

const validate = [
  body('nome').notEmpty().withMessage('Nome obrigatório'),
  body('documento').notEmpty().withMessage('Documento obrigatório'),
  body('tipo_doc').isIn(['CNPJ','CPF']).withMessage('Tipo inválido'),
];

// GET /clientes — lista todos os clientes da org ativa
router.get('/', async (req, res, next) => {
  try {
    const { search, ativo = true } = req.query;
    let q = 'SELECT * FROM logi_clientes WHERE organizacao_id = $1 AND ativo = $2';
    const params = [req.organizacao_id, ativo];
    if (search) {
      params.push(`%${search}%`);
      q += ` AND (nome ILIKE $${params.length} OR documento ILIKE $${params.length})`;
    }
    q += ' ORDER BY nome';
    const { rows } = await db.query(q, params);
    res.json(rows);
  } catch (err) { next(err); }
});

// GET /clientes/:id — detalhe (com isolamento)
router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM logi_clientes WHERE id = $1 AND organizacao_id = $2',
      [req.params.id, req.organizacao_id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Não encontrado' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// POST /clientes — cria com organizacao_id da sessão
router.post('/', validate, async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });
  try {
    const {
      nome, tipo_doc, documento, email, telefone, contato,
      cep, logradouro, numero, complemento, bairro, cidade, estado, obs
    } = req.body;
    const { rows } = await db.query(
      `INSERT INTO logi_clientes
        (nome,tipo_doc,documento,email,telefone,contato,cep,logradouro,numero,complemento,bairro,cidade,estado,obs,organizacao_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
      [nome,tipo_doc,documento,email,telefone,contato,cep,logradouro,numero,complemento,bairro,cidade,estado,obs,req.organizacao_id]
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

// PUT /clientes/:id — atualização (com isolamento no WHERE)
router.put('/:id', validate, async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });
  try {
    const {
      nome,tipo_doc,documento,email,telefone,contato,
      cep,logradouro,numero,complemento,bairro,cidade,estado,obs
    } = req.body;
    const { rows } = await db.query(
      `UPDATE logi_clientes SET
        nome=$1,tipo_doc=$2,documento=$3,email=$4,telefone=$5,contato=$6,
        cep=$7,logradouro=$8,numero=$9,complemento=$10,bairro=$11,cidade=$12,estado=$13,obs=$14,
        updated_at=NOW()
       WHERE id=$15 AND organizacao_id=$16 RETURNING *`,
      [nome,tipo_doc,documento,email,telefone,contato,cep,logradouro,numero,complemento,bairro,cidade,estado,obs,req.params.id,req.organizacao_id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Não encontrado' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// DELETE /clientes/:id — soft delete (com isolamento)
router.delete('/:id', async (req, res, next) => {
  try {
    await db.query(
      'UPDATE logi_clientes SET ativo=false, updated_at=NOW() WHERE id=$1 AND organizacao_id=$2',
      [req.params.id, req.organizacao_id]
    );
    res.status(204).send();
  } catch (err) { next(err); }
});

module.exports = router;
