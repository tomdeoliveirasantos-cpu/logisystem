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
router.post('/importar', async (req, res, next) => {
  try {
    const { data, rotas } = req.body;

    if (!data || !rotas?.length) return res.status(400).json({ error: 'Data e rotas são obrigatórios' });

    // Coletar todos os pedidos para checar duplicidade de uma vez
    const todosPedidos = [];
    for (const rota of rotas) {
      for (const parada of (rota.paradas || [])) {
        if (parada.pedido) todosPedidos.push(String(parada.pedido));
      }
    }

    // Buscar quais já existem no banco
    let pedidosDuplicados = [];
    if (todosPedidos.length) {
      const placeholders = todosPedidos.map((_, i) => `$${i + 1}`).join(',');
      const { rows: existentes } = await db.query(
        `SELECT DISTINCT pedido FROM logi_ordens_transporte WHERE pedido IN (${placeholders})`,
        todosPedidos
      );
      pedidosDuplicados = existentes.map(r => r.pedido);
    }

    const criadas = [];
    const ignoradas = [];

    for (const rota of rotas) {
      const { numero_rota, motorista_id, veiculo_id, ajudante_nome, tabela_frete_id } = rota;

      for (const parada of (rota.paradas || [])) {
        // Pular se pedido já existe
        if (parada.pedido && pedidosDuplicados.includes(String(parada.pedido))) {
          ignoradas.push({ pedido: parada.pedido, cliente: parada.cliente_nome, rota: numero_rota });
          continue;
        }

        const { rows } = await db.query(
          `INSERT INTO logi_ordens_transporte
            (data, numero_rota, seq, pedido, cliente_nome, regiao, peso, nf, remessa, obs,
             motorista_id, veiculo_id, ajudante_nome, status, tipo)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'pendente',$14)
           RETURNING *`,
          [data, numero_rota, parada.seq || 1, parada.pedido || null,
           parada.cliente_nome || null, parada.regiao || rota.regiao || null,
           parada.peso || null, parada.nf || null, parada.remessa || null, parada.obs || null,
           motorista_id || null, veiculo_id || null, ajudante_nome || null,
           rota.tipo || 'INTEIRO']
        );

        const ordem = rows[0];
        criadas.push(ordem);

        // Geração automática financeiro (mesma lógica do POST normal)
        if (veiculo_id) {
          // Contas a Receber (frete fixo por veículo)
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
                  `INSERT INTO logi_contas_receber (ordem_id, cliente, valor, vencimento, obs)
                   VALUES ($1, $2, $3, $4, $5)`,
                  [ordem.id, 'Léo Madeiras', fr[0].valor, data,
                   `Frete recebido - ${tipoVeiculo} - Rota ${numero_rota} - ${parada.regiao || ''}`]
                );
              }
            }
          } catch(e) { console.error('Erro receber importação:', e.message); }

          // Contas a Pagar (frete agregado)
          if (tabela_frete_id) {
            try {
              const { rows: vrows } = await db.query(
                `SELECT v.ag_ft, t.id AS transportadora_id, t.nome AS transportadora_nome
                 FROM logi_veiculos v LEFT JOIN logi_transportadoras t ON t.id = v.transportadora_id
                 WHERE v.id = $1`, [veiculo_id]
              );
              if (vrows.length && vrows[0].ag_ft === 'agregado') {
                const { rows: fr } = await db.query('SELECT valor_base FROM logi_tabela_fretes WHERE id = $1', [tabela_frete_id]);
                if (fr.length) {
                  await db.query(
                    `INSERT INTO logi_contas_pagar (ordem_id, tabela_frete_id, transportadora_id, motorista_id, valor, vencimento, descricao, tipo_lancamento)
                     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
                    [ordem.id, tabela_frete_id, vrows[0].transportadora_id, motorista_id,
                     fr[0].valor_base, data, `Frete agregado - Rota ${numero_rota}`, 'frete_agregado']
                  );
                }
              }
            } catch(e) { console.error('Erro pagar importação:', e.message); }
          }

          // Ajudante
          if (ajudante_nome) {
            try {
              const { rows: paramRows } = await db.query("SELECT valor FROM logi_parametros WHERE chave = 'valor_ajudante'");
              if (paramRows.length) {
                const valorAjudante = parseFloat(paramRows[0].valor) || 0;
                if (valorAjudante > 0) {
                  await db.query(
                    `INSERT INTO logi_contas_pagar (ordem_id, motorista_id, valor, vencimento, descricao, tipo_lancamento)
                     VALUES ($1,$2,$3,$4,$5,$6)`,
                    [ordem.id, motorista_id, valorAjudante, data,
                     `Ajudante - ${ajudante_nome} - Rota ${numero_rota}`, 'diaria_ajudante']
                  );
                }
              }
            } catch(e) { console.error('Erro ajudante importação:', e.message); }
          }
        }
      }
    }

    res.status(201).json({ success: true, total: criadas.length, ignoradas: ignoradas.length, duplicados: ignoradas, ordens: criadas });
  } catch (err) { next(err); }
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

module.exports = router;
