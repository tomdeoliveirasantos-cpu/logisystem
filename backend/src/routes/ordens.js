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
    } = req.body;

    const anexo_nome  = req.file ? req.file.originalname : null;
    const anexo_path  = req.file ? req.file.filename     : null;
    const anexo_size  = req.file ? req.file.size         : null;

    const { rows } = await db.query(
      `INSERT INTO logi_ordens_transporte
        (cliente_id,motorista_id,veiculo_id,data,numero_rota,seq,saida,pedido,
         cliente_nome,regiao,peso,km,nf,remessa,status,tipo,pagto,
         ajuda_diesel,taxa_descarga,n_cont,q_capas,obs,
         anexo_nome,anexo_path,anexo_tamanho,ajudante_nome)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26)
       RETURNING *`,
      [cliente_id,motorista_id,veiculo_id,data,numero_rota,seq,saida,pedido,
       cliente_nome,regiao,peso,km,nf,remessa,status,tipo,pagto,
       ajuda_diesel,taxa_descarga,n_cont,q_capas,obs,
       anexo_nome,anexo_path,anexo_size,ajudante_nome||null]
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
    const { rows } = await db.query(
      'UPDATE logi_ordens_transporte SET status=$1,updated_at=NOW() WHERE id=$2 RETURNING *',
      [status, req.params.id]
    );
    res.json(rows[0]);
  } catch (err) { next(err); }
});

module.exports = router;
