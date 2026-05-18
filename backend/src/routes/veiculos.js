const express = require('express');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const db      = require('../db');
const router  = express.Router();

// ── Upload de CRLV ─────────────────────────────────────────
const UPLOADS_DIR = path.join(__dirname, '../../uploads/veiculos');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ts   = Date.now();
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${ts}_${safe}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = ['.pdf','.jpg','.jpeg','.png'];
    cb(null, ok.includes(path.extname(file.originalname).toLowerCase()));
  },
});

// ── Listar ─────────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const { ag_ft, tipo, status_cadastro } = req.query;
    const params = [req.organizacao_id];
    const where = ['v.ativo = true', 'v.organizacao_id = $1'];
    if (ag_ft)           { params.push(ag_ft);           where.push(`v.ag_ft = $${params.length}`); }
    if (tipo)            { params.push(tipo);            where.push(`v.tipo = $${params.length}`); }
    if (status_cadastro) { params.push(status_cadastro); where.push(`v.status_cadastro = $${params.length}`); }
    const { rows } = await db.query(
      `SELECT v.*, t.nome AS transportadora_nome
       FROM logi_veiculos v
       LEFT JOIN logi_transportadoras t ON t.id = v.transportadora_id AND t.organizacao_id = v.organizacao_id
       WHERE ${where.join(' AND ')} ORDER BY v.placa`, params
    );
    res.json(rows);
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT v.*, t.nome AS transportadora_nome
       FROM logi_veiculos v
       LEFT JOIN logi_transportadoras t ON t.id = v.transportadora_id AND t.organizacao_id = v.organizacao_id
       WHERE v.id = $1 AND v.organizacao_id = $2`, [req.params.id, req.organizacao_id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Não encontrado' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// ── Cadastro completo (admin) ──────────────────────────────
router.post('/', upload.single('crlv'), async (req, res, next) => {
  try {
    const { transportadora_id, placa, modelo, tipo, ano, renavam, ag_ft,
            proprietario, responsavel, status_cadastro = 'completo' } = req.body;
    const crlv_arquivo_nome = req.file ? req.file.originalname : null;
    const crlv_arquivo_path = req.file ? req.file.filename     : null;
    const { rows } = await db.query(
      `INSERT INTO logi_veiculos
        (transportadora_id, placa, modelo, tipo, ano, renavam, ag_ft,
         proprietario, responsavel, crlv_arquivo_nome, crlv_arquivo_path, status_cadastro, organizacao_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [transportadora_id||null, placa, modelo||null, tipo, ano||null, renavam||null, ag_ft,
       proprietario||null, responsavel||null, crlv_arquivo_nome, crlv_arquivo_path, status_cadastro, req.organizacao_id]
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

// ── Pré-cadastro rápido (Supervisor) ───────────────────────
router.post('/pre-cadastro', async (req, res, next) => {
  try {
    const { placa, tipo, ag_ft, transportadora_id } = req.body;
    if (!placa || !tipo || !ag_ft) {
      return res.status(400).json({ error: 'placa, tipo e ag_ft são obrigatórios' });
    }
    const { rows } = await db.query(
      `INSERT INTO logi_veiculos
        (placa, tipo, ag_ft, transportadora_id, status_cadastro, organizacao_id)
       VALUES ($1, $2, $3, $4, 'pendente_admin', $5) RETURNING *`,
      [placa, tipo, ag_ft, transportadora_id || null, req.organizacao_id]
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

// ── Editar ─────────────────────────────────────────────────
router.put('/:id', upload.single('crlv'), async (req, res, next) => {
  try {
    const { transportadora_id, placa, modelo, tipo, ano, renavam, ag_ft,
            proprietario, responsavel, status_cadastro } = req.body;

    const sets = [];
    const params = [];
    const add = (col, val) => {
      if (val !== undefined) { params.push(val); sets.push(`${col}=$${params.length}`); }
    };
    add('transportadora_id', transportadora_id);
    add('placa', placa);
    add('modelo', modelo);
    add('tipo', tipo);
    add('ano', ano);
    add('renavam', renavam);
    add('ag_ft', ag_ft);
    add('proprietario', proprietario);
    add('responsavel', responsavel);
    add('status_cadastro', status_cadastro);
    if (req.file) {
      add('crlv_arquivo_nome', req.file.originalname);
      add('crlv_arquivo_path', req.file.filename);
    }

    if (!sets.length) return res.status(400).json({ error: 'Nada a atualizar' });

    params.push(req.params.id);
    params.push(req.organizacao_id);
    const idIdx = params.length - 1;
    const orgIdx = params.length;
    const { rows } = await db.query(
      `UPDATE logi_veiculos SET ${sets.join(',')} WHERE id=$${idIdx} AND organizacao_id=$${orgIdx} RETURNING *`,
      params
    );
    if (!rows.length) return res.status(404).json({ error: 'Não encontrado' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// ── Download CRLV ──────────────────────────────────────────
router.get('/:id/crlv', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      'SELECT crlv_arquivo_path, crlv_arquivo_nome FROM logi_veiculos WHERE id=$1 AND organizacao_id=$2',
      [req.params.id, req.organizacao_id]
    );
    if (!rows.length || !rows[0].crlv_arquivo_path) {
      return res.status(404).json({ error: 'CRLV não encontrado' });
    }
    const filePath = path.join(UPLOADS_DIR, rows[0].crlv_arquivo_path);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Arquivo não encontrado' });
    res.download(filePath, rows[0].crlv_arquivo_nome);
  } catch (err) { next(err); }
});

router.patch('/:id/desativar', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      'UPDATE logi_veiculos SET ativo=false WHERE id=$1 AND organizacao_id=$2 RETURNING *',
      [req.params.id, req.organizacao_id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Não encontrado' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

module.exports = router;
