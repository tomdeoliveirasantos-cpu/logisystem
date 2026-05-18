const express = require('express');
const db = require('../db');
const router = express.Router();

// ════════════════════════════════════════════════════════════════
// REAJUSTES DE FRETE — gestão de % de reajuste com vigência por data
// ════════════════════════════════════════════════════════════════

// GET /api/reajustes — listar todos
router.get('/', async (req, res, next) => {
  try {
    const { tipo } = req.query;
    let sql = `SELECT id, tipo, percentual, data_vigencia, descricao, created_at
               FROM logi_reajustes_frete
               WHERE organizacao_id = $1`;
    const params = [req.organizacao_id];
    if (tipo) { sql += ` AND tipo = $${params.length + 1}`; params.push(tipo); }
    sql += ` ORDER BY data_vigencia DESC, id DESC`;
    const { rows } = await db.query(sql, params);
    res.json(rows);
  } catch (err) { next(err); }
});

// GET /api/reajustes/fator?tipo=recebido&data=2026-04-20
//    → retorna o multiplicador acumulado naquela data
router.get('/fator', async (req, res, next) => {
  try {
    const { tipo = 'recebido', data } = req.query;
    if (!data) return res.status(400).json({ error: 'data obrigatória (YYYY-MM-DD)' });
    const { rows } = await db.query(
      `SELECT percentual FROM logi_reajustes_frete
       WHERE tipo = $1 AND data_vigencia <= $2 AND organizacao_id = $3`,
      [tipo, data, req.organizacao_id]
    );
    let fator = 1.0;
    rows.forEach(r => { fator *= (1 + parseFloat(r.percentual) / 100); });
    res.json({ tipo, data, fator: Number(fator.toFixed(6)), reajustes_aplicados: rows.length });
  } catch (err) { next(err); }
});

// POST /api/reajustes — criar
router.post('/', async (req, res, next) => {
  try {
    const { tipo = 'recebido', percentual, data_vigencia, descricao } = req.body;
    if (percentual === undefined || percentual === null) {
      return res.status(400).json({ error: 'percentual obrigatório' });
    }
    if (!data_vigencia) return res.status(400).json({ error: 'data_vigencia obrigatória' });

    const { rows } = await db.query(
      `INSERT INTO logi_reajustes_frete (tipo, percentual, data_vigencia, descricao, organizacao_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [tipo, percentual, data_vigencia, descricao || null, req.organizacao_id]
    );
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// PUT /api/reajustes/:id — atualizar
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { tipo, percentual, data_vigencia, descricao } = req.body;
    const { rows } = await db.query(
      `UPDATE logi_reajustes_frete
       SET tipo = COALESCE($1, tipo),
           percentual = COALESCE($2, percentual),
           data_vigencia = COALESCE($3, data_vigencia),
           descricao = COALESCE($4, descricao)
       WHERE id = $5 AND organizacao_id = $6
       RETURNING *`,
      [tipo, percentual, data_vigencia, descricao, id, req.organizacao_id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'reajuste não encontrado' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// DELETE /api/reajustes/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { rowCount } = await db.query(
      `DELETE FROM logi_reajustes_frete WHERE id = $1 AND organizacao_id = $2`,
      [id, req.organizacao_id]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'reajuste não encontrado' });
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;

// ════════════════════════════════════════════════════════════════
// Helper exportado pra ser usado no cálculo de CAR/CAP
// ════════════════════════════════════════════════════════════════
module.exports.getFatorReajuste = async function (client, tipo, data, organizacaoId) {
  const { rows } = await client.query(
    `SELECT percentual FROM logi_reajustes_frete
     WHERE tipo = $1 AND data_vigencia <= $2 AND organizacao_id = $3`,
    [tipo, data, organizacaoId]
  );
  let fator = 1.0;
  rows.forEach(r => { fator *= (1 + parseFloat(r.percentual) / 100); });
  return fator;
};
