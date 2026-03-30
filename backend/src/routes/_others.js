// ── motoristas.js ─────────────────────────────────────────────
const express = require('express');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const db = require('../db');

const motoristasRouter = express.Router();

motoristasRouter.get('/', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT mo.*, t.nome AS transportadora_nome,
              v.placa AS veiculo_padrao_placa, v.tipo AS veiculo_padrao_tipo
       FROM logi_motoristas mo
       LEFT JOIN logi_transportadoras t ON t.id = mo.transportadora_id
       LEFT JOIN logi_veiculos v ON v.id = mo.veiculo_padrao_id
       WHERE mo.ativo = true ORDER BY mo.nome`
    );
    res.json(rows);
  } catch (err) { next(err); }
});

motoristasRouter.post('/', async (req, res, next) => {
  try {
    const { transportadora_id, nome, cnh, telefone, veiculo_padrao_id } = req.body;
    const { rows } = await db.query(
      `INSERT INTO logi_motoristas (transportadora_id, nome, cnh, telefone, veiculo_padrao_id)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [transportadora_id, nome, cnh, telefone, veiculo_padrao_id || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

motoristasRouter.put('/:id', async (req, res, next) => {
  try {
    const { transportadora_id, nome, cnh, telefone, veiculo_padrao_id } = req.body;
    const { rows } = await db.query(
      `UPDATE logi_motoristas SET transportadora_id=$1, nome=$2, cnh=$3, telefone=$4, veiculo_padrao_id=$5, updated_at=NOW()
       WHERE id=$6 RETURNING *`,
      [transportadora_id, nome, cnh, telefone, veiculo_padrao_id || null, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Não encontrado' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// ── manutencoes.js ────────────────────────────────────────────
const manutencoesRouter = express.Router();

// Configuração de upload para orçamentos
const UPLOADS_DIR = path.join(__dirname, '../../uploads/manutencoes');
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
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (req, file, cb) => {
    const ok = ['.pdf','.jpg','.jpeg','.png'];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, ok.includes(ext));
  },
});

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

manutencoesRouter.post('/', upload.single('orcamento_anexo'), async (req, res, next) => {
  try {
    const { veiculo_id, tipo_manutencao, componente, descricao,
            valor_orcamento, aprovado_por, data_manutencao, data_vencimento, fornecedor } = req.body;
    const orcamento_anexo = req.file ? `manutencoes/${req.file.filename}` : null;
    const { rows } = await db.query(
      `INSERT INTO logi_manutencoes
        (veiculo_id, tipo_manutencao, componente, descricao,
         valor_orcamento, aprovado_por, data_manutencao, data_vencimento,
         fornecedor, orcamento_anexo)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [veiculo_id, tipo_manutencao, componente, descricao,
       valor_orcamento, aprovado_por, data_manutencao || new Date(), data_vencimento || null,
       fornecedor || null, orcamento_anexo]
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
