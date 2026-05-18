// backend/src/routes/cadastro-publico-params.js
// Rota admin: gerenciar parâmetros (campos obrigatório/opcional/oculto) do
// cadastro público de colaborador, por organização.
//
// Plugado em /api/cadastro-publico-params (auth + requireTenant + requirePerfilOrg admin/super_admin)

const express = require('express');
const db = require('../db');
const { requirePerfilOrg } = require('../middleware/tenant');
const { CAMPOS, PASSOS, mergeComDefaults, sanitizar } = require('../lib/cadastro-publico-campos');

const router = express.Router();

// GET /api/cadastro-publico-params/catalogo
//   Retorna o catálogo (lista de campos disponíveis com seus defaults).
//   Útil pro frontend admin renderizar a tela.
router.get('/catalogo', async (req, res) => {
  res.json({ campos: CAMPOS, passos: PASSOS });
});

// GET /api/cadastro-publico-params
//   Retorna os parâmetros ATUAIS da org (já mesclados com defaults).
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT parametros, updated_at, updated_by
         FROM logi_parametros_cadastro_publico
        WHERE organizacao_id = $1`,
      [req.organizacao_id]
    );
    const salvos = rows[0]?.parametros || {};
    res.json({
      parametros: mergeComDefaults(salvos),
      updated_at: rows[0]?.updated_at || null,
      updated_by: rows[0]?.updated_by || null,
    });
  } catch (err) { next(err); }
});

// PUT /api/cadastro-publico-params
//   body: { parametros: { chave: 'obrigatorio'|'opcional'|'oculto', ... } }
//   Salva (upsert). Só admin/super_admin.
router.put('/', requirePerfilOrg('admin', 'super_admin'), async (req, res, next) => {
  try {
    const incoming = req.body?.parametros;
    if (!incoming || typeof incoming !== 'object') {
      return res.status(400).json({ error: 'parametros é obrigatório (objeto)' });
    }
    const sanitizado = sanitizar(incoming);

    const { rows } = await db.query(
      `INSERT INTO logi_parametros_cadastro_publico (organizacao_id, parametros, updated_at, updated_by)
       VALUES ($1, $2::jsonb, NOW(), $3)
       ON CONFLICT (organizacao_id) DO UPDATE
         SET parametros = EXCLUDED.parametros,
             updated_at = NOW(),
             updated_by = EXCLUDED.updated_by
       RETURNING parametros, updated_at, updated_by`,
      [req.organizacao_id, JSON.stringify(sanitizado), req.user?.nome || req.user?.email || null]
    );

    res.json({
      parametros: mergeComDefaults(rows[0].parametros),
      updated_at: rows[0].updated_at,
      updated_by: rows[0].updated_by,
    });
  } catch (err) { next(err); }
});

// POST /api/cadastro-publico-params/restaurar-defaults
//   Apaga o registro da org (volta a usar defaults do catálogo).
router.post('/restaurar-defaults', requirePerfilOrg('admin', 'super_admin'), async (req, res, next) => {
  try {
    await db.query(
      `DELETE FROM logi_parametros_cadastro_publico WHERE organizacao_id = $1`,
      [req.organizacao_id]
    );
    res.json({ parametros: mergeComDefaults({}), updated_at: null, updated_by: null });
  } catch (err) { next(err); }
});

module.exports = router;
