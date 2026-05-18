// backend/src/routes/motorista-app.js
// Rotas autenticadas para o app mobile do motorista (rotas em /api/motorista-app/*)
const express = require('express');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const db = require('../db');
const { SECRET } = require('../middleware/auth');

const router = express.Router();

// ─── Middleware: autentica como motorista (token tem tipo='motorista') ───
// Após executar, popula req.motorista E req.organizacao_id (vindos do JWT)
function authMotorista(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token não fornecido' });
  }
  try {
    const token = auth.split(' ')[1];
    const payload = jwt.verify(token, SECRET);
    if (payload.tipo !== 'motorista') {
      return res.status(403).json({ error: 'Token não pertence a um motorista' });
    }
    if (!payload.organizacao_id) {
      return res.status(401).json({ error: 'Token sem organização — refaça o login' });
    }
    req.motorista = payload;
    req.organizacao_id = payload.organizacao_id;
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido ou expirado' });
  }
}

// ─── Upload de fotos/assinaturas de entrega ───
const ENTREGAS_DIR = path.join(__dirname, '../../uploads/entregas');
if (!fs.existsSync(ENTREGAS_DIR)) fs.mkdirSync(ENTREGAS_DIR, { recursive: true });

const entregaStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, ENTREGAS_DIR),
  filename: (req, file, cb) => {
    const ts = Date.now();
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${req.params.id}_${ts}_${safe}`);
  },
});
const entregaUpload = multer({
  storage: entregaStorage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = ['.jpg','.jpeg','.png','.webp'];
    cb(null, ok.includes(path.extname(file.originalname).toLowerCase()));
  },
}).single('foto');

// ─── Helper: salva data URI base64 como PNG ───
function salvarDataUriPng(dataUri, paradaId, kind = 'assinatura') {
  if (!dataUri || !dataUri.startsWith('data:image/')) return null;
  const match = dataUri.match(/^data:image\/(\w+);base64,(.+)$/);
  if (!match) return null;
  const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
  const buf = Buffer.from(match[2], 'base64');
  if (buf.length > 2 * 1024 * 1024) return null; // 2MB
  const filename = `${paradaId}_${Date.now()}_${kind}.${ext}`;
  fs.writeFileSync(path.join(ENTREGAS_DIR, filename), buf);
  return filename;
}

// ─── Helper: recalcular progresso da OT (mesma lógica do ordens.js) ───
async function calcularProgressoOT(client, ordemId, organizacaoId) {
  const { rows } = await client.query(
    `SELECT p.status, COUNT(*)::int AS qtd
       FROM logi_ordem_paradas p
       JOIN logi_ordens_transporte o ON o.id = p.ordem_id AND o.organizacao_id = p.organizacao_id
      WHERE p.ordem_id = $1 AND p.organizacao_id = $2
      GROUP BY p.status`, [ordemId, organizacaoId]
  );
  if (!rows.length) return { total: 0, contagens: {}, percentual: 0, status_calculado: null };
  const contagens = { pendente: 0, entregue: 0, nao_entregue: 0, reentrega: 0, cancelada: 0 };
  rows.forEach(r => { contagens[r.status] = r.qtd; });
  const total = Object.values(contagens).reduce((a,b) => a+b, 0);
  const resolvidas = total - contagens.pendente;
  const percentual = total ? Math.round((resolvidas / total) * 100) : 0;
  let status_calculado;
  if (contagens.pendente === total) status_calculado = 'aguardando_inicio';
  else if (resolvidas === total)    status_calculado = 'finalizada';
  else                              status_calculado = 'em_andamento';
  return { total, contagens, resolvidas, percentual, status_calculado };
}

// ════════════════════════════════════════════════════════════════════════
// POST /api/motorista-app/login — body: { cpf, senha }
// Inclui organizacao_id no JWT (vem do logi_motoristas.organizacao_id)
// ════════════════════════════════════════════════════════════════════════
router.post('/login', async (req, res, next) => {
  try {
    const { cpf, senha } = req.body;
    if (!cpf || !senha) return res.status(422).json({ error: 'CPF e senha obrigatórios' });

    // Normaliza CPF (só dígitos)
    const cpfClean = String(cpf).replace(/\D/g, '');
    if (cpfClean.length !== 11) return res.status(422).json({ error: 'CPF inválido' });

    // Agora pode haver múltiplos motoristas com mesmo CPF em orgs diferentes.
    // Tentamos cada um e desambiguamos pela senha que confere.
    const { rows } = await db.query(
      `SELECT id, nome, cpf, senha_hash, senha_resetada, ativo, organizacao_id
         FROM logi_motoristas
        WHERE cpf = $1 AND ativo = true`, [cpfClean]
    );
    if (!rows.length) return res.status(401).json({ error: 'CPF ou senha incorretos' });

    let mot = null;
    for (const m of rows) {
      if (m.senha_hash && await bcrypt.compare(senha, m.senha_hash)) {
        mot = m;
        break;
      }
    }
    if (!mot) return res.status(401).json({ error: 'CPF ou senha incorretos' });
    if (!mot.organizacao_id) return res.status(401).json({ error: 'Motorista sem organização — contate o despachante' });

    await db.query('UPDATE logi_motoristas SET ultimo_login = NOW() WHERE id = $1', [mot.id]);

    const token = jwt.sign(
      { id: mot.id, nome: mot.nome, tipo: 'motorista', organizacao_id: mot.organizacao_id },
      SECRET,
      { expiresIn: '12h' }
    );

    res.json({
      token,
      motorista: { id: mot.id, nome: mot.nome, senha_resetada: mot.senha_resetada },
    });
  } catch (err) { next(err); }
});

// ════════════════════════════════════════════════════════════════════════
// GET /api/motorista-app/me — info do motorista logado
// ════════════════════════════════════════════════════════════════════════
router.get('/me', authMotorista, async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT id, nome, telefone, senha_resetada FROM logi_motoristas
        WHERE id = $1 AND organizacao_id = $2`,
      [req.motorista.id, req.organizacao_id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Motorista não encontrado' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// ════════════════════════════════════════════════════════════════════════
// POST /api/motorista-app/trocar-senha — body: { senha_atual, senha_nova }
// ════════════════════════════════════════════════════════════════════════
router.post('/trocar-senha', authMotorista, async (req, res, next) => {
  try {
    const { senha_atual, senha_nova } = req.body;
    if (!senha_atual || !senha_nova) return res.status(422).json({ error: 'Informe a senha atual e a nova' });
    if (String(senha_nova).length < 4) return res.status(422).json({ error: 'A nova senha precisa ter no mínimo 4 caracteres' });

    const { rows } = await db.query(
      `SELECT senha_hash FROM logi_motoristas WHERE id=$1 AND organizacao_id=$2`,
      [req.motorista.id, req.organizacao_id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Motorista não encontrado' });

    const ok = await bcrypt.compare(senha_atual, rows[0].senha_hash);
    if (!ok) return res.status(401).json({ error: 'Senha atual incorreta' });

    const novoHash = await bcrypt.hash(senha_nova, 10);
    await db.query(
      `UPDATE logi_motoristas SET senha_hash=$1, senha_resetada=false WHERE id=$2 AND organizacao_id=$3`,
      [novoHash, req.motorista.id, req.organizacao_id]
    );

    res.json({ success: true });
  } catch (err) { next(err); }
});

// ════════════════════════════════════════════════════════════════════════
// GET /api/motorista-app/minhas-ots — OTs do dia do motorista logado
// ════════════════════════════════════════════════════════════════════════
router.get('/minhas-ots', authMotorista, async (req, res, next) => {
  try {
    // Default: hoje. Permite ?data=YYYY-MM-DD para ver outros dias.
    const data = req.query.data || new Date().toISOString().slice(0, 10);

    const { rows: ots } = await db.query(
      `SELECT o.id, o.numero_rota, o.data, o.status, o.tipo_frota,
              v.placa, v.tipo AS veiculo_tipo,
              c.nome AS cliente_nome,
              (SELECT COUNT(*)::int FROM logi_ordem_paradas p WHERE p.ordem_id = o.id) AS qt_paradas,
              (SELECT COUNT(*)::int FROM logi_ordem_paradas p WHERE p.ordem_id = o.id AND p.status='entregue')     AS qt_entregues,
              (SELECT COUNT(*)::int FROM logi_ordem_paradas p WHERE p.ordem_id = o.id AND p.status='nao_entregue') AS qt_nao_entregues,
              (SELECT COUNT(*)::int FROM logi_ordem_paradas p WHERE p.ordem_id = o.id AND p.status='reentrega')    AS qt_reentregas
         FROM logi_ordens_transporte o
         LEFT JOIN logi_veiculos v ON v.id = o.veiculo_id AND v.organizacao_id = o.organizacao_id
         LEFT JOIN logi_clientes c ON c.id = o.cliente_id AND c.organizacao_id = o.organizacao_id
        WHERE o.motorista_id = $1
          AND o.data = $2
          AND o.organizacao_id = $3
        ORDER BY o.numero_rota`,
      [req.motorista.id, data, req.organizacao_id]
    );

    res.json({ data, ots });
  } catch (err) { next(err); }
});

// ════════════════════════════════════════════════════════════════════════
// GET /api/motorista-app/ot/:id — detalhe de uma OT com suas paradas
// ════════════════════════════════════════════════════════════════════════
router.get('/ot/:id', authMotorista, async (req, res, next) => {
  try {
    const { rows: ots } = await db.query(
      `SELECT o.*, v.placa, v.tipo AS veiculo_tipo, c.nome AS cliente_nome
         FROM logi_ordens_transporte o
         LEFT JOIN logi_veiculos v ON v.id = o.veiculo_id AND v.organizacao_id = o.organizacao_id
         LEFT JOIN logi_clientes c ON c.id = o.cliente_id AND c.organizacao_id = o.organizacao_id
        WHERE o.id = $1 AND o.motorista_id = $2 AND o.organizacao_id = $3`,
      [req.params.id, req.motorista.id, req.organizacao_id]
    );
    if (!ots.length) return res.status(404).json({ error: 'OT não encontrada' });

    const { rows: paradas } = await db.query(
      `SELECT * FROM logi_ordem_paradas WHERE ordem_id = $1 AND organizacao_id = $2 ORDER BY seq`,
      [req.params.id, req.organizacao_id]
    );

    res.json({ ot: ots[0], paradas });
  } catch (err) { next(err); }
});

// ════════════════════════════════════════════════════════════════════════
// PATCH /api/motorista-app/paradas/:id/status
// ════════════════════════════════════════════════════════════════════════
router.patch('/paradas/:id/status', authMotorista, (req, res, next) => {
  entregaUpload(req, res, async (uploadErr) => {
    if (uploadErr) return res.status(400).json({ error: 'Falha no upload da foto: ' + uploadErr.message });

    const client = await db.pool.connect();
    try {
      const STATUS_VALIDOS = ['pendente','entregue','nao_entregue','reentrega','cancelada'];
      const { status, motivo_nao_entrega, observacao, nome_recebedor,
              latitude, longitude, assinatura_b64 } = req.body;

      if (!STATUS_VALIDOS.includes(status)) {
        return res.status(400).json({ error: 'Status inválido' });
      }

      await client.query('BEGIN');

      // Garante que a parada pertence a uma OT do motorista logado E da org dele
      const own = await client.query(
        `SELECT p.id, p.ordem_id, o.motorista_id
           FROM logi_ordem_paradas p
           JOIN logi_ordens_transporte o ON o.id = p.ordem_id AND o.organizacao_id = p.organizacao_id
          WHERE p.id = $1 AND p.organizacao_id = $2`,
        [req.params.id, req.organizacao_id]
      );
      if (!own.rows.length) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Parada não encontrada' });
      }
      if (own.rows[0].motorista_id !== req.motorista.id) {
        await client.query('ROLLBACK');
        return res.status(403).json({ error: 'Esta entrega não pertence a você' });
      }

      // Foto e assinatura
      const fotoPath = req.file ? req.file.filename : null;
      const fotoNome = req.file ? req.file.originalname : null;
      const assPath  = assinatura_b64 ? salvarDataUriPng(assinatura_b64, req.params.id, 'assinatura') : null;

      // Update (com filtro de org de defesa)
      const upd = await client.query(
        `UPDATE logi_ordem_paradas
            SET status = $1,
                motivo_nao_entrega = $2,
                observacao = $3,
                nome_recebedor = $4,
                latitude = COALESCE($5::numeric, latitude),
                longitude = COALESCE($6::numeric, longitude),
                foto_path = COALESCE($7, foto_path),
                foto_nome = COALESCE($8, foto_nome),
                assinatura_path = COALESCE($9, assinatura_path),
                marcado_por = $10,
                data_tentativa = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
          WHERE id = $11 AND organizacao_id = $12
          RETURNING *`,
        [status, motivo_nao_entrega || null, observacao || null, nome_recebedor || null,
         latitude || null, longitude || null,
         fotoPath, fotoNome, assPath,
         `motorista:${req.motorista.id}`,
         req.params.id, req.organizacao_id]
      );

      const parada = upd.rows[0];
      const progresso = await calcularProgressoOT(client, parada.ordem_id, req.organizacao_id);

      await client.query('COMMIT');
      res.json({ parada, progresso });
    } catch (err) {
      await client.query('ROLLBACK').catch(()=>{});
      next(err);
    } finally { client.release(); }
  });
});

// ════════════════════════════════════════════════════════════════════════
// GET /api/motorista-app/paradas/:id/foto — serve a foto salva
// ════════════════════════════════════════════════════════════════════════
router.get('/paradas/:id/foto', authMotorista, async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT p.foto_path, p.foto_nome, o.motorista_id
         FROM logi_ordem_paradas p
         JOIN logi_ordens_transporte o ON o.id = p.ordem_id AND o.organizacao_id = p.organizacao_id
        WHERE p.id = $1 AND p.organizacao_id = $2`,
      [req.params.id, req.organizacao_id]
    );
    if (!rows.length || !rows[0].foto_path) return res.status(404).json({ error: 'Foto não encontrada' });
    if (rows[0].motorista_id !== req.motorista.id) return res.status(403).json({ error: 'Sem permissão' });
    const filePath = path.join(ENTREGAS_DIR, rows[0].foto_path);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Arquivo não encontrado no disco' });
    res.sendFile(filePath);
  } catch (err) { next(err); }
});

module.exports = router;
