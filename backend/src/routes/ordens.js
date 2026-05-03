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

// ── Listar ordens ─────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const { data, status, motorista_id, veiculo_id, cliente_id, page=1, limit=100 } = req.query;
    const params = [];
    const where  = [];

    if (data)         { params.push(data);         where.push(`o.data = $${params.length}`); }
    if (status)       { params.push(status);       where.push(`o.status = $${params.length}`); }
    if (motorista_id) { params.push(motorista_id); where.push(`o.motorista_id = $${params.length}`); }
    if (veiculo_id)   { params.push(veiculo_id);   where.push(`o.veiculo_id = $${params.length}`); }
    if (cliente_id)   { params.push(cliente_id);   where.push(`o.cliente_id = $${params.length}`); }

    const wc     = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const offset = (page - 1) * limit;
    params.push(limit, offset);

    const { rows } = await db.query(
      `SELECT o.*,
              m.nome  AS motorista_nome,
              v.placa, v.tipo AS veiculo_tipo,
              c.nome  AS cliente_cadastrado
       FROM   logi_ordens_transporte o
       LEFT JOIN logi_motoristas m ON m.id = o.motorista_id
       LEFT JOIN logi_veiculos   v ON v.id = o.veiculo_id
       LEFT JOIN logi_clientes   c ON c.id = o.cliente_id
       ${wc}
       ORDER BY o.data DESC, o.numero_rota, o.seq
       LIMIT $${params.length-1} OFFSET $${params.length}`,
      params
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// ── Buscar ordem ─────────────────────────────────────────
router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT o.*, m.nome AS motorista_nome, v.placa, v.tipo AS veiculo_tipo, c.nome AS cliente_cadastrado
       FROM logi_ordens_transporte o
       LEFT JOIN logi_motoristas m ON m.id = o.motorista_id
       LEFT JOIN logi_veiculos   v ON v.id = o.veiculo_id
       LEFT JOIN logi_clientes   c ON c.id = o.cliente_id
       WHERE o.id = $1`, [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Não encontrado' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// ── Download do anexo ────────────────────────────────────
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

// ── Criar ordem (com upload opcional) ───────────────────
router.post('/', upload.single('anexo'), async (req, res, next) => {
  try {
    const {
      cliente_id, motorista_id, veiculo_id, data, numero_rota, seq=1,
      saida, pedido, cliente_nome, regiao, peso, km, nf, remessa,
      status='pendente', tipo, pagto,
      ajuda_diesel=0, taxa_descarga=0, n_cont, q_capas=0, obs,
      ajudante_nome,
      tabela_frete_id,
      km_saida, km_chegada,
    } = req.body;

    const anexo_nome  = req.file ? req.file.originalname : null;
    const anexo_path  = req.file ? req.file.filename     : null;
    const anexo_size  = req.file ? req.file.size         : null;

    const { rows } = await db.query(
      `INSERT INTO logi_ordens_transporte
        (cliente_id,motorista_id,veiculo_id,data,numero_rota,seq,saida,pedido,
         cliente_nome,regiao,peso,km,nf,remessa,status,tipo,pagto,
         ajuda_diesel,taxa_descarga,n_cont,q_capas,obs,
         anexo_nome,anexo_path,anexo_tamanho,ajudante_nome,km_saida,km_chegada)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28)
       RETURNING *`,
      [cliente_id,motorista_id,veiculo_id,data,numero_rota,seq,saida,pedido,
       cliente_nome,regiao,peso,km,nf,remessa,status,tipo,pagto,
       ajuda_diesel,taxa_descarga,n_cont,q_capas,obs,
       anexo_nome,anexo_path,anexo_size,ajudante_nome||null,km_saida||null,km_chegada||null]
    );

    const ordem = rows[0];

    // ── Geração automática de Contas a Pagar ─────────────────
    // Busca dados do veículo para saber se é frota própria ou agregado
    if (motorista_id || veiculo_id) {
      const { rows: vrows } = await db.query(
        `SELECT v.ag_ft, v.tipo AS veiculo_tipo,
                m.nome AS motorista_nome,
                t.id AS transportadora_id, t.nome AS transportadora_nome
         FROM logi_veiculos v
         LEFT JOIN logi_motoristas m ON m.id = $2
         LEFT JOIN logi_transportadoras t ON t.id = v.transportadora_id
         WHERE v.id = $1`,
        [veiculo_id, motorista_id]
      );

      if (vrows.length) {
        const veiculo = vrows[0];
        const descBase = `Ordem ${numero_rota || ordem.id} - ${regiao || ''} - ${data}`;

        // Buscar valor do ajudante nos parâmetros
        let valorAjudante = 0;
        if (ajudante_nome) {
          const { rows: paramRows } = await db.query(
            "SELECT valor FROM logi_parametros WHERE chave = 'valor_ajudante'"
          );
          if (paramRows.length) valorAjudante = parseFloat(paramRows[0].valor) || 0;
        }

        if (veiculo.ag_ft === 'agregado') {
          // Frete agregado → paga para a transportadora com base na tabela de fretes
          let valorFrete = null;
          if (tabela_frete_id) {
            const { rows: fr } = await db.query(
              'SELECT valor_base FROM logi_tabela_fretes WHERE id = $1', [tabela_frete_id]
            );
            if (fr.length) valorFrete = fr[0].valor_base;
          }
          if (valorFrete) {
            // Frete agregado (valor base)
            await db.query(
              `INSERT INTO logi_contas_pagar
                (ordem_id, tabela_frete_id, transportadora_id, motorista_id, valor, vencimento, descricao, tipo_lancamento)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
              [ordem.id, tabela_frete_id||null, veiculo.transportadora_id||null, motorista_id||null,
               valorFrete, data, `Frete agregado - ${veiculo.transportadora_nome||''} - ${descBase}`, 'frete_agregado']
            );
          }
          // Ajudante (lançamento separado para clareza)
          if (valorAjudante > 0 && ajudante_nome) {
            await db.query(
              `INSERT INTO logi_contas_pagar
                (ordem_id, transportadora_id, motorista_id, valor, vencimento, descricao, tipo_lancamento)
               VALUES ($1,$2,$3,$4,$5,$6,$7)`,
              [ordem.id, veiculo.transportadora_id||null, motorista_id||null,
               valorAjudante, data,
               `Ajudante - ${ajudante_nome} - ${descBase}`, 'diaria_ajudante']
            );
          }
        } else if (veiculo.ag_ft === 'frota') {
          // Frota própria → gera diária do motorista
          let valorDiaria = null;
          if (tabela_frete_id) {
            const { rows: fr } = await db.query(
              'SELECT valor_base FROM logi_tabela_fretes WHERE id = $1', [tabela_frete_id]
            );
            if (fr.length) valorDiaria = fr[0].valor_base;
          }
          if (valorDiaria && motorista_id) {
            await db.query(
              `INSERT INTO logi_contas_pagar
                (ordem_id, tabela_frete_id, motorista_id, valor, vencimento, descricao, tipo_lancamento)
               VALUES ($1,$2,$3,$4,$5,$6,$7)`,
              [ordem.id, tabela_frete_id||null, motorista_id,
               valorDiaria, data,
               `Diária motorista - ${veiculo.motorista_nome||''} - ${descBase}`, 'diaria_motorista']
            );
          }
          // Ajudante (lançamento separado)
          if (valorAjudante > 0 && ajudante_nome) {
            await db.query(
              `INSERT INTO logi_contas_pagar
                (ordem_id, motorista_id, valor, vencimento, descricao, tipo_lancamento)
               VALUES ($1,$2,$3,$4,$5,$6)`,
              [ordem.id, motorista_id||null,
               valorAjudante, data,
               `Ajudante - ${ajudante_nome} - ${descBase}`, 'diaria_ajudante']
            );
          }
        }
      }
    }

    // ── Geração automática de Contas a Receber (frete fixo por veículo) ──
    if (veiculo_id) {
      try {
        const { rows: vr } = await db.query('SELECT tipo FROM logi_veiculos WHERE id = $1', [veiculo_id]);
        if (vr.length) {
          const tipoVeiculo = vr[0].tipo;
          const { rows: fr } = await db.query(
            'SELECT valor FROM logi_tabela_frete_recebido WHERE UPPER(TRIM(tipo_veiculo)) = UPPER(TRIM($1))',
            [tipoVeiculo]
          );
          if (fr.length && fr[0].valor) {
            await db.query(
              `INSERT INTO logi_contas_receber
                (ordem_id, cliente, valor, vencimento, obs)
               VALUES ($1, $2, $3, $4, $5)`,
              [ordem.id, cliente_nome || 'Léo Madeiras',
               fr[0].valor, data,
               `Frete recebido - ${tipoVeiculo} - Rota ${numero_rota || ordem.id} - ${regiao || ''}`]
            );
          }
        }
      } catch (recErr) {
        console.error('Erro ao gerar conta a receber:', recErr.message);
      }
    }

    res.status(201).json(ordem);
  } catch (err) { next(err); }
});

// ── Atualizar status ─────────────────────────────────────
router.patch('/:id/status', async (req, res, next) => {
  try {
    const { status } = req.body;
    const valid = ['pendente','entregue','devolucao','cancelado'];
    if (!valid.includes(status)) return res.status(422).json({ error: 'Status inválido' });

    // Buscar status anterior
    const { rows: prev } = await db.query(
      'SELECT status, numero_rota, data FROM logi_ordens_transporte WHERE id=$1', [req.params.id]
    );
    if (!prev.length) return res.status(404).json({ error: 'Ordem não encontrada' });
    const statusAnterior = prev[0].status;

    // Atualizar status
    const { rows } = await db.query(
      'UPDATE logi_ordens_transporte SET status=$1,updated_at=NOW() WHERE id=$2 RETURNING *',
      [status, req.params.id]
    );

    // Registrar histórico
    await db.query(
      `INSERT INTO logi_historico_ordens (ordem_id, status_anterior, status_novo, usuario_id, usuario_nome)
       VALUES ($1,$2,$3,$4,$5)`,
      [req.params.id, statusAnterior, status, req.user?.id || null, req.user?.nome || 'sistema']
    );

    // Se cancelou → reverter financeiro (marcar como cancelado)
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

// ── Importação em massa (planilha roteirização) ──────────
// ── Checar pedidos duplicados (para preview na importação) ──
router.post('/checar-duplicados', async (req, res, next) => {
  try {
    const { pedidos } = req.body;
    if (!pedidos?.length) return res.json({ duplicados: [] });

    const placeholders = pedidos.map((_, i) => `$${i + 1}`).join(',');
    const { rows } = await db.query(
      `SELECT DISTINCT pedido FROM logi_ordens_transporte WHERE pedido IN (${placeholders})`,
      pedidos.map(String)
    );
    res.json({ duplicados: rows.map(r => r.pedido) });
  } catch (err) { next(err); }
});

// ── Helpers para importação ──────────────────────────────
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
  const { rows } = await db.query(
    `SELECT id, nome FROM logi_motoristas
     WHERE UPPER(unaccent(nome)) = UPPER(unaccent($1))
        OR UPPER(unaccent(nome)) ILIKE UPPER(unaccent($2))
     ORDER BY (UPPER(unaccent(nome)) = UPPER(unaccent($1))) DESC
     LIMIT 1`,
    [String(nome).trim(), `%${String(nome).trim()}%`]
  ).catch(async () => {
    // Fallback se extension unaccent não existir
    return await db.query(
      `SELECT id, nome FROM logi_motoristas
       WHERE UPPER(nome) = UPPER($1) OR UPPER(nome) ILIKE UPPER($2)
       ORDER BY (UPPER(nome) = UPPER($1)) DESC
       LIMIT 1`,
      [String(nome).trim(), `%${String(nome).trim()}%`]
    );
  });
  return rows[0] || null;
}

async function buscarOuCriarCliente(client, { codigo, nome, endereco }) {
  if (!nome) return null;
  // Documento sintético baseado no código local do Roteasy (idempotente)
  const documentoSintetico = codigo ? `ROTEASY-${codigo}` : null;

  if (documentoSintetico) {
    const ex = await client.query(
      'SELECT id FROM logi_clientes WHERE documento = $1 LIMIT 1',
      [documentoSintetico]
    );
    if (ex.rows.length) return ex.rows[0].id;
  }

  // Tentar match por nome exato (caso já exista cliente cadastrado manualmente)
  const exNome = await client.query(
    `SELECT id FROM logi_clientes WHERE UPPER(TRIM(nome)) = UPPER(TRIM($1)) LIMIT 1`,
    [nome]
  );
  if (exNome.rows.length) return exNome.rows[0].id;

  // Criar novo
  const ins = await client.query(
    `INSERT INTO logi_clientes (nome, tipo_doc, documento, logradouro, ativo)
     VALUES ($1, 'CNPJ', $2, $3, true)
     ON CONFLICT (documento) DO UPDATE SET nome = EXCLUDED.nome
     RETURNING id`,
    [String(nome).trim().substring(0, 200), documentoSintetico, endereco || null]
  );
  return ins.rows[0].id;
}

// ── Preview de importação ────────────────────────────────
// Recebe rotas + paradas já parseadas no frontend, faz lookups e devolve
// um relatório com alertas. NÃO persiste nada.
router.post('/importar/preview', async (req, res, next) => {
  try {
    const { data, rotas } = req.body;
    if (!data || !rotas?.length) return res.status(400).json({ error: 'Data e rotas são obrigatórios' });

    const resultado = [];
    const alertas = [];
    let totalParadas = 0;

    for (const rota of rotas) {
      const veiculo = rota.placa ? await buscarVeiculoPorPlaca(rota.placa) : null;
      const motorista = rota.operador ? await buscarMotoristaPorNome(rota.operador) : null;

      if (rota.placa && !veiculo) {
        alertas.push({ tipo: 'veiculo_nao_encontrado', valor: rota.placa, rota: rota.numero_rota });
      }
      if (rota.operador && !motorista) {
        alertas.push({ tipo: 'motorista_nao_encontrado', valor: rota.operador, rota: rota.numero_rota });
      }

      const paradas = rota.paradas || [];
      totalParadas += paradas.length;

      // Verificar remessas já importadas
      const remessas = paradas.map(p => p.remessa).filter(Boolean).map(String);
      let remessasExistentes = [];
      if (remessas.length) {
        const ph = remessas.map((_, i) => `$${i + 1}`).join(',');
        const { rows } = await db.query(
          `SELECT remessa FROM logi_ordens_transporte WHERE remessa IN (${ph})`,
          remessas
        );
        remessasExistentes = rows.map(r => String(r.remessa));
      }

      resultado.push({
        numero_rota: rota.numero_rota,
        placa: rota.placa,
        veiculo_id: veiculo?.id || null,
        veiculo_tipo: veiculo?.tipo || null,
        veiculo_ag_ft: veiculo?.ag_ft || null,
        operador: rota.operador,
        motorista_id: motorista?.id || null,
        motorista_nome: motorista?.nome || null,
        transportadora_nome: rota.transportadora || veiculo?.transportadora_nome || null,
        total_paradas: paradas.length,
        peso_total: paradas.reduce((s, p) => s + (Number(p.peso) || 0), 0),
        remessas_para_atualizar: remessas.filter(r => remessasExistentes.includes(r)).length,
        remessas_para_criar: remessas.filter(r => !remessasExistentes.includes(r)).length,
      });
    }

    res.json({
      data,
      total_rotas: rotas.length,
      total_paradas: totalParadas,
      rotas: resultado,
      alertas,
    });
  } catch (err) { next(err); }
});

// ── Importação em massa (planilha roteirização Roteasy / genérica) ──────
// Comportamento:
//   - UPSERT por remessa (atualiza se já existe, cria se não)
//   - Auto-criação de cliente em logi_clientes
//   - 1 CAP consolidado por rota (modo padrão; respeita parâmetro cap_modo_importacao)
//   - 1 CAR consolidado por rota baseado no tipo do veículo
router.post('/importar', async (req, res, next) => {
  const client = await db.pool.connect().catch(() => null);
  // Fallback se db não expõe pool — usar db.query direto (sem transação)
  const useTx = !!client;
  if (useTx) await client.query('BEGIN');

  const q = (sql, params) => useTx ? client.query(sql, params) : db.query(sql, params);

  try {
    const { data, rotas, origem = 'roteasy' } = req.body;
    if (!data || !rotas?.length) return res.status(400).json({ error: 'Data e rotas são obrigatórios' });

    // Lê modo de geração de CAP
    const { rows: modoRows } = await q(
      "SELECT valor FROM logi_parametros WHERE chave = 'cap_modo_importacao'"
    );
    const capModo = modoRows[0]?.valor || 'consolidado';

    // Valor do ajudante (parametrizado)
    let valorAjudante = 0;
    const { rows: ajRows } = await q(
      "SELECT valor FROM logi_parametros WHERE chave = 'valor_ajudante'"
    );
    if (ajRows.length) valorAjudante = parseFloat(ajRows[0].valor) || 0;

    const resumo = {
      criadas: 0,
      atualizadas: 0,
      ignoradas: 0,
      cap_gerados: 0,
      car_gerados: 0,
      rotas_processadas: 0,
    };

    for (const rota of rotas) {
      const { numero_rota, placa, operador, ajudante_nome, transportadora_nome } = rota;

      // Resolver veículo e motorista (alerta no preview já passou; aqui apenas tenta)
      const veiculo = placa ? await buscarVeiculoPorPlaca(placa) : null;
      const motorista = operador ? await buscarMotoristaPorNome(operador) : null;
      const veiculo_id = veiculo?.id || null;
      const motorista_id = motorista?.id || null;

      // Determinar grupo_viagem: reaproveitar se já existir alguma OT com as remessas
      // dessa rota (caso de reimportação), senão gerar um novo
      let grupoViagem = null;
      const remessasRota = (rota.paradas || []).map(p => p.remessa).filter(Boolean).map(String);
      if (remessasRota.length) {
        const ph = remessasRota.map((_, i) => `$${i + 1}`).join(',');
        const { rows: existentes } = await q(
          `SELECT DISTINCT grupo_viagem FROM logi_ordens_transporte
           WHERE remessa IN (${ph}) AND grupo_viagem IS NOT NULL LIMIT 1`,
          remessasRota
        );
        if (existentes.length) grupoViagem = existentes[0].grupo_viagem;
      }
      if (!grupoViagem) {
        grupoViagem = 'GV' + Date.now().toString(36).toUpperCase() + numero_rota;
      }

      const ordensDaRota = [];

      for (const parada of (rota.paradas || [])) {
        // Resolver/criar cliente
        let cliente_id = null;
        try {
          cliente_id = await buscarOuCriarCliente(useTx ? client : { query: db.query.bind(db) }, {
            codigo: parada.codigo_local,
            nome: parada.cliente_nome,
            endereco: parada.endereco,
          });
        } catch (e) {
          console.error('Erro auto-criar cliente:', e.message);
        }

        // UPSERT por remessa (se houver). Sem remessa → INSERT direto.
        let ordem;
        if (parada.remessa) {
          const { rows } = await q(
            `INSERT INTO logi_ordens_transporte
              (data, numero_rota, seq, pedido, cliente_id, cliente_nome, regiao, peso, nf, remessa, obs,
               motorista_id, veiculo_id, ajudante_nome, status, tipo, origem_importacao, grupo_viagem)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'pendente',$15,$16,$17)
             ON CONFLICT (remessa) WHERE remessa IS NOT NULL AND remessa <> ''
             DO UPDATE SET
               data = EXCLUDED.data,
               numero_rota = EXCLUDED.numero_rota,
               seq = EXCLUDED.seq,
               pedido = EXCLUDED.pedido,
               cliente_id = COALESCE(EXCLUDED.cliente_id, logi_ordens_transporte.cliente_id),
               cliente_nome = EXCLUDED.cliente_nome,
               regiao = EXCLUDED.regiao,
               peso = EXCLUDED.peso,
               obs = EXCLUDED.obs,
               motorista_id = COALESCE(EXCLUDED.motorista_id, logi_ordens_transporte.motorista_id),
               veiculo_id = COALESCE(EXCLUDED.veiculo_id, logi_ordens_transporte.veiculo_id),
               ajudante_nome = EXCLUDED.ajudante_nome,
               tipo = EXCLUDED.tipo,
               origem_importacao = EXCLUDED.origem_importacao,
               grupo_viagem = EXCLUDED.grupo_viagem,
               updated_at = NOW()
             RETURNING *, (xmax = 0) AS inserido`,
            [data, numero_rota, parada.seq || 1, parada.pedido || null,
             cliente_id, parada.cliente_nome || null, parada.regiao || rota.regiao || null,
             parada.peso || null, parada.nf || null, String(parada.remessa), parada.obs || null,
             motorista_id, veiculo_id, ajudante_nome || null,
             rota.tipo || 'INTEIRO', origem, grupoViagem]
          );
          ordem = rows[0];
          if (ordem.inserido) resumo.criadas++; else resumo.atualizadas++;
        } else {
          const { rows } = await q(
            `INSERT INTO logi_ordens_transporte
              (data, numero_rota, seq, pedido, cliente_id, cliente_nome, regiao, peso, nf, remessa, obs,
               motorista_id, veiculo_id, ajudante_nome, status, tipo, origem_importacao, grupo_viagem)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'pendente',$15,$16,$17)
             RETURNING *`,
            [data, numero_rota, parada.seq || 1, parada.pedido || null,
             cliente_id, parada.cliente_nome || null, parada.regiao || rota.regiao || null,
             parada.peso || null, parada.nf || null, null, parada.obs || null,
             motorista_id, veiculo_id, ajudante_nome || null,
             rota.tipo || 'INTEIRO', origem, grupoViagem]
          );
          ordem = rows[0];
          resumo.criadas++;
        }
        ordensDaRota.push(ordem);
      }

      resumo.rotas_processadas++;

      // ── Geração financeira (consolidada por rota) ─────────────────
      // Apenas se houver veículo identificado e ordens criadas
      if (!veiculo_id || !ordensDaRota.length) continue;

      // Limpar CAP/CAR pendentes anteriores desta rota (caso seja reimport)
      const ordemIds = ordensDaRota.map(o => o.id);
      await q(
        `UPDATE logi_contas_pagar SET status='cancelado'
         WHERE ordem_id = ANY($1::int[])
           AND status = 'pendente'
           AND descricao LIKE '%[ROTA_IMPORT]%'`,
        [ordemIds]
      );
      await q(
        `UPDATE logi_contas_receber SET status='cancelado'
         WHERE ordem_id = ANY($1::int[])
           AND status = 'pendente'
           AND obs LIKE '%[ROTA_IMPORT]%'`,
        [ordemIds]
      );

      // CAR: 1 título consolidado por rota (frete recebido)
      try {
        const { rows: fr } = await q(
          `SELECT valor FROM logi_tabela_frete_recebido
           WHERE UPPER(TRIM(tipo_veiculo)) = UPPER(TRIM($1))`,
          [veiculo.tipo || '']
        );
        if (fr.length && fr[0].valor) {
          // Ordem âncora = primeira da rota
          const ordemAncora = ordensDaRota[0];
          await q(
            `INSERT INTO logi_contas_receber (ordem_id, cliente, valor, vencimento, obs)
             VALUES ($1,$2,$3,$4,$5)`,
            [ordemAncora.id, 'Léo Madeiras', fr[0].valor, data,
             `[ROTA_IMPORT] Frete recebido - ${veiculo.tipo} - Rota ${numero_rota} (${ordensDaRota.length} entregas)`]
          );
          resumo.car_gerados++;
        }
      } catch (e) { console.error('Erro CAR consolidado:', e.message); }

      // CAP: 1 título consolidado por rota (frete pago / diária)
      if (capModo === 'consolidado') {
        try {
          // Buscar tabela de frete agregado pelo tipo de veículo (heurística)
          let valorFrete = null;
          if (veiculo.ag_ft === 'agregado') {
            const { rows: tf } = await q(
              `SELECT valor_base FROM logi_tabela_fretes
               WHERE UPPER(TRIM(tipo_veiculo)) = UPPER(TRIM($1))
               ORDER BY id DESC LIMIT 1`,
              [veiculo.tipo || '']
            ).catch(() => ({ rows: [] }));
            if (tf.length) valorFrete = parseFloat(tf[0].valor_base) || null;
          }

          const ordemAncora = ordensDaRota[0];

          if (veiculo.ag_ft === 'agregado' && valorFrete) {
            await q(
              `INSERT INTO logi_contas_pagar
                (ordem_id, transportadora_id, motorista_id, valor, vencimento, descricao, tipo_lancamento)
               VALUES ($1,$2,$3,$4,$5,$6,$7)`,
              [ordemAncora.id, veiculo.transportadora_id || null, motorista_id,
               valorFrete, data,
               `[ROTA_IMPORT] Frete agregado - ${transportadora_nome || veiculo.transportadora_nome || ''} - Rota ${numero_rota} (${ordensDaRota.length} entregas)`,
               'frete_agregado']
            );
            resumo.cap_gerados++;
          } else if (veiculo.ag_ft === 'frota' && motorista_id) {
            // Diária do motorista — também busca por tipo de veículo
            const { rows: tf } = await q(
              `SELECT valor_base FROM logi_tabela_fretes
               WHERE UPPER(TRIM(tipo_veiculo)) = UPPER(TRIM($1))
               ORDER BY id DESC LIMIT 1`,
              [veiculo.tipo || '']
            ).catch(() => ({ rows: [] }));
            const vd = tf[0]?.valor_base ? parseFloat(tf[0].valor_base) : null;
            if (vd) {
              await q(
                `INSERT INTO logi_contas_pagar
                  (ordem_id, motorista_id, valor, vencimento, descricao, tipo_lancamento)
                 VALUES ($1,$2,$3,$4,$5,$6)`,
                [ordemAncora.id, motorista_id, vd, data,
                 `[ROTA_IMPORT] Diária motorista - Rota ${numero_rota} (${ordensDaRota.length} entregas)`,
                 'diaria_motorista']
              );
              resumo.cap_gerados++;
            }
          }

          // Ajudante (1 lançamento por rota)
          if (valorAjudante > 0 && ajudante_nome) {
            await q(
              `INSERT INTO logi_contas_pagar
                (ordem_id, motorista_id, valor, vencimento, descricao, tipo_lancamento)
               VALUES ($1,$2,$3,$4,$5,$6)`,
              [ordemAncora.id, motorista_id, valorAjudante, data,
               `[ROTA_IMPORT] Ajudante - ${ajudante_nome} - Rota ${numero_rota}`,
               'diaria_ajudante']
            );
            resumo.cap_gerados++;
          }
        } catch (e) { console.error('Erro CAP consolidado:', e.message); }
      }
    }

    if (useTx) await client.query('COMMIT');
    res.status(201).json({ success: true, ...resumo });
  } catch (err) {
    if (useTx) await client.query('ROLLBACK').catch(() => {});
    next(err);
  } finally {
    if (useTx) client.release();
  }
});

// ── Editar ordem ─────────────────────────────────────────
router.put('/:id', upload.single('anexo'), async (req, res, next) => {
  try {
    const {
      cliente_id, motorista_id, veiculo_id, data, numero_rota, seq,
      saida, pedido, cliente_nome, regiao, peso, km, nf, remessa,
      tipo, pagto, ajuda_diesel, taxa_descarga, n_cont, q_capas, obs,
      ajudante_nome, km_saida, km_chegada,
    } = req.body;

    const anexo_nome = req.file ? req.file.originalname : undefined;
    const anexo_path = req.file ? req.file.filename : undefined;
    const anexo_size = req.file ? req.file.size : undefined;

    // Montar SET dinâmico (só campos enviados)
    const sets = [];
    const params = [];
    const add = (col, val) => { if (val !== undefined) { params.push(val); sets.push(`${col}=$${params.length}`); } };

    add('cliente_id', cliente_id);
    add('motorista_id', motorista_id);
    add('veiculo_id', veiculo_id);
    add('data', data);
    add('numero_rota', numero_rota);
    add('seq', seq);
    add('saida', saida);
    add('pedido', pedido);
    add('cliente_nome', cliente_nome);
    add('regiao', regiao);
    add('peso', peso || null);
    add('km', km || null);
    add('nf', nf);
    add('remessa', remessa);
    add('tipo', tipo);
    add('pagto', pagto);
    add('ajuda_diesel', ajuda_diesel || 0);
    add('taxa_descarga', taxa_descarga || 0);
    add('n_cont', n_cont);
    add('q_capas', q_capas || 0);
    add('obs', obs);
    add('ajudante_nome', ajudante_nome || null);
    add('km_saida', km_saida || null);
    add('km_chegada', km_chegada || null);
    if (anexo_nome) { add('anexo_nome', anexo_nome); add('anexo_path', anexo_path); add('anexo_tamanho', anexo_size); }

    params.push(new Date());
    sets.push(`updated_at=$${params.length}`);

    params.push(req.params.id);
    const { rows } = await db.query(
      `UPDATE logi_ordens_transporte SET ${sets.join(',')} WHERE id=$${params.length} RETURNING *`,
      params
    );
    if (!rows.length) return res.status(404).json({ error: 'Ordem não encontrada' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// ── Histórico de alterações ──────────────────────────────
router.get('/:id/historico', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT * FROM logi_historico_ordens WHERE ordem_id=$1 ORDER BY created_at DESC`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) { next(err); }
});


// ── Agrupar romaneios (viagem conjunta) ──────────────────
router.post('/agrupar', async (req, res, next) => {
  try {
    const { ordem_ids, motorista_id, veiculo_id, tabela_frete_id } = req.body;
    if (!ordem_ids || ordem_ids.length < 2) {
      return res.status(400).json({ error: 'Selecione pelo menos 2 ordens para agrupar' });
    }

    // Gerar ID do grupo (GV + timestamp curto)
    const grupoId = 'GV' + Date.now().toString(36).toUpperCase();

    // Buscar ordens para validar
    const placeholders = ordem_ids.map((_, i) => `$${i + 1}`).join(',');
    const { rows: ordens } = await db.query(
      `SELECT id, data, numero_rota, regiao, motorista_id, veiculo_id, grupo_viagem
       FROM logi_ordens_transporte WHERE id IN (${placeholders})`,
      ordem_ids
    );

    if (ordens.length !== ordem_ids.length) {
      return res.status(400).json({ error: 'Uma ou mais ordens não encontradas' });
    }

    // Verificar se alguma já está agrupada
    const jaAgrupadas = ordens.filter(o => o.grupo_viagem);
    if (jaAgrupadas.length) {
      return res.status(400).json({
        error: `Ordem(ns) ${jaAgrupadas.map(o => o.numero_rota || o.id).join(', ')} já estão agrupadas (${jaAgrupadas[0].grupo_viagem})`
      });
    }

    // Atualizar as ordens com o grupo_viagem + motorista/veículo se fornecidos
    const sets = ['grupo_viagem = $1'];
    const baseParams = [grupoId];
    
    if (motorista_id) {
      sets.push(`motorista_id = $${baseParams.length + 1}`);
      baseParams.push(motorista_id);
    }
    if (veiculo_id) {
      sets.push(`veiculo_id = $${baseParams.length + 1}`);
      baseParams.push(veiculo_id);
    }

    for (const ordemId of ordem_ids) {
      await db.query(
        `UPDATE logi_ordens_transporte SET ${sets.join(', ')}, updated_at = NOW()
         WHERE id = $${baseParams.length + 1}`,
        [...baseParams, ordemId]
      );
    }

    // Cancelar contas a pagar existentes das ordens agrupadas e gerar uma nova
    // (paga 1 frete só pro agregado)
    await db.query(
      `UPDATE logi_contas_pagar SET status = 'cancelado'
       WHERE ordem_id = ANY($1) AND status = 'pendente' AND tipo_lancamento = 'frete_agregado'`,
      [ordem_ids]
    );

    // Gerar novo lançamento único de frete agregado se tiver tabela_frete_id
    if (tabela_frete_id && veiculo_id) {
      const { rows: fr } = await db.query(
        'SELECT valor_base FROM logi_tabela_fretes WHERE id = $1', [tabela_frete_id]
      );
      if (fr.length) {
        const { rows: vrows } = await db.query(
          `SELECT v.tipo AS veiculo_tipo, t.id AS transportadora_id, t.nome AS transportadora_nome
           FROM logi_veiculos v
           LEFT JOIN logi_transportadoras t ON t.id = v.transportadora_id
           WHERE v.id = $1`, [veiculo_id]
        );
        const veiculo = vrows[0] || {};
        const rotas = ordens.map(o => o.numero_rota).filter(Boolean).join('+');
        const regioes = [...new Set(ordens.map(o => o.regiao).filter(Boolean))].join(', ');
        const dataRef = ordens[0].data;

        await db.query(
          `INSERT INTO logi_contas_pagar
            (ordem_id, tabela_frete_id, transportadora_id, motorista_id, valor, vencimento, descricao, tipo_lancamento, grupo_viagem)
           VALUES ($1, $2, $3, $4, $5, $6, $7, 'frete_agregado', $8)`,
          [
            ordem_ids[0], // referencia a primeira ordem
            tabela_frete_id,
            veiculo.transportadora_id || null,
            motorista_id || null,
            fr[0].valor_base,
            dataRef,
            `Frete agrupado (${grupoId}) - Rotas ${rotas} - ${regioes} - ${veiculo.transportadora_nome || ''}`,
            grupoId,
          ]
        );
      }
    }

    res.json({
      success: true,
      grupo_viagem: grupoId,
      ordens_agrupadas: ordem_ids.length,
    });
  } catch (err) { next(err); }
});

// ── Desagrupar romaneios ──────────────────────────────────
router.post('/desagrupar', async (req, res, next) => {
  try {
    const { grupo_viagem } = req.body;
    if (!grupo_viagem) return res.status(400).json({ error: 'grupo_viagem é obrigatório' });

    // Limpar grupo_viagem das ordens
    await db.query(
      `UPDATE logi_ordens_transporte SET grupo_viagem = NULL, updated_at = NOW()
       WHERE grupo_viagem = $1`,
      [grupo_viagem]
    );

    // Cancelar conta a pagar do grupo
    await db.query(
      `UPDATE logi_contas_pagar SET status = 'cancelado'
       WHERE grupo_viagem = $1 AND status = 'pendente'`,
      [grupo_viagem]
    );

    res.json({ success: true });
  } catch (err) { next(err); }
});


module.exports = router;
