const express = require('express');
const db = require('../db');

const router = express.Router();

/* -------- Dados para preencher o formulário -------- */
router.get('/opcoes', async (req, res, next) => {
  try {
    const [motoristas, veiculos, ajudantes] = await Promise.all([
      db.query(
        `SELECT id, nome, veiculo_padrao_id FROM logi_motoristas
          WHERE organizacao_id = $1 AND ativo ORDER BY nome`,
        [req.organizacao_id]
      ),
      db.query(
        `SELECT id, placa, modelo, tipo FROM logi_veiculos
          WHERE organizacao_id = $1 AND ativo ORDER BY placa`,
        [req.organizacao_id]
      ),
      db.query(
        `SELECT id, nome FROM logi_ajudantes
          WHERE organizacao_id = $1 AND ativo ORDER BY nome`,
        [req.organizacao_id]
      ),
    ]);
    res.json({
      motoristas: motoristas.rows,
      veiculos: veiculos.rows,
      ajudantes: ajudantes.rows,
    });
  } catch (err) { next(err); }
});

/* -------- Registrar saída -------- */
router.post('/', async (req, res, next) => {
  try {
    const {
      data_saida, hora_saida, rota_codigo,
      motorista_id, motorista_nome, veiculo_id, ajudante_id, ajudante_nome,
      regiao, qtd_entregas, peso_kg, km_inicial, observacao,
    } = req.body || {};

    if (!rota_codigo || !String(rota_codigo).trim()) {
      return res.status(400).json({ error: 'Informe o número da rota' });
    }
    if (!motorista_id && !motorista_nome) {
      return res.status(400).json({ error: 'Informe o motorista' });
    }
    if (!veiculo_id) {
      return res.status(400).json({ error: 'Selecione a placa do veículo' });
    }
    if (qtd_entregas === undefined || qtd_entregas === null || qtd_entregas === '') {
      return res.status(400).json({ error: 'Informe a quantidade de entregas' });
    }

    // placa e modelo vêm do cadastro do veículo, para não depender de digitação
    let placa = null; let modelo = null;
    if (veiculo_id) {
      const v = await db.query(
        'SELECT placa, modelo FROM logi_veiculos WHERE id = $1 AND organizacao_id = $2',
        [veiculo_id, req.organizacao_id]
      );
      if (v.rows[0]) { placa = v.rows[0].placa; modelo = v.rows[0].modelo; }
    }
    let nomeMotorista = motorista_nome || null;
    if (motorista_id) {
      const m = await db.query(
        'SELECT nome FROM logi_motoristas WHERE id = $1 AND organizacao_id = $2',
        [motorista_id, req.organizacao_id]
      );
      if (m.rows[0]) nomeMotorista = m.rows[0].nome;
    }
    let nomeAjudante = ajudante_nome || null;
    if (ajudante_id) {
      const a = await db.query(
        'SELECT nome FROM logi_ajudantes WHERE id = $1 AND organizacao_id = $2',
        [ajudante_id, req.organizacao_id]
      );
      if (a.rows[0]) nomeAjudante = a.rows[0].nome;
    }

    const { rows } = await db.query(
      `INSERT INTO logi_saidas_rota
         (organizacao_id, data_saida, hora_saida, rota_codigo,
          motorista_id, motorista_nome, veiculo_id, placa, modelo,
          ajudante_id, ajudante_nome, regiao, qtd_entregas, peso_kg, km_inicial,
          observacao, registrado_por)
       VALUES ($1, COALESCE($2, CURRENT_DATE), COALESCE($3, LOCALTIME), $4,
               $5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
       RETURNING *`,
      [req.organizacao_id, data_saida || null, hora_saida || null, String(rota_codigo).trim(),
        motorista_id || null, nomeMotorista, veiculo_id || null, placa, modelo,
        ajudante_id || null, nomeAjudante, regiao || null,
        qtd_entregas || null, peso_kg || null, km_inicial || null, observacao || null,
        req.usuario?.nome || req.usuario?.email || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505' || err.code === '23P01' || /idx_logi_saidas_unica/.test(err.message)) {
      return res.status(409).json({ error: 'Esta rota já foi registrada hoje' });
    }
    if (err.code === '23505') return res.status(409).json({ error: 'Esta rota já foi registrada hoje' });
    return next(err);
  }
});

/* -------- Listar (dia ou período) -------- */
router.get('/', async (req, res, next) => {
  try {
    const { data, de, ate } = req.query;
    const params = [req.organizacao_id];
    let filtro = 'organizacao_id = $1';
    if (data) { params.push(data); filtro += ` AND data_saida = $${params.length}`; }
    else if (de && ate) {
      params.push(de, ate);
      filtro += ` AND data_saida BETWEEN $${params.length - 1} AND $${params.length}`;
    }
    const { rows } = await db.query(
      `SELECT * FROM logi_saidas_rota WHERE ${filtro}
        ORDER BY data_saida DESC, hora_saida DESC NULLS LAST, rota_codigo LIMIT 300`,
      params
    );
    res.json(rows);
  } catch (err) { next(err); }
});

/* -------- Fechar rota (retorno) ou corrigir -------- */
router.patch('/:id', async (req, res, next) => {
  try {
    const permitidos = ['hora_retorno', 'km_final', 'observacao', 'qtd_entregas', 'peso_kg',
      'regiao', 'km_inicial', 'hora_saida', 'status'];
    const sets = []; const params = [req.organizacao_id, req.params.id];
    for (const campo of permitidos) {
      if (req.body[campo] !== undefined) {
        params.push(req.body[campo] === '' ? null : req.body[campo]);
        sets.push(`${campo} = $${params.length}`);
      }
    }
    // fechar automaticamente quando informa o retorno
    if (req.body.hora_retorno || req.body.km_final) {
      if (!sets.some((s) => s.startsWith('status'))) {
        params.push('finalizada');
        sets.push(`status = $${params.length}`);
      }
    }
    if (!sets.length) return res.status(400).json({ error: 'Nada para atualizar' });

    const { rows } = await db.query(
      `UPDATE logi_saidas_rota SET ${sets.join(', ')}, atualizado_em = NOW()
        WHERE organizacao_id = $1 AND id = $2 RETURNING *`,
      params
    );
    if (!rows[0]) return res.status(404).json({ error: 'Registro não encontrado' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

/* -------- Resumo do dia (o que o gestor quer ver) -------- */
router.get('/resumo', async (req, res, next) => {
  try {
    const data = req.query.data || null;
    const { rows } = await db.query(
      `SELECT COUNT(*)::int total,
              COUNT(*) FILTER (WHERE status = 'em_rota')::int em_rota,
              COUNT(*) FILTER (WHERE status = 'finalizada')::int finalizadas,
              COALESCE(SUM(qtd_entregas),0)::int entregas,
              COALESCE(SUM(km_final - km_inicial), 0)::numeric km_rodado
         FROM logi_saidas_rota
        WHERE organizacao_id = $1 AND data_saida = COALESCE($2::date, CURRENT_DATE)`,
      [req.organizacao_id, data]
    );
    res.json(rows[0]);
  } catch (err) { next(err); }
});

module.exports = router;
