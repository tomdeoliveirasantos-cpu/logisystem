const express = require('express');
const db = require('../db');

const router = express.Router();

// Listar todos (ativos primeiro)
router.get('/', async (req, res, next) => {
  try {
    const { ativo } = req.query;
    const where = [];
    const params = [];
    if (ativo === 'true')  where.push('ativo = true');
    if (ativo === 'false') where.push('ativo = false');
    const wc = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const { rows } = await db.query(
      `SELECT * FROM logi_ajudantes ${wc} ORDER BY ativo DESC, nome`
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// Detalhe
router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT * FROM logi_ajudantes WHERE id = $1`, [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Não encontrado' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// Criar
router.post('/', async (req, res, next) => {
  try {
    const { nome, cpf, telefone, observacao } = req.body;
    if (!nome || !nome.trim()) return res.status(400).json({ error: 'Nome é obrigatório' });
    const { rows } = await db.query(
      `INSERT INTO logi_ajudantes (nome, cpf, telefone, observacao)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [nome.trim(), cpf || null, telefone || null, observacao || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Já existe um ajudante com este CPF' });
    }
    next(err);
  }
});

// Atualizar
router.put('/:id', async (req, res, next) => {
  try {
    const { nome, cpf, telefone, observacao } = req.body;
    if (!nome || !nome.trim()) return res.status(400).json({ error: 'Nome é obrigatório' });
    const { rows } = await db.query(
      `UPDATE logi_ajudantes
       SET nome=$1, cpf=$2, telefone=$3, observacao=$4
       WHERE id=$5 RETURNING *`,
      [nome.trim(), cpf || null, telefone || null, observacao || null, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Não encontrado' });
    res.json(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Já existe um ajudante com este CPF' });
    }
    next(err);
  }
});

// Ativar/Inativar
router.patch('/:id/ativo', async (req, res, next) => {
  try {
    const { ativo } = req.body;
    const { rows } = await db.query(
      `UPDATE logi_ajudantes SET ativo=$1 WHERE id=$2 RETURNING *`,
      [ativo, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Não encontrado' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

module.exports = router;
