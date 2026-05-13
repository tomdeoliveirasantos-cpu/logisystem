const express = require('express');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const db = require('../db');

const router = express.Router();

// Upload de comprovante (PDF/imagem) — mesmo padrão de motoristas/manutenções
const ADTO_UPLOADS_DIR = path.join(__dirname, '../../uploads/adiantamentos');
if (!fs.existsSync(ADTO_UPLOADS_DIR)) fs.mkdirSync(ADTO_UPLOADS_DIR, { recursive: true });

const adtoStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, ADTO_UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ts = Date.now();
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${ts}_${safe}`);
  },
});
const adtoUpload = multer({
  storage: adtoStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = ['.pdf','.jpg','.jpeg','.png'];
    cb(null, ok.includes(path.extname(file.originalname).toLowerCase()));
  },
});

// SELECT base com todos os JOINs úteis
const SELECT_BASE = `
  SELECT
    a.*,
    mo.nome     AS motorista_nome,
    mo.tipo_colaborador AS motorista_tipo,
    aj.nome     AS ajudante_nome,
    aj.cpf      AS ajudante_cpf,
    v.placa     AS veiculo_placa,
    v.tipo      AS veiculo_tipo,
    o.numero_rota,
    u.nome      AS criado_por_nome,
    cp_orig.tipo_lancamento AS cp_origem_tipo,
    cp_orig.status          AS cp_origem_status
  FROM logi_adiantamentos a
  LEFT JOIN logi_motoristas mo       ON mo.id = a.motorista_id
  LEFT JOIN logi_ajudantes  aj       ON aj.id = a.ajudante_id
  LEFT JOIN logi_veiculos   v        ON v.id  = a.veiculo_id
  LEFT JOIN logi_ordens_transporte o ON o.id  = a.ordem_id
  LEFT JOIN logi_usuarios   u        ON u.id  = a.criado_por
  LEFT JOIN logi_contas_pagar cp_orig ON cp_orig.id = a.conta_pagar_id
`;

// ════ LISTAR ═══════════════════════════════════════════════════════════════════
// GET /api/financeiro/adiantamentos
router.get('/', async (req, res, next) => {
  try {
    const { status, tipo_beneficiario, motorista_id, veiculo_id, ajudante_id,
            data_de, data_ate } = req.query;
    const where = [];
    const params = [];
    if (status)            { params.push(status);            where.push(`a.status = $${params.length}`); }
    if (tipo_beneficiario) { params.push(tipo_beneficiario); where.push(`a.tipo_beneficiario = $${params.length}`); }
    if (motorista_id)      { params.push(motorista_id);      where.push(`a.motorista_id = $${params.length}`); }
    if (veiculo_id)        { params.push(veiculo_id);        where.push(`a.veiculo_id = $${params.length}`); }
    if (ajudante_id)       { params.push(ajudante_id);       where.push(`a.ajudante_id = $${params.length}`); }
    if (data_de)           { params.push(data_de);           where.push(`a.data_adiantamento >= $${params.length}`); }
    if (data_ate)          { params.push(data_ate);          where.push(`a.data_adiantamento <= $${params.length}`); }
    const wc = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const { rows } = await db.query(
      `${SELECT_BASE} ${wc} ORDER BY a.data_adiantamento DESC, a.id DESC`,
      params
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// GET /api/financeiro/adiantamentos/:id
router.get('/:id(\\d+)', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `${SELECT_BASE} WHERE a.id = $1`, [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Não encontrado' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// ════ ALERTA: pendentes por beneficiário ═════════════════════════════════════
// Usado no frontend para avisar antes de criar adiantamento duplicado
// GET /api/financeiro/adiantamentos/pendentes?motorista_id=&veiculo_id=&ajudante_id=
router.get('/pendentes', async (req, res, next) => {
  try {
    const { motorista_id, veiculo_id, ajudante_id } = req.query;
    if (!motorista_id && !veiculo_id && !ajudante_id) {
      return res.status(400).json({ error: 'Informe motorista_id, veiculo_id ou ajudante_id' });
    }
    const where = [`a.status = 'pendente'`];
    const params = [];
    if (motorista_id) { params.push(motorista_id); where.push(`a.motorista_id = $${params.length}`); }
    if (veiculo_id)   { params.push(veiculo_id);   where.push(`a.veiculo_id = $${params.length}`); }
    if (ajudante_id)  { params.push(ajudante_id);  where.push(`a.ajudante_id = $${params.length}`); }
    const { rows } = await db.query(
      `${SELECT_BASE} WHERE ${where.join(' AND ')} ORDER BY a.data_adiantamento`,
      params
    );
    const total = rows.reduce((s,r) => s + Number(r.valor) - Number(r.valor_descontado||0), 0);
    res.json({ count: rows.length, total_pendente: total, adiantamentos: rows });
  } catch (err) { next(err); }
});

// ════ CRIAR (com CP automática) ═══════════════════════════════════════════════
// POST /api/financeiro/adiantamentos
router.post('/', adtoUpload.single('comprovante'), async (req, res, next) => {
  const client = await db.pool.connect();
  try {
    const {
      tipo_beneficiario, motorista_id, ajudante_id, veiculo_id, ordem_id,
      valor, data_adiantamento, forma_pagamento, observacao,
    } = req.body;

    // Validações
    if (!tipo_beneficiario || !['motorista_proprio','motorista_terceiro','ajudante'].includes(tipo_beneficiario)) {
      return res.status(400).json({ error: 'tipo_beneficiario inválido' });
    }
    if (!valor || Number(valor) <= 0) {
      return res.status(400).json({ error: 'valor deve ser maior que zero' });
    }
    if (tipo_beneficiario === 'motorista_terceiro' && !veiculo_id) {
      return res.status(400).json({ error: 'Para terceiro, a placa do veículo é obrigatória' });
    }
    if (tipo_beneficiario === 'ajudante' && !ajudante_id) {
      return res.status(400).json({ error: 'Para ajudante, selecione o cadastro' });
    }
    if (tipo_beneficiario !== 'ajudante' && !motorista_id) {
      return res.status(400).json({ error: 'Selecione o motorista' });
    }

    const comprovante_nome = req.file ? req.file.originalname : null;
    const comprovante_path = req.file ? req.file.filename     : null;
    const usuarioId = req.user?.id || null;
    const dataAdto = data_adiantamento || new Date().toISOString().slice(0, 10);

    await client.query('BEGIN');

    // 1. Monta descrição da CP automática
    let descricaoCP = 'Adiantamento';
    if (tipo_beneficiario === 'motorista_proprio') descricaoCP += ' — motorista';
    else if (tipo_beneficiario === 'motorista_terceiro') descricaoCP += ' — terceiro';
    else if (tipo_beneficiario === 'ajudante') descricaoCP += ' — ajudante';

    // 2. Cria a CP (saída de caixa) — já marcada como paga, porque o dinheiro saiu
    const cpInsert = await client.query(
      `INSERT INTO logi_contas_pagar
        (ordem_id, motorista_id, valor, vencimento, data_pagamento,
         status, tipo_lancamento, descricao, obs)
       VALUES ($1,$2,$3,$4,$5,'pago','adiantamento',$6,$7)
       RETURNING id`,
      [
        ordem_id || null,
        tipo_beneficiario === 'ajudante' ? null : (motorista_id || null),
        Number(valor),
        dataAdto,
        dataAdto,
        descricaoCP,
        observacao || null,
      ]
    );
    const contaPagarId = cpInsert.rows[0].id;

    // 3. Cria o adiantamento
    const adtoInsert = await client.query(
      `INSERT INTO logi_adiantamentos
        (tipo_beneficiario, motorista_id, ajudante_id, veiculo_id, ordem_id,
         valor, data_adiantamento, forma_pagamento,
         comprovante_nome, comprovante_path,
         conta_pagar_id, observacao, criado_por)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING id`,
      [
        tipo_beneficiario,
        tipo_beneficiario === 'ajudante' ? null : (motorista_id || null),
        tipo_beneficiario === 'ajudante' ? ajudante_id : null,
        tipo_beneficiario === 'motorista_terceiro' ? veiculo_id : (veiculo_id || null),
        ordem_id || null,
        Number(valor),
        dataAdto,
        forma_pagamento || null,
        comprovante_nome,
        comprovante_path,
        contaPagarId,
        observacao || null,
        usuarioId,
      ]
    );

    await client.query('COMMIT');

    // 4. Retorna o registro completo
    const { rows } = await db.query(
      `${SELECT_BASE} WHERE a.id = $1`, [adtoInsert.rows[0].id]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    next(err);
  } finally {
    client.release();
  }
});

// ════ ATUALIZAR (só dados não-financeiros, e só se pendente) ═════════════════
// PATCH /api/financeiro/adiantamentos/:id
router.patch('/:id', async (req, res, next) => {
  try {
    const { observacao, forma_pagamento } = req.body;
    const { rows } = await db.query(
      `UPDATE logi_adiantamentos
       SET observacao = COALESCE($1, observacao),
           forma_pagamento = COALESCE($2, forma_pagamento)
       WHERE id = $3 AND status = 'pendente'
       RETURNING *`,
      [observacao, forma_pagamento, req.params.id]
    );
    if (!rows.length) {
      return res.status(404).json({ error: 'Adiantamento não encontrado ou já descontado/cancelado' });
    }
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// ════ ABATER no acerto ════════════════════════════════════════════════════════
// PATCH /api/financeiro/adiantamentos/:id/abater
// body: { cp_acerto_id, valor_descontado }
router.patch('/:id/abater', async (req, res, next) => {
  const client = await db.pool.connect();
  try {
    const { cp_acerto_id, valor_descontado } = req.body;
    if (!cp_acerto_id) return res.status(400).json({ error: 'cp_acerto_id é obrigatório' });
    if (!valor_descontado || Number(valor_descontado) <= 0) {
      return res.status(400).json({ error: 'valor_descontado deve ser maior que zero' });
    }

    await client.query('BEGIN');

    const cur = await client.query(
      `SELECT valor, valor_descontado, status FROM logi_adiantamentos WHERE id = $1 FOR UPDATE`,
      [req.params.id]
    );
    if (!cur.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Adiantamento não encontrado' });
    }
    if (cur.rows[0].status !== 'pendente') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Adiantamento já foi descontado ou cancelado' });
    }
    const restante = Number(cur.rows[0].valor) - Number(cur.rows[0].valor_descontado || 0);
    if (Number(valor_descontado) > restante) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Valor maior que o saldo pendente (R$ ${restante.toFixed(2)})` });
    }

    const novoDescontado = Number(cur.rows[0].valor_descontado || 0) + Number(valor_descontado);
    const novoStatus = novoDescontado >= Number(cur.rows[0].valor) ? 'descontado' : 'pendente';

    const { rows } = await client.query(
      `UPDATE logi_adiantamentos
       SET valor_descontado = $1, status = $2, cp_acerto_id = $3
       WHERE id = $4 RETURNING *`,
      [novoDescontado, novoStatus, cp_acerto_id, req.params.id]
    );

    await client.query('COMMIT');
    res.json(rows[0]);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    next(err);
  } finally {
    client.release();
  }
});

// ════ CANCELAR ══════════════════════════════════════════════════════════════
// DELETE /api/financeiro/adiantamentos/:id
// Soft delete: marca adiantamento e CP de origem como cancelados
router.delete('/:id', async (req, res, next) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const cur = await client.query(
      `SELECT conta_pagar_id, status FROM logi_adiantamentos WHERE id = $1 FOR UPDATE`,
      [req.params.id]
    );
    if (!cur.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Adiantamento não encontrado' });
    }
    if (cur.rows[0].status === 'descontado') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Adiantamento já foi descontado em um acerto; cancele/estorne o acerto antes' });
    }

    await client.query(
      `UPDATE logi_adiantamentos SET status='cancelado' WHERE id=$1`,
      [req.params.id]
    );
    if (cur.rows[0].conta_pagar_id) {
      await client.query(
        `UPDATE logi_contas_pagar SET status='cancelado' WHERE id=$1`,
        [cur.rows[0].conta_pagar_id]
      );
    }
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    next(err);
  } finally {
    client.release();
  }
});

module.exports = router;
