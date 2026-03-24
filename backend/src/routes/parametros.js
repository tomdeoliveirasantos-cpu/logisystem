const express = require('express');
const db      = require('../db');
const { requirePerfil } = require('../middleware/auth');
const router  = express.Router();

// GET /api/parametros — todos podem ler
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await db.query('SELECT * FROM logi_parametros ORDER BY chave');
    // Retorna como objeto { chave: valor }
    const obj = {};
    rows.forEach(r => obj[r.chave] = r.valor);
    res.json(obj);
  } catch(err) { next(err); }
});

// PUT /api/parametros — só admin
router.put('/', requirePerfil('admin'), async (req, res, next) => {
  try {
    const params = req.body; // { chave: valor, ... }
    for (const [chave, valor] of Object.entries(params)) {
      await db.query(
        `INSERT INTO logi_parametros (chave, valor) VALUES ($1,$2)
         ON CONFLICT (chave) DO UPDATE SET valor=$2, updated_at=NOW()`,
        [chave, valor]
      );
    }
    const { rows } = await db.query('SELECT * FROM logi_parametros ORDER BY chave');
    const obj = {};
    rows.forEach(r => obj[r.chave] = r.valor);
    res.json(obj);
  } catch(err) { next(err); }
});

module.exports = router;
