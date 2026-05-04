const express = require('express');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const db      = require('../db');

const router = express.Router();

// ── Configuração de upload ─────────────────────────────────
const UPLOADS_DIR = path.join(__dirname, '../../uploads');
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
    const ok = ['.pdf','.jpg','.jpeg','.png','.xml'];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, ok.includes(ext));
  },
});

// ─────────────────────────────────────────────────────────────
// Helpers de auto-criação / lookup
// ─────────────────────────────────────────────────────────────
function normalizar(s) {
  return String(s || '').trim().toUpperCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

async function buscarVeiculoPorPlaca(client, placa) {
  if (!placa) return null;
  const placaNorm = normalizar(placa).replace(/[^A-Z0-9]/g, '');
  const { rows } = await client.query(
    `SELECT v.id, v.tipo, v.ag_ft, v.transportadora_id, t.nome AS transportadora_nome
     FROM logi_veiculos v
     LEFT JOIN logi_transportadoras t ON t.id = v.transportadora_id
     WHERE UPPER(REGEXP_REPLACE(v.placa, '[^A-Za-z0-9]', '', 'g')) = $1
     LIMIT 1`,
    [placaNorm]
  );
  return rows[0] || null;
}

async function buscarMotoristaPorNome(client, nome) {
  if (!nome) return null;
  const n = String(nome).trim();
  const { rows } = await client.query(
    `SELECT id, nome FROM logi_motoristas
     WHERE UPPER(nome) = UPPER($1) OR UPPER(nome) ILIKE UPPER($2)
     ORDER BY (UPPER(nome) = UPPER($1)) DESC
     LIMIT 1`,
    [n, `%${n}%`]
  );
  return rows[0] || null;
}

async function buscarOuCriarCliente(client, { codigo, nome, endereco }) {
  if (!nome) return null;
  const documentoSintetico = codigo ? `ROTEASY-${codigo}` : null;

  if (documentoSintetico) {
    const ex = await client.query(
      'SELECT id FROM logi_clientes WHERE documento = $1 LIMIT 1',
      [documentoSintetico]
    );
    if (ex.rows.length) return ex.rows[0].id;
  }

  const exNome = await client.query(
    `SELECT id FROM logi_clientes WHERE UPPER(TRIM(nome)) = UPPER(TRIM($1)) LIMIT 1`,
    [nome]
  );
  if (exNome.rows.length) return exNome.rows[0].id;

  const ins = await client.query(
    `INSERT INTO logi_clientes (nome, tipo_doc, documento, logradouro, ativo)
     VALUES ($1, 'CNPJ', $2, $3, true)
     ON CONFLICT (documento) DO UPDATE SET nome = EXCLUDED.nome
     RETURNING id`,
    [String(nome).trim().substring(0, 200), documentoSintetico, endereco || null]
  );
  return ins.rows[0].id;
}

// ─────────────────────────────────────────────────────────────
// LISTAGEM
// ─────────────────────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const { data, status, motorista_id, veiculo_id, cliente_id, tipo_frota, page=1, limit=100 } = req.query;
    const params = [];
    const where  = [];

    if (data)         { params.push(data);         where.push(`o.data = $${params.length}`); }
    if (status)       { params.push(status);       where.push(`o.status = $${params.length}`); }
    if (motorista_id) { params.push(motorista_id); where.push(`o.motorista_id = $${params.length}`); }
    if (veiculo_id)   { params.push(veiculo_id);   where.push(`o.veiculo_id = $${params.length}`); }
    if (cliente_id)   { params.push(cliente_id);   where.push(`o.cliente_id = $${params.length}`); }
    if (tipo_frota)   { params.push(tipo_frota);   where.push(`o.tipo_frota = $${params.length}`); }

    const wc     = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const offset = (page - 1) * limit;
    params.push(limit, offset);

    const { rows } = await db.query(
      `SELECT o.*,
              m.nome AS motorista_nome,
              v.placa, v.tipo AS veiculo_tipo, v.ag_ft AS veiculo_ag_ft,
              c.nome AS cliente_cadastrado,
              (SELECT COUNT(*)::int FROM logi_ordem_paradas p WHERE p.ordem_id = o.id) AS paradas_total,
              (SELECT COALESCE(SUM(peso),0) FROM logi_ordem_paradas p WHERE p.ordem_id = o.id) AS peso_total
       FROM   logi_ordens_transporte o
       LEFT JOIN logi_motoristas m ON m.id = o.motorista_id
       LEFT JOIN logi_veiculos   v ON v.id = o.veiculo_id
       LEFT JOIN logi_clientes   c ON c.id = o.cliente_id
       ${wc}
       ORDER BY o.data DESC, o.numero_rota
       LIMIT $${params.length-1} OFFSET $${params.length}`,
      params
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────
// BUSCAR ORDEM (com paradas)
// ─────────────────────────────────────────────────────────────
router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT o.*, m.nome AS motorista_nome,
              v.placa, v.tipo AS veiculo_tipo, v.ag_ft AS veiculo_ag_ft,
              c.nome AS cliente_cadastrado
       FROM logi_ordens_transporte o
       LEFT JOIN logi_motoristas m ON m.id = o.motorista_id
       LEFT JOIN logi_veiculos   v ON v.id = o.veiculo_id
       LEFT JOIN logi_clientes   c ON c.id = o.cliente_id
       WHERE o.id = $1`, [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Não encontrado' });

    const ordem = rows[0];
    const { rows: paradas } = await db.query(
      `SELECT * FROM logi_ordem_paradas WHERE ordem_id = $1 ORDER BY seq, id`,
      [ordem.id]
    );
    ordem.paradas = paradas;
    res.json(ordem);
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────
// PARADAS (sub-recurso)
// ─────────────────────────────────────────────────────────────
router.get('/:id/paradas', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT * FROM logi_ordem_paradas WHERE ordem_id = $1 ORDER BY seq, id`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

router.post('/:id/paradas', async (req, res, next) => {
  try {
    const ordem_id = req.params.id;
    const { seq, codigo_local, cliente_nome, endereco, regiao, peso, pedido, remessa, nf, latitude, longitude, obs } = req.body;
    const { rows } = await db.query(
      `INSERT INTO logi_ordem_paradas
        (ordem_id, seq, codigo_local, cliente_nome, endereco, regiao, peso, pedido, remessa, nf, latitude, longitude, obs)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING *`,
      [ordem_id, seq||1, codigo_local||null, cliente_nome||null, endereco||null, regiao||null,
       peso||null, pedido||null, remessa||null, nf||null, latitude||null, longitude||null, obs||null]
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

router.put('/:id/paradas/:paradaId', async (req, res, next) => {
  try {
    const { paradaId, id: ordem_id } = req.params;
    const allowed = ['seq','codigo_local','cliente_nome','endereco','regiao','peso','pedido','remessa','nf','latitude','longitude','obs','status'];
    const sets = [];
    const params = [];
    for (const k of allowed) {
      if (k in req.body) {
        params.push(req.body[k]);
        sets.push(`${k}=$${params.length}`);
      }
    }
    if (!sets.length) return res.status(400).json({ error: 'Nenhum campo para atualizar' });
    params.push(new Date());
    sets.push(`updated_at=$${params.length}`);
    params.push(paradaId, ordem_id);
    const { rows } = await db.query(
      `UPDATE logi_ordem_paradas SET ${sets.join(',')}
       WHERE id=$${params.length-1} AND ordem_id=$${params.length}
       RETURNING *`,
      params
    );
    if (!rows.length) return res.status(404).json({ error: 'Parada não encontrada' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

router.delete('/:id/paradas/:paradaId', async (req, res, next) => {
  try {
    const { paradaId, id: ordem_id } = req.params;
    const r = await db.query(
      'DELETE FROM logi_ordem_paradas WHERE id=$1 AND ordem_id=$2',
      [paradaId, ordem_id]
    );
    res.json({ deleted: r.rowCount });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────
// DOWNLOAD ANEXO
// ─────────────────────────────────────────────────────────────
router.get('/:id/anexo', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      'SELECT anexo_path, anexo_nome FROM logi_ordens_transporte WHERE id=$1', [req.params.id]
    );
    if (!rows.length || !rows[0].anexo_path) return res.status(404).json({ error: 'Anexo não encontrado' });
    const filePath = path.join(UPLOADS_DIR, rows[0].anexo_path);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Arquivo não encontrado no servidor' });
    res.download(filePath, rows[0].anexo_nome);
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────
// CRIAR ORDEM (1 OT = 1 rota; paradas opcionais no body)
// ─────────────────────────────────────────────────────────────
router.post('/', upload.single('anexo'), async (req, res, next) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // Aceita campos vindos como string (multer/multipart) ou JSON puro
    const body = req.body;
    const paradasIn = body.paradas
      ? (typeof body.paradas === 'string' ? JSON.parse(body.paradas) : body.paradas)
      : [];

    const {
      cliente_id, motorista_id, veiculo_id, data, numero_rota,
      tipo_frota,                    // 'proprio' | 'agregado' | 'terceiro'
      quant_entregas,
      saida, regiao,
      status='pendente', tipo, pagto,
      ajuda_diesel=0, taxa_descarga=0, ajudante_extra=0,
      ajudante_nome,                 // nome do ajudante (texto)
      n_cont, q_capas=0, obs,
      tabela_frete_id,
      km_saida, km_chegada,
    } = body;

    const anexo_nome = req.file ? req.file.originalname : null;
    const anexo_path = req.file ? req.file.filename     : null;
    const anexo_size = req.file ? req.file.size         : null;

    const { rows } = await client.query(
      `INSERT INTO logi_ordens_transporte
        (cliente_id, motorista_id, veiculo_id, data, numero_rota,
         tipo_frota, quant_entregas, saida, regiao, status, tipo, pagto,
         ajuda_diesel, taxa_descarga, ajudante_extra, ajudante_nome,
         n_cont, q_capas, obs,
         anexo_nome, anexo_path, anexo_tamanho,
         km_saida, km_chegada, origem_importacao)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,'manual')
       RETURNING *`,
      [cliente_id||null, motorista_id||null, veiculo_id||null, data, numero_rota||null,
       tipo_frota||null, quant_entregas||null, saida||null, regiao||null, status, tipo||null, pagto||null,
       ajuda_diesel||0, taxa_descarga||0, ajudante_extra||0, ajudante_nome||null,
       n_cont||null, q_capas||0, obs||null,
       anexo_nome, anexo_path, anexo_size,
       km_saida||null, km_chegada||null]
    );

    const ordem = rows[0];

    // Paradas inline (opcional)
    if (Array.isArray(paradasIn) && paradasIn.length) {
      for (const [i, p] of paradasIn.entries()) {
        await client.query(
          `INSERT INTO logi_ordem_paradas
            (ordem_id, seq, codigo_local, cliente_nome, endereco, regiao, peso, pedido, remessa, nf, latitude, longitude, obs)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
          [ordem.id, p.seq||(i+1), p.codigo_local||null, p.cliente_nome||null, p.endereco||null,
           p.regiao||null, p.peso||null, p.pedido||null, p.remessa||null, p.nf||null,
           p.latitude||null, p.longitude||null, p.obs||null]
        );
      }
    }

    // Geração financeira (CAP/CAR consolidado por OT — que é a rota)
    await gerarFinanceiroDaOrdem(client, ordem, { tabela_frete_id });

    await client.query('COMMIT');
    res.status(201).json(ordem);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    next(err);
  } finally {
    client.release();
  }
});

// ─────────────────────────────────────────────────────────────
// EDITAR ORDEM
// ─────────────────────────────────────────────────────────────
router.put('/:id', upload.single('anexo'), async (req, res, next) => {
  try {
    const allowed = [
      'cliente_id','motorista_id','veiculo_id','data','numero_rota',
      'tipo_frota','quant_entregas','saida','regiao','tipo','pagto',
      'ajuda_diesel','taxa_descarga','ajudante_extra','ajudante_nome',
      'n_cont','q_capas','obs','km_saida','km_chegada',
    ];
    const sets = [];
    const params = [];
    for (const k of allowed) {
      if (k in req.body) {
        params.push(req.body[k] === '' ? null : req.body[k]);
        sets.push(`${k}=$${params.length}`);
      }
    }
    if (req.file) {
      params.push(req.file.originalname); sets.push(`anexo_nome=$${params.length}`);
      params.push(req.file.filename); sets.push(`anexo_path=$${params.length}`);
      params.push(req.file.size); sets.push(`anexo_tamanho=$${params.length}`);
    }
    if (!sets.length) return res.status(400).json({ error: 'Nenhum campo para atualizar' });
    params.push(new Date()); sets.push(`updated_at=$${params.length}`);
    params.push(req.params.id);
    const { rows } = await db.query(
      `UPDATE logi_ordens_transporte SET ${sets.join(',')} WHERE id=$${params.length} RETURNING *`,
      params
    );
    if (!rows.length) return res.status(404).json({ error: 'Ordem não encontrada' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────
// ATUALIZAR STATUS
// ─────────────────────────────────────────────────────────────
router.patch('/:id/status', async (req, res, next) => {
  try {
    const { status } = req.body;
    const valid = ['pendente','entregue','devolucao','cancelado'];
    if (!valid.includes(status)) return res.status(422).json({ error: 'Status inválido' });

    const { rows: prev } = await db.query(
      'SELECT status, numero_rota, data FROM logi_ordens_transporte WHERE id=$1', [req.params.id]
    );
    if (!prev.length) return res.status(404).json({ error: 'Ordem não encontrada' });
    const statusAnterior = prev[0].status;

    const { rows } = await db.query(
      'UPDATE logi_ordens_transporte SET status=$1,updated_at=NOW() WHERE id=$2 RETURNING *',
      [status, req.params.id]
    );

    await db.query(
      `INSERT INTO logi_historico_ordens (ordem_id, status_anterior, status_novo, usuario_id, usuario_nome)
       VALUES ($1,$2,$3,$4,$5)`,
      [req.params.id, statusAnterior, status, req.user?.id || null, req.user?.nome || 'sistema']
    );

    if (status === 'cancelado' && statusAnterior !== 'cancelado') {
      await db.query(
        "UPDATE logi_contas_pagar SET status='cancelado' WHERE ordem_id=$1 AND status='pendente'",
        [req.params.id]
      );
      await db.query(
        "UPDATE logi_contas_receber SET status='cancelado' WHERE ordem_id=$1 AND status='pendente'",
        [req.params.id]
      );
    }

    res.json(rows[0]);
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────
// HISTÓRICO
// ─────────────────────────────────────────────────────────────
router.get('/:id/historico', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT * FROM logi_historico_ordens WHERE ordem_id=$1 ORDER BY created_at DESC`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────
// IMPORTAÇÃO ROTEASY — match por (data, numero_rota)
//   - Só importa paradas para OTs já cadastradas no dia
//   - Rotas da planilha sem OT correspondente → ignoradas (não criam OT)
// ─────────────────────────────────────────────────────────────

// Preview: mostra quais rotas da planilha têm OT criada para a data
router.post('/importar/preview', async (req, res, next) => {
  try {
    const { data, rotas } = req.body;
    if (!data || !rotas?.length) return res.status(400).json({ error: 'Data e rotas são obrigatórios' });

    const numerosRota = rotas.map(r => Number(r.numero_rota)).filter(n => !isNaN(n));
    let otsExistentes = [];
    if (numerosRota.length) {
      const ph = numerosRota.map((_, i) => `$${i + 2}`).join(',');
      const { rows } = await db.query(
        `SELECT id, numero_rota, motorista_id, veiculo_id, tipo_frota,
                (SELECT COUNT(*)::int FROM logi_ordem_paradas p WHERE p.ordem_id = o.id) AS paradas_atual
         FROM logi_ordens_transporte o
         WHERE o.data = $1 AND o.numero_rota IN (${ph})`,
        [data, ...numerosRota]
      );
      otsExistentes = rows;
    }

    const mapaOTs = new Map(otsExistentes.map(o => [Number(o.numero_rota), o]));
    const resultado = [];
    let totalParadasMatch = 0;

    for (const rota of rotas) {
      const numero = Number(rota.numero_rota);
      const ot = mapaOTs.get(numero);
      const paradas = rota.paradas || [];

      if (ot) {
        totalParadasMatch += paradas.length;
        resultado.push({
          numero_rota: rota.numero_rota,
          status: 'match',
          ordem_id: ot.id,
          tipo_frota: ot.tipo_frota,
          paradas_atual: ot.paradas_atual,
          paradas_planilha: paradas.length,
          peso_total: paradas.reduce((s, p) => s + (Number(p.peso) || 0), 0),
        });
      } else {
        resultado.push({
          numero_rota: rota.numero_rota,
          status: 'sem_ot',
          paradas_planilha: paradas.length,
          peso_total: paradas.reduce((s, p) => s + (Number(p.peso) || 0), 0),
        });
      }
    }

    res.json({
      data,
      total_rotas_planilha: rotas.length,
      total_rotas_match: resultado.filter(r => r.status === 'match').length,
      total_rotas_sem_ot: resultado.filter(r => r.status === 'sem_ot').length,
      total_paradas_match: totalParadasMatch,
      rotas: resultado,
    });
  } catch (err) { next(err); }
});

// Confirmar: insere paradas nas OTs que tiveram match
router.post('/importar', async (req, res, next) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const { data, rotas } = req.body;
    if (!data || !rotas?.length) return res.status(400).json({ error: 'Data e rotas são obrigatórios' });

    const numerosRota = rotas.map(r => Number(r.numero_rota)).filter(n => !isNaN(n));
    let otsExistentes = [];
    if (numerosRota.length) {
      const ph = numerosRota.map((_, i) => `$${i + 2}`).join(',');
      const { rows } = await client.query(
        `SELECT id, numero_rota FROM logi_ordens_transporte
         WHERE data = $1 AND numero_rota IN (${ph})`,
        [data, ...numerosRota]
      );
      otsExistentes = rows;
    }
    const mapaOTs = new Map(otsExistentes.map(o => [Number(o.numero_rota), o.id]));

    const resumo = {
      rotas_importadas: 0,
      rotas_ignoradas: 0,
      paradas_criadas: 0,
      paradas_atualizadas: 0,
    };

    for (const rota of rotas) {
      const numero = Number(rota.numero_rota);
      const ordemId = mapaOTs.get(numero);
      if (!ordemId) {
        resumo.rotas_ignoradas++;
        continue;
      }

      const paradas = rota.paradas || [];

      // Estratégia: deletar paradas existentes desta OT e reinserir todas
      // (mais previsível que UPSERT por remessa quando a planilha muda muito)
      // — mas se o usuário editou alguma manualmente, vai perder. Decisão simples por ora.
      // Alternativa preservadora: UPSERT por remessa
      // Vamos fazer UPSERT por remessa (preserva edições manuais sem remessa)
      for (const [i, p] of paradas.entries()) {
        if (p.remessa) {
          // Upsert por (ordem_id, remessa)
          const ex = await client.query(
            `SELECT id FROM logi_ordem_paradas
             WHERE ordem_id = $1 AND remessa = $2 LIMIT 1`,
            [ordemId, String(p.remessa)]
          );
          if (ex.rows.length) {
            await client.query(
              `UPDATE logi_ordem_paradas SET
                 seq=$3, codigo_local=$4, cliente_nome=$5, endereco=$6, regiao=$7,
                 peso=$8, pedido=$9, nf=$10, latitude=$11, longitude=$12, obs=$13,
                 updated_at=NOW()
               WHERE id=$1 AND ordem_id=$2`,
              [ex.rows[0].id, ordemId,
               p.seq || (i+1), p.codigo_local||null, p.cliente_nome||null, p.endereco||null,
               p.regiao||null, p.peso||null, p.pedido||null, p.nf||null,
               p.latitude||null, p.longitude||null, p.obs||null]
            );
            resumo.paradas_atualizadas++;
          } else {
            await client.query(
              `INSERT INTO logi_ordem_paradas
                (ordem_id, seq, codigo_local, cliente_nome, endereco, regiao, peso, pedido, remessa, nf, latitude, longitude, obs)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
              [ordemId, p.seq||(i+1), p.codigo_local||null, p.cliente_nome||null, p.endereco||null,
               p.regiao||null, p.peso||null, p.pedido||null, String(p.remessa), p.nf||null,
               p.latitude||null, p.longitude||null, p.obs||null]
            );
            resumo.paradas_criadas++;
          }
        } else {
          // Sem remessa, sempre INSERT
          await client.query(
            `INSERT INTO logi_ordem_paradas
              (ordem_id, seq, codigo_local, cliente_nome, endereco, regiao, peso, pedido, remessa, nf, latitude, longitude, obs)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
            [ordemId, p.seq||(i+1), p.codigo_local||null, p.cliente_nome||null, p.endereco||null,
             p.regiao||null, p.peso||null, p.pedido||null, null, p.nf||null,
             p.latitude||null, p.longitude||null, p.obs||null]
          );
          resumo.paradas_criadas++;
        }
      }

      // Atualizar quant_entregas real e marcar origem
      await client.query(
        `UPDATE logi_ordens_transporte
         SET quant_entregas = (SELECT COUNT(*)::int FROM logi_ordem_paradas WHERE ordem_id = $1),
             origem_importacao = 'roteasy',
             updated_at = NOW()
         WHERE id = $1`,
        [ordemId]
      );
      resumo.rotas_importadas++;
    }

    await client.query('COMMIT');
    res.status(201).json({ success: true, ...resumo });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    next(err);
  } finally {
    client.release();
  }
});

// ─────────────────────────────────────────────────────────────
// FUNÇÃO HELPER: gera CAP/CAR pra uma OT (rota)
// ─────────────────────────────────────────────────────────────
async function gerarFinanceiroDaOrdem(client, ordem, { tabela_frete_id }) {
  const { veiculo_id, motorista_id, data, numero_rota, regiao, ajudante_extra, ajudante_nome } = ordem;
  if (!veiculo_id) return;

  const { rows: vrows } = await client.query(
    `SELECT v.ag_ft, v.tipo AS veiculo_tipo,
            t.id AS transportadora_id, t.nome AS transportadora_nome
     FROM logi_veiculos v
     LEFT JOIN logi_transportadoras t ON t.id = v.transportadora_id
     WHERE v.id = $1`, [veiculo_id]
  );
  if (!vrows.length) return;
  const veiculo = vrows[0];

  const descBase = `Rota ${numero_rota || ordem.id} - ${regiao || ''} - ${data}`;

  // CAR — frete recebido por tipo de veículo
  try {
    const { rows: fr } = await client.query(
      'SELECT valor FROM logi_tabela_frete_recebido WHERE UPPER(TRIM(tipo_veiculo)) = UPPER(TRIM($1))',
      [veiculo.veiculo_tipo]
    );
    if (fr.length && fr[0].valor) {
      await client.query(
        `INSERT INTO logi_contas_receber (ordem_id, cliente, valor, vencimento, obs)
         VALUES ($1, $2, $3, $4, $5)`,
        [ordem.id, 'Léo Madeiras', fr[0].valor, data,
         `[ROTA] Frete recebido - ${veiculo.veiculo_tipo} - ${descBase}`]
      );
    }
  } catch (e) { console.error('CAR err:', e.message); }

  // CAP — frete pago / diária
  try {
    if (veiculo.ag_ft === 'agregado' && tabela_frete_id) {
      const { rows: fr } = await client.query(
        'SELECT valor_base FROM logi_tabela_fretes WHERE id = $1', [tabela_frete_id]
      );
      if (fr.length) {
        await client.query(
          `INSERT INTO logi_contas_pagar
            (ordem_id, tabela_frete_id, transportadora_id, motorista_id, valor, vencimento, descricao, tipo_lancamento)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [ordem.id, tabela_frete_id, veiculo.transportadora_id||null, motorista_id||null,
           fr[0].valor_base, data,
           `[ROTA] Frete agregado - ${veiculo.transportadora_nome||''} - ${descBase}`,
           'frete_agregado']
        );
      }
    } else if (veiculo.ag_ft === 'frota' && motorista_id && tabela_frete_id) {
      const { rows: fr } = await client.query(
        'SELECT valor_base FROM logi_tabela_fretes WHERE id = $1', [tabela_frete_id]
      );
      if (fr.length) {
        await client.query(
          `INSERT INTO logi_contas_pagar
            (ordem_id, tabela_frete_id, motorista_id, valor, vencimento, descricao, tipo_lancamento)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [ordem.id, tabela_frete_id, motorista_id,
           fr[0].valor_base, data,
           `[ROTA] Diária motorista - ${descBase}`, 'diaria_motorista']
        );
      }
    }

    // Ajudante extra (R$) — lançamento direto (não usa parâmetro)
    if (Number(ajudante_extra) > 0) {
      await client.query(
        `INSERT INTO logi_contas_pagar
          (ordem_id, motorista_id, valor, vencimento, descricao, tipo_lancamento)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [ordem.id, motorista_id||null, Number(ajudante_extra), data,
         `[ROTA] Ajudante extra${ajudante_nome ? ' - ' + ajudante_nome : ''} - ${descBase}`,
         'diaria_ajudante']
      );
    }
  } catch (e) { console.error('CAP err:', e.message); }
}

module.exports = router;
