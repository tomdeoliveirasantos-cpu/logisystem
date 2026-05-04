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

// ═══════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════

function normalizar(s) {
  return String(s || '').trim().toUpperCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

async function buscarVeiculoPorPlaca(placa) {
  if (!placa) return null;
  const placaNorm = normalizar(placa).replace(/[^A-Z0-9]/g, '');
  const { rows } = await db.query(
    `SELECT v.id, v.tipo, v.ag_ft, v.transportadora_id, t.nome AS transportadora_nome
     FROM logi_veiculos v
     LEFT JOIN logi_transportadoras t ON t.id = v.transportadora_id
     WHERE UPPER(REGEXP_REPLACE(v.placa, '[^A-Za-z0-9]', '', 'g')) = $1
     LIMIT 1`,
    [placaNorm]
  );
  return rows[0] || null;
}

async function buscarMotoristaPorNome(nome) {
  if (!nome) return null;
  const n = String(nome).trim();
  try {
    const { rows } = await db.query(
      `SELECT id, nome FROM logi_motoristas
       WHERE UPPER(nome) = UPPER($1) OR UPPER(nome) ILIKE UPPER($2)
       ORDER BY (UPPER(nome) = UPPER($1)) DESC
       LIMIT 1`,
      [n, `%${n}%`]
    );
    return rows[0] || null;
  } catch { return null; }
}

// Carrega paradas de uma OT
async function carregarParadas(ordemId) {
  const { rows } = await db.query(
    `SELECT * FROM logi_ordem_paradas WHERE ordem_id = $1 ORDER BY seq`,
    [ordemId]
  );
  return rows;
}

// Inserir/substituir paradas em lote (sobrescreve as existentes)
async function substituirParadas(client, ordemId, paradas) {
  await client.query(`DELETE FROM logi_ordem_paradas WHERE ordem_id = $1`, [ordemId]);
  if (!paradas?.length) return 0;
  let count = 0;
  for (const p of paradas) {
    await client.query(
      `INSERT INTO logi_ordem_paradas
        (ordem_id, seq, codigo_local, cliente_nome, endereco, regiao, peso,
         pedido, remessa, nf, latitude, longitude, obs, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [ordemId, p.seq || count + 1, p.codigo_local || null,
       p.cliente_nome || null, p.endereco || null, p.regiao || null,
       p.peso || null, p.pedido || null, p.remessa || null, p.nf || null,
       p.latitude || null, p.longitude || null, p.obs || null,
       p.status || 'pendente']
    );
    count++;
  }
  return count;
}

// Gera CAR/CAP consolidado para uma OT (apaga os existentes pendentes da OT antes)
async function regenerarFinanceiroOT(client, ordemId) {
  // Buscar dados da OT
  const { rows: ots } = await client.query(
    `SELECT o.*, v.tipo AS veiculo_tipo, v.ag_ft, v.transportadora_id,
            t.nome AS transportadora_nome
     FROM logi_ordens_transporte o
     LEFT JOIN logi_veiculos v ON v.id = o.veiculo_id
     LEFT JOIN logi_transportadoras t ON t.id = v.transportadora_id
     WHERE o.id = $1`, [ordemId]
  );
  if (!ots.length) return;
  const ot = ots[0];

  // Cancelar lançamentos pendentes anteriores da OT
  await client.query(
    `UPDATE logi_contas_pagar SET status='cancelado'
     WHERE ordem_id=$1 AND status='pendente'`, [ordemId]
  );
  await client.query(
    `UPDATE logi_contas_receber SET status='cancelado'
     WHERE ordem_id=$1 AND status='pendente'`, [ordemId]
  );

  // Tipo efetivo do frete: campo OT.tipo_frete tem precedência sobre veiculo.tipo
  const tipoFreteEfetivo = ot.tipo_frete || ot.veiculo_tipo;
  const mult = Math.max(1, parseInt(ot.multiplicador_frete, 10) || 1);

  // CAR — frete recebido (1 por OT, baseado em tipo_frete × multiplicador)
  if (tipoFreteEfetivo) {
    try {
      const { rows: fr } = await client.query(
        `SELECT valor FROM logi_tabela_frete_recebido
         WHERE UPPER(TRIM(tipo_veiculo)) = UPPER(TRIM($1))`,
        [tipoFreteEfetivo]
      );
      if (fr.length && fr[0].valor) {
        const valorTotal = parseFloat(fr[0].valor) * mult;
        const sufMult = mult > 1 ? ` (${mult}x)` : '';
        await client.query(
          `INSERT INTO logi_contas_receber (ordem_id, cliente, valor, vencimento, obs)
           VALUES ($1, $2, $3, $4, $5)`,
          [ordemId, 'Léo Madeiras', valorTotal, ot.data,
           `Frete recebido - ${tipoFreteEfetivo}${sufMult} - Rota ${ot.numero_rota || ordemId}`]
        );
      }
    } catch (e) { console.error('CAR:', e.message); }
  }

  // CAP — depende de tipo_frota
  const tipoFrota = ot.tipo_frota ||
    (ot.ag_ft === 'frota' ? 'proprio' : ot.ag_ft === 'agregado' ? 'agregado' : 'terceiro');

  if (tipoFrota === 'agregado' && ot.veiculo_id) {
    // Frete pago à transportadora (tipo_frete × multiplicador)
    try {
      const { rows: tf } = await client.query(
        `SELECT valor_base FROM logi_tabela_fretes
         WHERE UPPER(TRIM(tipo_veiculo)) = UPPER(TRIM($1))
         ORDER BY id DESC LIMIT 1`,
        [tipoFreteEfetivo || '']
      );
      if (tf.length && tf[0].valor_base) {
        const valorTotal = parseFloat(tf[0].valor_base) * mult;
        const sufMult = mult > 1 ? ` (${mult}x)` : '';
        await client.query(
          `INSERT INTO logi_contas_pagar
            (ordem_id, transportadora_id, motorista_id, valor, vencimento, descricao, tipo_lancamento)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [ordemId, ot.transportadora_id, ot.motorista_id,
           valorTotal, ot.data,
           `Frete agregado - ${ot.transportadora_nome || ''} - ${tipoFreteEfetivo}${sufMult} - Rota ${ot.numero_rota || ordemId}`,
           'frete_agregado']
        );
      }
    } catch (e) { console.error('CAP agregado:', e.message); }
  } else if (tipoFrota === 'proprio' && ot.motorista_id) {
    // Diária do motorista (frota própria) com multiplicador
    try {
      const { rows: tf } = await client.query(
        `SELECT valor_base FROM logi_tabela_fretes
         WHERE UPPER(TRIM(tipo_veiculo)) = UPPER(TRIM($1))
         ORDER BY id DESC LIMIT 1`,
        [tipoFreteEfetivo || '']
      );
      if (tf.length && tf[0].valor_base) {
        const valorTotal = parseFloat(tf[0].valor_base) * mult;
        const sufMult = mult > 1 ? ` (${mult}x)` : '';
        await client.query(
          `INSERT INTO logi_contas_pagar
            (ordem_id, motorista_id, valor, vencimento, descricao, tipo_lancamento)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [ordemId, ot.motorista_id, valorTotal, ot.data,
           `Diária motorista - ${tipoFreteEfetivo}${sufMult} - Rota ${ot.numero_rota || ordemId}`, 'diaria_motorista']
        );
      }
    } catch (e) { console.error('CAP proprio:', e.message); }
  }
  // Terceiro: sem CAP automático (pago externamente)

  // Ajudante extra (R$ direto da OT, se preenchido) — compat com campo único
  const ajuExtra = parseFloat(ot.ajudante_extra) || 0;
  if (ajuExtra > 0) {
    await client.query(
      `INSERT INTO logi_contas_pagar
        (ordem_id, motorista_id, valor, vencimento, descricao, tipo_lancamento)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [ordemId, ot.motorista_id, ajuExtra, ot.data,
       `Ajudante Extra - Rota ${ot.numero_rota || ordemId}`, 'diaria_ajudante']
    );
  }

  // Ajudantes vinculados (N-pra-N): 1 CAP por ajudante
  try {
    const { rows: ajuRows } = await client.query(
      `SELECT oa.motorista_id, oa.valor, m.nome AS ajudante_nome
       FROM logi_ordem_ajudantes oa
       LEFT JOIN logi_motoristas m ON m.id = oa.motorista_id
       WHERE oa.ordem_id = $1`, [ordemId]
    );
    // Valor padrão de ajudante (parametrizado)
    let valorPadraoAju = 0;
    const { rows: paramRows } = await client.query(
      "SELECT valor FROM logi_parametros WHERE chave = 'valor_ajudante'"
    );
    if (paramRows.length) valorPadraoAju = parseFloat(paramRows[0].valor) || 0;

    for (const a of ajuRows) {
      const valorAju = (parseFloat(a.valor) > 0 ? parseFloat(a.valor) : valorPadraoAju);
      if (valorAju > 0) {
        await client.query(
          `INSERT INTO logi_contas_pagar
            (ordem_id, motorista_id, valor, vencimento, descricao, tipo_lancamento)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [ordemId, a.motorista_id, valorAju, ot.data,
           `Ajudante ${a.ajudante_nome || ''} - Rota ${ot.numero_rota || ordemId}`, 'diaria_ajudante']
        );
      }
    }
  } catch (e) { console.error('CAP ajudantes:', e.message); }

  // Ajuda diesel (R$ direto da OT, se preenchido)
  const ajuDiesel = parseFloat(ot.ajuda_diesel) || 0;
  if (ajuDiesel > 0) {
    await client.query(
      `INSERT INTO logi_contas_pagar
        (ordem_id, motorista_id, valor, vencimento, descricao, tipo_lancamento)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [ordemId, ot.motorista_id, ajuDiesel, ot.data,
       `Ajuda Diesel - Rota ${ot.numero_rota || ordemId}`, 'ajuda_diesel']
    );
  }

  // Taxa descarga
  const taxaDesc = parseFloat(ot.taxa_descarga) || 0;
  if (taxaDesc > 0) {
    await client.query(
      `INSERT INTO logi_contas_pagar
        (ordem_id, motorista_id, valor, vencimento, descricao, tipo_lancamento)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [ordemId, ot.motorista_id, taxaDesc, ot.data,
       `Taxa Descarga - Rota ${ot.numero_rota || ordemId}`, 'taxa_descarga']
    );
  }
}

// ═══════════════════════════════════════════════════════════
// LISTAR / BUSCAR
// ═══════════════════════════════════════════════════════════

router.get('/', async (req, res, next) => {
  try {
    const { data, status, motorista_id, veiculo_id, cliente_id, tipo_frota,
            page=1, limit=100, include_paradas } = req.query;
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
              m.nome  AS motorista_nome,
              v.placa, v.tipo AS veiculo_tipo, v.ag_ft,
              c.nome  AS cliente_cadastrado,
              (SELECT COUNT(*)::int FROM logi_ordem_paradas p WHERE p.ordem_id = o.id) AS qt_paradas_real
       FROM   logi_ordens_transporte o
       LEFT JOIN logi_motoristas m ON m.id = o.motorista_id
       LEFT JOIN logi_veiculos   v ON v.id = o.veiculo_id
       LEFT JOIN logi_clientes   c ON c.id = o.cliente_id
       ${wc}
       ORDER BY o.data DESC, o.numero_rota
       LIMIT $${params.length-1} OFFSET $${params.length}`,
      params
    );

    // Se include_paradas=1, anexa array de paradas em cada OT
    if (include_paradas === '1' && rows.length) {
      const ids = rows.map(r => r.id);
      const ph = ids.map((_, i) => `$${i+1}`).join(',');
      const { rows: todasParadas } = await db.query(
        `SELECT * FROM logi_ordem_paradas WHERE ordem_id IN (${ph}) ORDER BY ordem_id, seq`,
        ids
      );
      const grouped = {};
      for (const p of todasParadas) {
        (grouped[p.ordem_id] = grouped[p.ordem_id] || []).push(p);
      }
      for (const r of rows) r.paradas = grouped[r.id] || [];
    }

    res.json(rows);
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT o.*, m.nome AS motorista_nome, v.placa, v.tipo AS veiculo_tipo, v.ag_ft,
              c.nome AS cliente_cadastrado
       FROM logi_ordens_transporte o
       LEFT JOIN logi_motoristas m ON m.id = o.motorista_id
       LEFT JOIN logi_veiculos   v ON v.id = o.veiculo_id
       LEFT JOIN logi_clientes   c ON c.id = o.cliente_id
       WHERE o.id = $1`, [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Não encontrado' });

    const ot = rows[0];
    ot.paradas = await carregarParadas(ot.id);
    // Carregar ajudantes vinculados
    const { rows: ajus } = await db.query(
      `SELECT oa.motorista_id, oa.valor, m.nome AS ajudante_nome
       FROM logi_ordem_ajudantes oa
       LEFT JOIN logi_motoristas m ON m.id = oa.motorista_id
       WHERE oa.ordem_id = $1`, [ot.id]
    );
    ot.ajudantes = ajus;
    res.json(ot);
  } catch (err) { next(err); }
});

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

// ═══════════════════════════════════════════════════════════
// CRIAR / EDITAR (com paradas inline opcionais)
// ═══════════════════════════════════════════════════════════

router.post('/', upload.single('anexo'), async (req, res, next) => {
  const client = await db.pool.connect();
  try {
    const {
      cliente_id, motorista_id, veiculo_id, data, numero_rota,
      tipo_frota,                          // 'proprio' | 'agregado' | 'terceiro'
      tipo_frete,                          // HR/IVECO/3-4/TOCO/TRUCK/MASTER (default = veiculo.tipo)
      multiplicador_frete = 1,             // 1-9
      quant_entregas,                      // estimativa
      saida, regiao,
      status='pendente', tipo, pagto,
      ajuda_diesel=0, taxa_descarga=0, ajudante_extra=0,
      n_cont, q_capas=0, obs,
      km_saida, km_chegada,
      paradas,                             // array opcional
      ajudantes,                           // array de motorista_id (opcional)
    } = req.body;

    // paradas pode vir como JSON string (multer/multipart)
    let paradasArr = [];
    if (paradas) {
      paradasArr = typeof paradas === 'string' ? JSON.parse(paradas) : paradas;
    }
    // ajudantes idem
    let ajudantesArr = [];
    if (ajudantes) {
      ajudantesArr = typeof ajudantes === 'string' ? JSON.parse(ajudantes) : ajudantes;
    }

    const anexo_nome = req.file ? req.file.originalname : null;
    const anexo_path = req.file ? req.file.filename     : null;
    const anexo_size = req.file ? req.file.size         : null;

    await client.query('BEGIN');

    const { rows } = await client.query(
      `INSERT INTO logi_ordens_transporte
        (cliente_id,motorista_id,veiculo_id,data,numero_rota,
         tipo_frota,tipo_frete,multiplicador_frete,quant_entregas,saida,regiao,status,tipo,pagto,
         ajuda_diesel,taxa_descarga,ajudante_extra,
         n_cont,q_capas,obs,
         anexo_nome,anexo_path,anexo_tamanho,
         km_saida,km_chegada)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25)
       RETURNING *`,
      [cliente_id||null, motorista_id||null, veiculo_id||null, data,
       numero_rota||null, tipo_frota||null, tipo_frete||null, parseInt(multiplicador_frete,10)||1,
       quant_entregas||null,
       saida||null, regiao||null, status, tipo||null, pagto||null,
       ajuda_diesel||0, taxa_descarga||0, ajudante_extra||0,
       n_cont||null, q_capas||0, obs||null,
       anexo_nome, anexo_path, anexo_size,
       km_saida||null, km_chegada||null]
    );

    const ordem = rows[0];

    // Inserir paradas se vieram
    if (paradasArr.length) {
      await substituirParadas(client, ordem.id, paradasArr);
    }

    // Inserir ajudantes (N-pra-N)
    if (ajudantesArr.length) {
      for (const a of ajudantesArr) {
        const motId = typeof a === 'object' ? a.motorista_id : a;
        const valor = typeof a === 'object' ? a.valor : null;
        if (motId) {
          await client.query(
            `INSERT INTO logi_ordem_ajudantes (ordem_id, motorista_id, valor)
             VALUES ($1,$2,$3)
             ON CONFLICT (ordem_id, motorista_id) DO UPDATE SET valor=EXCLUDED.valor`,
            [ordem.id, motId, valor]
          );
        }
      }
    }

    // Gerar CAP/CAR consolidado
    await regenerarFinanceiroOT(client, ordem.id);

    await client.query('COMMIT');

    // Retornar com paradas
    ordem.paradas = await carregarParadas(ordem.id);
    res.status(201).json(ordem);
  } catch (err) {
    await client.query('ROLLBACK').catch(()=>{});
    next(err);
  } finally {
    client.release();
  }
});

router.put('/:id', upload.single('anexo'), async (req, res, next) => {
  const client = await db.pool.connect();
  try {
    const {
      cliente_id, motorista_id, veiculo_id, data, numero_rota,
      tipo_frota, tipo_frete, multiplicador_frete, quant_entregas,
      saida, regiao, tipo, pagto,
      ajuda_diesel, taxa_descarga, ajudante_extra,
      n_cont, q_capas, obs,
      km_saida, km_chegada,
      paradas,
      ajudantes,                           // array de motorista_id ou {motorista_id, valor}
    } = req.body;

    let paradasArr = null;
    if (paradas !== undefined) {
      paradasArr = typeof paradas === 'string' ? JSON.parse(paradas) : paradas;
    }

    let ajudantesArr = null;
    if (ajudantes !== undefined) {
      ajudantesArr = typeof ajudantes === 'string' ? JSON.parse(ajudantes) : ajudantes;
    }

    const anexo_nome = req.file ? req.file.originalname : undefined;
    const anexo_path = req.file ? req.file.filename     : undefined;
    const anexo_size = req.file ? req.file.size         : undefined;

    await client.query('BEGIN');

    // SET dinâmico (só atualiza campos enviados)
    const sets = [];
    const params = [];
    const add = (col, val) => {
      if (val !== undefined) {
        params.push(val);
        sets.push(`${col}=$${params.length}`);
      }
    };

    add('cliente_id', cliente_id);
    add('motorista_id', motorista_id);
    add('veiculo_id', veiculo_id);
    add('data', data);
    add('numero_rota', numero_rota);
    add('tipo_frota', tipo_frota);
    add('tipo_frete', tipo_frete);
    if (multiplicador_frete !== undefined) {
      add('multiplicador_frete', Math.max(1, Math.min(9, parseInt(multiplicador_frete, 10) || 1)));
    }
    add('quant_entregas', quant_entregas);
    add('saida', saida);
    add('regiao', regiao);
    add('tipo', tipo);
    add('pagto', pagto);
    add('ajuda_diesel', ajuda_diesel === undefined ? undefined : (ajuda_diesel || 0));
    add('taxa_descarga', taxa_descarga === undefined ? undefined : (taxa_descarga || 0));
    add('ajudante_extra', ajudante_extra === undefined ? undefined : (ajudante_extra || 0));
    add('n_cont', n_cont);
    add('q_capas', q_capas === undefined ? undefined : (q_capas || 0));
    add('obs', obs);
    add('km_saida', km_saida === undefined ? undefined : (km_saida || null));
    add('km_chegada', km_chegada === undefined ? undefined : (km_chegada || null));
    if (anexo_nome !== undefined) {
      add('anexo_nome', anexo_nome);
      add('anexo_path', anexo_path);
      add('anexo_tamanho', anexo_size);
    }

    if (!sets.length && paradasArr === null && ajudantesArr === null) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Nenhum campo para atualizar' });
    }

    if (sets.length) {
      params.push(new Date());
      sets.push(`updated_at=$${params.length}`);
      params.push(req.params.id);
      const { rows } = await client.query(
        `UPDATE logi_ordens_transporte SET ${sets.join(',')} WHERE id=$${params.length} RETURNING *`,
        params
      );
      if (!rows.length) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Ordem não encontrada' });
      }
    }

    if (paradasArr !== null) {
      await substituirParadas(client, req.params.id, paradasArr);
    }

    // Substituir ajudantes (apaga todos e reinsere)
    if (ajudantesArr !== null) {
      await client.query(
        `DELETE FROM logi_ordem_ajudantes WHERE ordem_id = $1`, [req.params.id]
      );
      for (const a of ajudantesArr) {
        const motId = typeof a === 'object' ? a.motorista_id : a;
        const valor = typeof a === 'object' ? a.valor : null;
        if (motId) {
          await client.query(
            `INSERT INTO logi_ordem_ajudantes (ordem_id, motorista_id, valor)
             VALUES ($1,$2,$3)`,
            [req.params.id, motId, valor]
          );
        }
      }
    }

    // Regenerar financeiro
    await regenerarFinanceiroOT(client, req.params.id);

    await client.query('COMMIT');

    // Retornar com paradas
    const { rows: final } = await db.query(
      `SELECT * FROM logi_ordens_transporte WHERE id=$1`, [req.params.id]
    );
    final[0].paradas = await carregarParadas(req.params.id);
    res.json(final[0]);
  } catch (err) {
    await client.query('ROLLBACK').catch(()=>{});
    next(err);
  } finally {
    client.release();
  }
});

// ═══════════════════════════════════════════════════════════
// PARADAS (CRUD isolado — alternativa a paradas inline)
// ═══════════════════════════════════════════════════════════

router.get('/:id/paradas', async (req, res, next) => {
  try {
    const paradas = await carregarParadas(req.params.id);
    res.json(paradas);
  } catch (err) { next(err); }
});

router.post('/:id/paradas', async (req, res, next) => {
  try {
    const p = req.body;
    const { rows } = await db.query(
      `INSERT INTO logi_ordem_paradas
        (ordem_id, seq, codigo_local, cliente_nome, endereco, regiao, peso,
         pedido, remessa, nf, latitude, longitude, obs, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       RETURNING *`,
      [req.params.id, p.seq || 1, p.codigo_local || null,
       p.cliente_nome || null, p.endereco || null, p.regiao || null,
       p.peso || null, p.pedido || null, p.remessa || null, p.nf || null,
       p.latitude || null, p.longitude || null, p.obs || null,
       p.status || 'pendente']
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

router.put('/:id/paradas/:paradaId', async (req, res, next) => {
  try {
    const { seq, codigo_local, cliente_nome, endereco, regiao, peso,
            pedido, remessa, nf, latitude, longitude, obs, status } = req.body;
    const sets = [];
    const params = [];
    const add = (col, val) => {
      if (val !== undefined) { params.push(val); sets.push(`${col}=$${params.length}`); }
    };
    add('seq', seq); add('codigo_local', codigo_local); add('cliente_nome', cliente_nome);
    add('endereco', endereco); add('regiao', regiao); add('peso', peso);
    add('pedido', pedido); add('remessa', remessa); add('nf', nf);
    add('latitude', latitude); add('longitude', longitude); add('obs', obs); add('status', status);
    if (!sets.length) return res.status(400).json({ error: 'Nada a atualizar' });
    params.push(new Date()); sets.push(`updated_at=$${params.length}`);
    params.push(req.params.paradaId);
    params.push(req.params.id);
    const { rows } = await db.query(
      `UPDATE logi_ordem_paradas SET ${sets.join(',')}
       WHERE id=$${params.length-1} AND ordem_id=$${params.length} RETURNING *`,
      params
    );
    if (!rows.length) return res.status(404).json({ error: 'Parada não encontrada' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

router.delete('/:id/paradas/:paradaId', async (req, res, next) => {
  try {
    await db.query(
      `DELETE FROM logi_ordem_paradas WHERE id=$1 AND ordem_id=$2`,
      [req.params.paradaId, req.params.id]
    );
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ═══════════════════════════════════════════════════════════
// AJUDANTES (N-pra-N com colaboradores)
// ═══════════════════════════════════════════════════════════

router.get('/:id/ajudantes', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT oa.*, m.nome AS ajudante_nome, m.telefone, m.cnh
       FROM logi_ordem_ajudantes oa
       LEFT JOIN logi_motoristas m ON m.id = oa.motorista_id
       WHERE oa.ordem_id = $1
       ORDER BY m.nome`, [req.params.id]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

router.post('/:id/ajudantes', async (req, res, next) => {
  const client = await db.pool.connect();
  try {
    const { motorista_id, valor } = req.body;
    if (!motorista_id) return res.status(400).json({ error: 'motorista_id obrigatório' });

    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO logi_ordem_ajudantes (ordem_id, motorista_id, valor)
       VALUES ($1,$2,$3)
       ON CONFLICT (ordem_id, motorista_id) DO UPDATE SET valor=EXCLUDED.valor
       RETURNING *`,
      [req.params.id, motorista_id, valor || null]
    );
    await regenerarFinanceiroOT(client, req.params.id);
    await client.query('COMMIT');
    res.status(201).json(rows[0]);
  } catch (err) {
    await client.query('ROLLBACK').catch(()=>{});
    next(err);
  } finally {
    client.release();
  }
});

router.delete('/:id/ajudantes/:motoristaId', async (req, res, next) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `DELETE FROM logi_ordem_ajudantes WHERE ordem_id=$1 AND motorista_id=$2`,
      [req.params.id, req.params.motoristaId]
    );
    await regenerarFinanceiroOT(client, req.params.id);
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK').catch(()=>{});
    next(err);
  } finally {
    client.release();
  }
});

// ═══════════════════════════════════════════════════════════
// STATUS / HISTÓRICO
// ═══════════════════════════════════════════════════════════

router.patch('/:id/status', async (req, res, next) => {
  try {
    const { status } = req.body;
    const valid = ['pendente','entregue','devolucao','cancelado'];
    if (!valid.includes(status)) return res.status(422).json({ error: 'Status inválido' });

    const { rows: prev } = await db.query(
      'SELECT status FROM logi_ordens_transporte WHERE id=$1', [req.params.id]
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

router.get('/:id/historico', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT * FROM logi_historico_ordens WHERE ordem_id=$1 ORDER BY created_at DESC`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// ═══════════════════════════════════════════════════════════
// IMPORTAÇÃO ROTEASY (match por rota — só importa se OT já existe)
// ═══════════════════════════════════════════════════════════

// Preview: faz lookups, mostra quais rotas TÊM match e quais serão IGNORADAS
router.post('/importar/preview', async (req, res, next) => {
  try {
    const { data, rotas } = req.body;
    if (!data || !rotas?.length) return res.status(400).json({ error: 'Data e rotas são obrigatórios' });

    // Buscar OTs do dia
    const numerosRotaPlanilha = rotas.map(r => Number(r.numero_rota)).filter(n => !isNaN(n));
    let otsDoDia = [];
    if (numerosRotaPlanilha.length) {
      const ph = numerosRotaPlanilha.map((_, i) => `$${i+2}`).join(',');
      const { rows } = await db.query(
        `SELECT o.id, o.numero_rota, o.tipo_frota, o.veiculo_id, o.motorista_id,
                v.placa, m.nome AS motorista_nome,
                (SELECT COUNT(*)::int FROM logi_ordem_paradas p WHERE p.ordem_id = o.id) AS paradas_atuais
         FROM logi_ordens_transporte o
         LEFT JOIN logi_veiculos v ON v.id = o.veiculo_id
         LEFT JOIN logi_motoristas m ON m.id = o.motorista_id
         WHERE o.data = $1 AND o.numero_rota IN (${ph})`,
        [data, ...numerosRotaPlanilha]
      );
      otsDoDia = rows;
    }

    const mapOTs = new Map();
    for (const ot of otsDoDia) mapOTs.set(String(ot.numero_rota), ot);

    const comMatch = [];
    const semMatch = [];
    let totalParadas = 0;
    let paradasIgnoradas = 0;

    for (const rota of rotas) {
      const ot = mapOTs.get(String(rota.numero_rota));
      const paradasCount = (rota.paradas || []).length;
      totalParadas += paradasCount;

      if (ot) {
        comMatch.push({
          numero_rota: rota.numero_rota,
          ot_id: ot.id,
          tipo_frota: ot.tipo_frota,
          placa_cadastrada: ot.placa,
          motorista_cadastrado: ot.motorista_nome,
          placa_planilha: rota.placa,
          operador_planilha: rota.operador,
          paradas_planilha: paradasCount,
          paradas_atuais: ot.paradas_atuais,
          peso_total: (rota.paradas || []).reduce((s,p) => s + (Number(p.peso)||0), 0),
        });
      } else {
        semMatch.push({
          numero_rota: rota.numero_rota,
          placa: rota.placa,
          operador: rota.operador,
          paradas: paradasCount,
        });
        paradasIgnoradas += paradasCount;
      }
    }

    res.json({
      data,
      total_rotas_planilha: rotas.length,
      total_paradas_planilha: totalParadas,
      rotas_com_match: comMatch.length,
      rotas_sem_match: semMatch.length,
      paradas_a_importar: totalParadas - paradasIgnoradas,
      paradas_ignoradas: paradasIgnoradas,
      com_match: comMatch,
      sem_match: semMatch,
    });
  } catch (err) { next(err); }
});

// Importar: substitui paradas das OTs com match. Rotas sem match são ignoradas silenciosamente.
router.post('/importar', async (req, res, next) => {
  const client = await db.pool.connect();
  try {
    const { data, rotas } = req.body;
    if (!data || !rotas?.length) return res.status(400).json({ error: 'Data e rotas são obrigatórios' });

    await client.query('BEGIN');

    // Buscar todas as OTs do dia para match
    const numerosRota = rotas.map(r => Number(r.numero_rota)).filter(n => !isNaN(n));
    let otsDoDia = [];
    if (numerosRota.length) {
      const ph = numerosRota.map((_, i) => `$${i+2}`).join(',');
      const { rows } = await client.query(
        `SELECT id, numero_rota FROM logi_ordens_transporte
         WHERE data = $1 AND numero_rota IN (${ph})`,
        [data, ...numerosRota]
      );
      otsDoDia = rows;
    }
    const mapOTs = new Map();
    for (const ot of otsDoDia) mapOTs.set(String(ot.numero_rota), ot);

    const resumo = {
      rotas_processadas: 0,
      rotas_ignoradas: 0,
      paradas_inseridas: 0,
      ots_atualizadas: [],
    };

    for (const rota of rotas) {
      const ot = mapOTs.get(String(rota.numero_rota));
      if (!ot) {
        resumo.rotas_ignoradas++;
        continue;
      }

      // Substituir paradas da OT
      const paradasRota = (rota.paradas || []).map((p, i) => ({
        seq: p.seq || i + 1,
        codigo_local: p.codigo_local,
        cliente_nome: p.cliente_nome,
        endereco: p.endereco,
        regiao: p.regiao,
        peso: p.peso,
        pedido: p.pedido,
        remessa: p.remessa,
        nf: p.nf,
        latitude: p.latitude,
        longitude: p.longitude,
        obs: p.obs,
      }));

      const inseridas = await substituirParadas(client, ot.id, paradasRota);
      resumo.paradas_inseridas += inseridas;

      // Atualizar quant_entregas + origem_importacao
      await client.query(
        `UPDATE logi_ordens_transporte
         SET quant_entregas = $1, origem_importacao = 'roteasy', updated_at = NOW()
         WHERE id = $2`,
        [inseridas, ot.id]
      );

      resumo.rotas_processadas++;
      resumo.ots_atualizadas.push({ ot_id: ot.id, numero_rota: rota.numero_rota, paradas: inseridas });
    }

    await client.query('COMMIT');
    res.status(200).json({ success: true, ...resumo });
  } catch (err) {
    await client.query('ROLLBACK').catch(()=>{});
    next(err);
  } finally {
    client.release();
  }
});

// ═══════════════════════════════════════════════════════════
// AGRUPAR / DESAGRUPAR (mantido — UI esconde mas API permanece)
// ═══════════════════════════════════════════════════════════

router.post('/agrupar', async (req, res, next) => {
  try {
    const { ordem_ids, motorista_id, veiculo_id, tabela_frete_id } = req.body;
    if (!ordem_ids || ordem_ids.length < 2) {
      return res.status(400).json({ error: 'Selecione pelo menos 2 ordens para agrupar' });
    }

    const grupoId = 'GV' + Date.now().toString(36).toUpperCase();

    const placeholders = ordem_ids.map((_, i) => `$${i + 1}`).join(',');
    const { rows: ordens } = await db.query(
      `SELECT id, data, numero_rota, regiao, motorista_id, veiculo_id, grupo_viagem
       FROM logi_ordens_transporte WHERE id IN (${placeholders})`,
      ordem_ids
    );

    if (ordens.length !== ordem_ids.length) {
      return res.status(400).json({ error: 'Uma ou mais ordens não encontradas' });
    }

    const jaAgrupadas = ordens.filter(o => o.grupo_viagem);
    if (jaAgrupadas.length) {
      return res.status(400).json({
        error: `Ordens já agrupadas: ${jaAgrupadas.map(o => o.numero_rota || o.id).join(', ')}`
      });
    }

    const sets = ['grupo_viagem = $1'];
    const baseParams = [grupoId];
    if (motorista_id) { sets.push(`motorista_id = $${baseParams.length + 1}`); baseParams.push(motorista_id); }
    if (veiculo_id)   { sets.push(`veiculo_id = $${baseParams.length + 1}`);   baseParams.push(veiculo_id); }

    for (const ordemId of ordem_ids) {
      await db.query(
        `UPDATE logi_ordens_transporte SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${baseParams.length + 1}`,
        [...baseParams, ordemId]
      );
    }

    await db.query(
      `UPDATE logi_contas_pagar SET status = 'cancelado'
       WHERE ordem_id = ANY($1) AND status = 'pendente' AND tipo_lancamento = 'frete_agregado'`,
      [ordem_ids]
    );

    if (tabela_frete_id && veiculo_id) {
      const { rows: fr } = await db.query('SELECT valor_base FROM logi_tabela_fretes WHERE id = $1', [tabela_frete_id]);
      if (fr.length) {
        const { rows: vrows } = await db.query(
          `SELECT v.tipo AS veiculo_tipo, t.id AS transportadora_id, t.nome AS transportadora_nome
           FROM logi_veiculos v
           LEFT JOIN logi_transportadoras t ON t.id = v.transportadora_id
           WHERE v.id = $1`, [veiculo_id]
        );
        const veiculo = vrows[0] || {};
        const rotas = ordens.map(o => o.numero_rota).filter(Boolean).join('+');

        await db.query(
          `INSERT INTO logi_contas_pagar
            (ordem_id, tabela_frete_id, transportadora_id, motorista_id, valor, vencimento, descricao, tipo_lancamento, grupo_viagem)
           VALUES ($1, $2, $3, $4, $5, $6, $7, 'frete_agregado', $8)`,
          [ordem_ids[0], tabela_frete_id, veiculo.transportadora_id || null,
           motorista_id || null, fr[0].valor_base, ordens[0].data,
           `Frete agrupado (${grupoId}) - Rotas ${rotas}`, grupoId]
        );
      }
    }

    res.json({ success: true, grupo_viagem: grupoId, ordens_agrupadas: ordem_ids.length });
  } catch (err) { next(err); }
});

router.post('/desagrupar', async (req, res, next) => {
  try {
    const { grupo_viagem } = req.body;
    if (!grupo_viagem) return res.status(400).json({ error: 'grupo_viagem é obrigatório' });

    await db.query(
      `UPDATE logi_ordens_transporte SET grupo_viagem = NULL, updated_at = NOW() WHERE grupo_viagem = $1`,
      [grupo_viagem]
    );
    await db.query(
      `UPDATE logi_contas_pagar SET status = 'cancelado'
       WHERE grupo_viagem = $1 AND status = 'pendente'`,
      [grupo_viagem]
    );

    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
