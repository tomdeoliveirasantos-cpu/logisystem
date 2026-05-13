const express = require('express');
const db = require('../db');

const router = express.Router();

// Sub-rota: adiantamentos (CRUD + abater)
const adiantamentosRouter = require('./adiantamentos');
router.use('/adiantamentos', adiantamentosRouter);

// ════ CONTAS A RECEBER ════════════════════════════════════════════════════════
// GET /api/financeiro/receber
router.get('/receber', async (req, res, next) => {
  try {
    const { status, vencimento_ate } = req.query;
    const params = [];
    const where = [];
    if (status) { params.push(status); where.push(`cr.status = $${params.length}`); }
    if (vencimento_ate) { params.push(vencimento_ate); where.push(`cr.vencimento <= $${params.length}`); }
    const wc = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const { rows } = await db.query(
      `SELECT cr.*, o.numero_rota, o.data AS data_entrega,
              v.tipo AS veiculo_tipo, tf.regiao, tf.valor_base AS frete_referencia
       FROM logi_contas_receber cr
       LEFT JOIN logi_ordens_transporte o ON o.id = cr.ordem_id
       LEFT JOIN logi_ordens_transporte ot ON ot.id = cr.ordem_id
       LEFT JOIN logi_veiculos v ON v.id = ot.veiculo_id
       LEFT JOIN logi_tabela_fretes tf ON tf.id = cr.tabela_frete_id
       ${wc} ORDER BY cr.vencimento`, params
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// POST /api/financeiro/receber
router.post('/receber', async (req, res, next) => {
  try {
    const { ordem_id, tabela_frete_id, cliente, valor, vencimento, obs } = req.body;
    const { rows } = await db.query(
      `INSERT INTO logi_contas_receber (ordem_id, tabela_frete_id, cliente, valor, vencimento, obs)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [ordem_id, tabela_frete_id, cliente, valor, vencimento, obs]
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

// PATCH /api/financeiro/receber/:id/receber
router.patch('/receber/:id/receber', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `UPDATE logi_contas_receber
       SET status='recebido', data_pagamento=CURRENT_DATE
       WHERE id=$1 RETURNING *`, [req.params.id]
    );
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// DELETE /api/financeiro/receber/:id
router.delete('/receber/:id', async (req, res, next) => {
  try {
    const { rowCount } = await db.query(
      `DELETE FROM logi_contas_receber WHERE id=$1`, [req.params.id]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'Lançamento não encontrado' });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ════ CONTAS A PAGAR ══════════════════════════════════════════════════════════
// GET /api/financeiro/pagar
router.get('/pagar', async (req, res, next) => {
  try {
    const { status } = req.query;
    const params = [];
    const where = [];
    if (status) { params.push(status); where.push(`cp.status = $${params.length}`); }
    const wc = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const { rows } = await db.query(
      `SELECT cp.*, t.nome AS transportadora_nome, m.nome AS motorista_nome,
              aj.nome AS ajudante_nome,
              o.numero_rota, o.data AS data_entrega, o.veiculo_id AS ot_veiculo_id,
              v.placa AS veiculo_placa,
              tf.regiao, tf.valor_base AS frete_referencia
       FROM logi_contas_pagar cp
       LEFT JOIN logi_transportadoras t ON t.id = cp.transportadora_id
       LEFT JOIN logi_motoristas m ON m.id = cp.motorista_id
       LEFT JOIN logi_ajudantes aj ON aj.id = cp.ajudante_id
       LEFT JOIN logi_ordens_transporte o ON o.id = cp.ordem_id
       LEFT JOIN logi_veiculos v ON v.id = o.veiculo_id
       LEFT JOIN logi_tabela_fretes tf ON tf.id = cp.tabela_frete_id
       ${wc} ORDER BY cp.vencimento`, params
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// POST /api/financeiro/pagar
router.post('/pagar', async (req, res, next) => {
  try {
    const { ordem_id, tabela_frete_id, transportadora_id, motorista_id, valor, vencimento, obs } = req.body;
    const { rows } = await db.query(
      `INSERT INTO logi_contas_pagar
        (ordem_id, tabela_frete_id, transportadora_id, motorista_id, valor, vencimento, obs)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [ordem_id, tabela_frete_id, transportadora_id, motorista_id, valor, vencimento, obs]
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

// GET /api/financeiro/pagar/:id/elegiveis
// Lista adiantamentos elegíveis para abater nesta CP (regras do módulo):
//  - frete_terceiro     → filtra pela placa do veículo da OT da CP
//  - diaria_motorista   → filtra pelo motorista_id da CP
//  - diaria_ajudante    → filtra pelo ajudante_id da CP
//  - outros tipos       → filtra por motorista_id da CP (fallback)
router.get('/pagar/:id/elegiveis', async (req, res, next) => {
  try {
    const cpQ = await db.query(
      `SELECT cp.id, cp.tipo_lancamento, cp.motorista_id, cp.ajudante_id, cp.valor,
              cp.status, o.veiculo_id AS ot_veiculo_id, v.placa AS veiculo_placa
         FROM logi_contas_pagar cp
         LEFT JOIN logi_ordens_transporte o ON o.id = cp.ordem_id
         LEFT JOIN logi_veiculos v ON v.id = o.veiculo_id
        WHERE cp.id = $1`, [req.params.id]
    );
    if (!cpQ.rows.length) return res.status(404).json({ error: 'CP não encontrada' });
    const cp = cpQ.rows[0];
    if (cp.status !== 'pendente') {
      return res.json({ cp, elegiveis: [], motivo: 'CP não está pendente' });
    }

    let where = `a.status = 'pendente'`;
    const params = [];
    let motivo = null;
    if (cp.tipo_lancamento === 'frete_terceiro' && cp.ot_veiculo_id) {
      params.push(cp.ot_veiculo_id);
      where += ` AND a.veiculo_id = $${params.length}`;
    } else if (cp.tipo_lancamento === 'diaria_ajudante' && cp.ajudante_id) {
      params.push(cp.ajudante_id);
      where += ` AND a.ajudante_id = $${params.length}`;
    } else if (cp.motorista_id) {
      params.push(cp.motorista_id);
      where += ` AND a.motorista_id = $${params.length}`;
    } else {
      motivo = 'CP sem motorista/placa/ajudante associado';
      return res.json({ cp, elegiveis: [], motivo });
    }

    const { rows } = await db.query(
      `SELECT a.id, a.tipo_beneficiario, a.valor, a.valor_descontado,
              a.data_adiantamento, a.forma_pagamento, a.observacao,
              (a.valor - COALESCE(a.valor_descontado,0)) AS saldo,
              m.nome AS motorista_nome, aj.nome AS ajudante_nome, v.placa AS veiculo_placa
         FROM logi_adiantamentos a
         LEFT JOIN logi_motoristas m ON m.id = a.motorista_id
         LEFT JOIN logi_ajudantes  aj ON aj.id = a.ajudante_id
         LEFT JOIN logi_veiculos   v  ON v.id = a.veiculo_id
        WHERE ${where}
        ORDER BY a.data_adiantamento`, params
    );
    const total_pendente = rows.reduce((s, r) => s + Number(r.saldo), 0);
    res.json({ cp, elegiveis: rows, total_pendente });
  } catch (err) { next(err); }
});

// PATCH /api/financeiro/pagar/:id/pagar
// body opcional: { adiantamentos_a_abater: [{ id, valor }] }
router.patch('/pagar/:id/pagar', async (req, res, next) => {
  const client = await db.pool.connect();
  try {
    const { adiantamentos_a_abater } = req.body || {};

    await client.query('BEGIN');

    // 1. Lock e dados da CP
    const cpQ = await client.query(
      `SELECT id, valor, status FROM logi_contas_pagar WHERE id=$1 FOR UPDATE`,
      [req.params.id]
    );
    if (!cpQ.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'CP não encontrada' });
    }
    const cp = cpQ.rows[0];
    if (cp.status !== 'pendente') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'CP não está pendente' });
    }

    // 2. Valida adiantamentos a abater (se houver)
    let totalAbater = 0;
    const abates = Array.isArray(adiantamentos_a_abater) ? adiantamentos_a_abater : [];
    for (const a of abates) {
      if (!a.id || !a.valor || Number(a.valor) <= 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Item de abatimento inválido' });
      }
      const adto = await client.query(
        `SELECT valor, valor_descontado, status FROM logi_adiantamentos WHERE id=$1 FOR UPDATE`,
        [a.id]
      );
      if (!adto.rows.length || adto.rows[0].status !== 'pendente') {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: `Adiantamento ${a.id} não está disponível` });
      }
      const saldo = Number(adto.rows[0].valor) - Number(adto.rows[0].valor_descontado || 0);
      if (Number(a.valor) > saldo + 0.005) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Valor a abater do adto ${a.id} excede o saldo (R$ ${saldo.toFixed(2)})` });
      }
      totalAbater += Number(a.valor);
    }

    if (totalAbater > Number(cp.valor) + 0.005) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Total dos adiantamentos excede o valor da CP' });
    }
    const valorLiquido = Number(cp.valor) - totalAbater;

    // 3. Atualiza CP
    const cpUpd = await client.query(
      `UPDATE logi_contas_pagar
          SET status='pago',
              data_pagamento=CURRENT_DATE,
              valor_pago=$1,
              valor_adiantamentos=$2
        WHERE id=$3 RETURNING *`,
      [valorLiquido, totalAbater, req.params.id]
    );

    // 4. Atualiza cada adiantamento abatido
    for (const a of abates) {
      const adto = await client.query(
        `SELECT valor, valor_descontado FROM logi_adiantamentos WHERE id=$1`,
        [a.id]
      );
      const novoDescontado = Number(adto.rows[0].valor_descontado || 0) + Number(a.valor);
      const novoStatus = novoDescontado >= Number(adto.rows[0].valor) - 0.005 ? 'descontado' : 'pendente';
      await client.query(
        `UPDATE logi_adiantamentos
            SET valor_descontado=$1, status=$2, cp_acerto_id=$3
          WHERE id=$4`,
        [novoDescontado, novoStatus, req.params.id, a.id]
      );
    }

    await client.query('COMMIT');
    res.json({
      ...cpUpd.rows[0],
      adiantamentos_abatidos: abates.length,
      valor_bruto: Number(cp.valor),
      valor_liquido: valorLiquido,
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    next(err);
  } finally {
    client.release();
  }
});

// DELETE /api/financeiro/pagar/:id
router.delete('/pagar/:id', async (req, res, next) => {
  try {
    const { rowCount } = await db.query(
      `DELETE FROM logi_contas_pagar WHERE id=$1`, [req.params.id]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'Lançamento não encontrado' });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ════ TABELA DE FRETES ═══════════════════════════════════════════════════════
// GET /api/financeiro/fretes  (tabela de referência)
router.get('/fretes', async (req, res, next) => {
  try {
    const { tipo_frete, tipo_veiculo, sub_tabela } = req.query;
    const params = [];
    const where = [];
    if (tipo_frete)   { params.push(tipo_frete);   where.push(`tipo_frete = $${params.length}`); }
    if (tipo_veiculo) { params.push(tipo_veiculo); where.push(`tipo_veiculo = $${params.length}`); }
    if (sub_tabela)   { params.push(sub_tabela);   where.push(`sub_tabela = $${params.length}`); }
    const wc = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const { rows } = await db.query(
      `SELECT * FROM logi_tabela_fretes ${wc} ORDER BY tipo_frete, sub_tabela, regiao, tipo_veiculo`, params
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// GET /api/financeiro/fretes/recebido — tabela fixa de frete recebido por veículo
router.get('/fretes/recebido', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT * FROM logi_tabela_frete_recebido ORDER BY id`
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// PUT /api/financeiro/fretes/recebido/:id — atualizar valor do frete recebido
router.put('/fretes/recebido/:id', async (req, res, next) => {
  try {
    const { valor } = req.body;
    const { rows } = await db.query(
      `UPDATE logi_tabela_frete_recebido SET valor=$1, updated_at=NOW() WHERE id=$2 RETURNING *`,
      [valor, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Não encontrado' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// POST /api/financeiro/fretes
router.post('/fretes', async (req, res, next) => {
  try {
    const { regiao, tipo_veiculo, km_max, valor_base, tipo_frete, sub_tabela } = req.body;
    const { rows } = await db.query(
      `INSERT INTO logi_tabela_fretes (regiao,tipo_veiculo,km_max,valor_base,tipo_frete,sub_tabela)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [regiao, tipo_veiculo, km_max||null, valor_base, tipo_frete, sub_tabela||'sp']
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

router.put('/fretes/:id', async (req, res, next) => {
  try {
    const { regiao, tipo_veiculo, km_max, valor_base, tipo_frete, sub_tabela } = req.body;
    const { rows } = await db.query(
      `UPDATE logi_tabela_fretes SET regiao=$1,tipo_veiculo=$2,km_max=$3,valor_base=$4,tipo_frete=$5,sub_tabela=$6
       WHERE id=$7 RETURNING *`,
      [regiao, tipo_veiculo, km_max||null, valor_base, tipo_frete, sub_tabela||'sp', req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Não encontrado' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

router.delete('/fretes/:id', async (req, res, next) => {
  try {
    await db.query('DELETE FROM logi_tabela_fretes WHERE id=$1', [req.params.id]);
    res.status(204).send();
  } catch (err) { next(err); }
});

// ════ BUSCAR VALOR DE FRETE AUTOMÁTICO ═══════════════════════════════════════
// GET /api/financeiro/fretes/buscar?regiao=X&tipo_veiculo=Y
// Retorna o valor da tabela terceiro + o valor fixo recebido para o veículo
router.get('/fretes/buscar', async (req, res, next) => {
  try {
    const { regiao, tipo_veiculo } = req.query;
    if (!regiao || !tipo_veiculo) {
      return res.status(400).json({ error: 'regiao e tipo_veiculo são obrigatórios' });
    }

    // Buscar frete terceiro (pagar) pela região + veículo
    const { rows: terceiro } = await db.query(
      `SELECT * FROM logi_tabela_fretes
       WHERE tipo_frete='terceiro' AND sub_tabela='sp'
         AND UPPER(TRIM(regiao)) = UPPER(TRIM($1))
         AND UPPER(TRIM(tipo_veiculo)) = UPPER(TRIM($2))
       LIMIT 1`,
      [regiao, tipo_veiculo]
    );

    // Buscar frete recebido (fixo por veículo)
    const { rows: recebido } = await db.query(
      `SELECT * FROM logi_tabela_frete_recebido
       WHERE UPPER(TRIM(tipo_veiculo)) = UPPER(TRIM($1))
       LIMIT 1`,
      [tipo_veiculo]
    );

    res.json({
      pagar: terceiro[0] || null,
      receber: recebido[0] || null,
    });
  } catch (err) { next(err); }
});

// GET /api/financeiro/fretes/regioes — regiões distintas cadastradas
router.get('/fretes/regioes', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT DISTINCT regiao FROM logi_tabela_fretes
       WHERE tipo_frete='terceiro' AND sub_tabela='sp'
       ORDER BY regiao`
    );
    res.json(rows.map(r => r.regiao));
  } catch (err) { next(err); }
});

module.exports = router;
