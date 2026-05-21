const express = require('express');
const db = require('../db');

const router = express.Router();

// Listar todos (ativos primeiro)
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT * FROM logi_fornecedores WHERE organizacao_id = $1 ORDER BY ativo DESC, nome`,
      [req.organizacao_id]
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
      `INSERT INTO logi_fornecedores (nome, cnpj_cpf, telefone, tipo, organizacao_id)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [nome.trim(), cnpj_cpf || null, telefone || null, tipo || null, req.organizacao_id]
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
       WHERE id=$5 AND organizacao_id=$6 RETURNING *`,
      [nome.trim(), cnpj_cpf || null, telefone || null, tipo || null, req.params.id, req.organizacao_id]
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
      `UPDATE logi_fornecedores SET ativo=$1, updated_at=NOW() WHERE id=$2 AND organizacao_id=$3 RETURNING *`,
      [ativo, req.params.id, req.organizacao_id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Não encontrado' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// ────────────────────────────────────────────────────────────
// TIPOS DE FORNECEDOR (gerenciáveis pelo admin da org)
// ────────────────────────────────────────────────────────────

// GET /fornecedores/tipos — Lista tipos da org (ordenado por label)
router.get('/tipos', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT id, valor, label, is_padrao
         FROM logi_fornecedor_tipos
        WHERE organizacao_id = $1
        ORDER BY is_padrao DESC, label ASC`,
      [req.organizacao_id]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// POST /fornecedores/tipos — Adiciona novo tipo (apenas admin)
//   body: { label }  (valor é derivado do label automaticamente)
router.post('/tipos', async (req, res, next) => {
  try {
    const { label } = req.body;
    const labelTrim = (label || '').trim();
    if (!labelTrim) return res.status(400).json({ error: 'Nome do tipo é obrigatório' });
    if (labelTrim.length > 100) return res.status(400).json({ error: 'Nome do tipo muito longo (máx 100 caracteres)' });

    // Gera valor a partir do label: minúsculo, sem acento, sem espaço
    const valor = labelTrim
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 50);

    if (!valor) return res.status(400).json({ error: 'Nome inválido' });

    const { rows } = await db.query(
      `INSERT INTO logi_fornecedor_tipos (organizacao_id, valor, label, is_padrao, created_by)
       VALUES ($1, $2, $3, FALSE, $4)
       RETURNING id, valor, label, is_padrao`,
      [req.organizacao_id, valor, labelTrim, req.user?.nome || 'admin']
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Já existe um tipo com esse nome.' });
    }
    next(err);
  }
});

// DELETE /fornecedores/tipos/:id — Remove tipo (apenas se não estiver em uso)
router.delete('/tipos/:id', async (req, res, next) => {
  try {
    // Verifica se algum fornecedor usa esse tipo
    const tipoInfo = await db.query(
      `SELECT valor, is_padrao FROM logi_fornecedor_tipos
        WHERE id = $1 AND organizacao_id = $2`,
      [req.params.id, req.organizacao_id]
    );
    if (!tipoInfo.rows.length) {
      return res.status(404).json({ error: 'Tipo não encontrado' });
    }

    const uso = await db.query(
      `SELECT COUNT(*)::int AS qt FROM logi_fornecedores
        WHERE organizacao_id = $1 AND tipo = $2`,
      [req.organizacao_id, tipoInfo.rows[0].valor]
    );
    if (uso.rows[0].qt > 0) {
      return res.status(409).json({
        error: `Não é possível remover: ${uso.rows[0].qt} fornecedor(es) usando este tipo. Reclassifique antes.`,
      });
    }

    await db.query(
      `DELETE FROM logi_fornecedor_tipos WHERE id = $1 AND organizacao_id = $2`,
      [req.params.id, req.organizacao_id]
    );
    res.status(204).send();
  } catch (err) { next(err); }
});

module.exports = router;
