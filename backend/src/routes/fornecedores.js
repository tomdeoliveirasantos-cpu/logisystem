const express = require('express');
const db = require('../db');

const router = express.Router();

// Listar todos (ativos primeiro)
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT * FROM logi_fornecedores ORDER BY ativo DESC, nome`
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// Criar
router.post('/', async (req, res, next) => {
  try {
    const { nome, cnpj_cpf, telefone, tipo } = req.body;
    if (!nome || !nome.trim()) return res.status(400).json({ error: 'Nome é obrigatório' });
    const { rows } = await db.query(
      `INSERT INTO logi_fornecedores (nome, cnpj_cpf, telefone, tipo)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [nome.trim(), cnpj_cpf || null, telefone || null, tipo || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

// Atualizar
router.put('/:id', async (req, res, next) => {
  try {
    const { nome, cnpj_cpf, telefone, tipo } = req.body;
    if (!nome || !nome.trim()) return res.status(400).json({ error: 'Nome é obrigatório' });
    const { rows } = await db.query(
      `UPDATE logi_fornecedores SET nome=$1, cnpj_cpf=$2, telefone=$3, tipo=$4, updated_at=NOW()
       WHERE id=$5 RETURNING *`,
      [nome.trim(), cnpj_cpf || null, telefone || null, tipo || null, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Não encontrado' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// Ativar/Inativar
router.patch('/:id/ativo', async (req, res, next) => {
  try {
    const { ativo } = req.body;
    const { rows } = await db.query(
      `UPDATE logi_fornecedores SET ativo=$1, updated_at=NOW() WHERE id=$2 RETURNING *`,
      [ativo, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Não encontrado' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

module.exports = router;
