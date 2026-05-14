// ── motoristas.js ─────────────────────────────────────────────
const express = require('express');
const multer  = require('multer');
const bcrypt  = require('bcryptjs');
const path    = require('path');
const fs      = require('fs');
const db = require('../db');

const motoristasRouter = express.Router();

// Upload de CNH
const MOT_UPLOADS_DIR = path.join(__dirname, '../../uploads/motoristas');
if (!fs.existsSync(MOT_UPLOADS_DIR)) fs.mkdirSync(MOT_UPLOADS_DIR, { recursive: true });

const motStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, MOT_UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ts = Date.now();
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${ts}_${safe}`);
  },
});
const motUpload = multer({
  storage: motStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = ['.pdf','.jpg','.jpeg','.png'];
    cb(null, ok.includes(path.extname(file.originalname).toLowerCase()));
  },
});

// Cadastro completo (admin) — múltiplos arquivos
const motUploadFields = motUpload.fields([
  { name: 'cnh_arquivo',          maxCount: 1 },
  { name: 'cnpj_arquivo',         maxCount: 1 },
  { name: 'comprovante_endereco', maxCount: 1 },
  { name: 'contrato_social',      maxCount: 1 },
]);

// Helper: extrai nome/path de um arquivo enviado via upload.fields
const fileInfo = (req, field) => {
  const f = req.files && req.files[field] && req.files[field][0];
  return f ? { nome: f.originalname, path: f.filename } : { nome: null, path: null };
};

motoristasRouter.get('/', async (req, res, next) => {
  try {
    const { status_cadastro, tipo_colaborador } = req.query;
    const params = [];
    const where = ['mo.ativo = true'];
    if (status_cadastro) { params.push(status_cadastro); where.push(`mo.status_cadastro = $${params.length}`); }
    if (tipo_colaborador) {
      // aceita CSV: ?tipo_colaborador=motorista_proprio,motorista_terceiro
      const tipos = String(tipo_colaborador).split(',').map(s => s.trim()).filter(Boolean);
      if (tipos.length) {
        const start = params.length;
        tipos.forEach(t => params.push(t));
        const placeholders = tipos.map((_, i) => `$${start + i + 1}`).join(',');
        where.push(`mo.tipo_colaborador IN (${placeholders})`);
      }
    }
    const { rows } = await db.query(
      `SELECT mo.*, t.nome AS transportadora_nome,
              v.placa AS veiculo_padrao_placa, v.tipo AS veiculo_padrao_tipo
       FROM logi_motoristas mo
       LEFT JOIN logi_transportadoras t ON t.id = mo.transportadora_id
       LEFT JOIN logi_veiculos v ON v.id = mo.veiculo_padrao_id
       WHERE ${where.join(' AND ')} ORDER BY mo.nome`, params
    );
    res.json(rows);
  } catch (err) { next(err); }
});

motoristasRouter.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT mo.*, t.nome AS transportadora_nome
       FROM logi_motoristas mo
       LEFT JOIN logi_transportadoras t ON t.id = mo.transportadora_id
       WHERE mo.id = $1`, [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Não encontrado' });
    const { senha_hash, ...rest } = rows[0];
    res.json({ ...rest, tem_senha: !!senha_hash });
  } catch (err) { next(err); }
});

// Cadastro completo (admin)
motoristasRouter.post('/', motUploadFields, async (req, res, next) => {
  try {
    const {
      transportadora_id, nome, cnh, telefone, veiculo_padrao_id,
      cnh_validade, cnh_categoria,
      endereco_cep, endereco_logradouro, endereco_numero, endereco_complemento,
      endereco_bairro, endereco_cidade, endereco_estado,
      contato_esposa, contato_pai, contato_mae, contato_outro_nome, contato_outro_telefone,
      status_cadastro = 'completo',
      tipo_colaborador = 'pendente',
      dono_veiculo, data_admissao, cnpj,
    } = req.body;

    const cnh_doc  = fileInfo(req, 'cnh_arquivo');
    const cnpj_doc = fileInfo(req, 'cnpj_arquivo');
    const comp_doc = fileInfo(req, 'comprovante_endereco');
    const ctr_doc  = fileInfo(req, 'contrato_social');

    const { rows } = await db.query(
      `INSERT INTO logi_motoristas
        (transportadora_id, nome, cnh, telefone, veiculo_padrao_id,
         cnh_validade, cnh_categoria, cnh_arquivo_nome, cnh_arquivo_path,
         endereco_cep, endereco_logradouro, endereco_numero, endereco_complemento,
         endereco_bairro, endereco_cidade, endereco_estado,
         contato_esposa, contato_pai, contato_mae, contato_outro_nome, contato_outro_telefone,
         status_cadastro, tipo_colaborador, dono_veiculo,
         data_admissao, cnpj,
         cnpj_arquivo_nome, cnpj_arquivo_path,
         comprovante_endereco_nome, comprovante_endereco_path,
         contrato_social_nome, contrato_social_path)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32)
       RETURNING *`,
      [transportadora_id||null, nome, cnh||null, telefone||null, veiculo_padrao_id || null,
       cnh_validade||null, cnh_categoria||null, cnh_doc.nome, cnh_doc.path,
       endereco_cep||null, endereco_logradouro||null, endereco_numero||null, endereco_complemento||null,
       endereco_bairro||null, endereco_cidade||null, endereco_estado||null,
       contato_esposa||null, contato_pai||null, contato_mae||null,
       contato_outro_nome||null, contato_outro_telefone||null,
       status_cadastro, tipo_colaborador, dono_veiculo||null,
       data_admissao||null, cnpj||null,
       cnpj_doc.nome, cnpj_doc.path,
       comp_doc.nome, comp_doc.path,
       ctr_doc.nome,  ctr_doc.path]
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

// Pré-cadastro rápido (Supervisor)
motoristasRouter.post('/pre-cadastro', async (req, res, next) => {
  try {
    const { nome, cnh, telefone, transportadora_id, tipo_colaborador = 'pendente' } = req.body;
    if (!nome) return res.status(400).json({ error: 'nome é obrigatório' });
    const { rows } = await db.query(
      `INSERT INTO logi_motoristas (nome, cnh, telefone, transportadora_id, status_cadastro, tipo_colaborador)
       VALUES ($1,$2,$3,$4,'pendente_admin',$5) RETURNING *`,
      [nome, cnh||null, telefone||null, transportadora_id||null, tipo_colaborador]
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

motoristasRouter.put('/:id', motUploadFields, async (req, res, next) => {
  try {
    const sets = [];
    const params = [];
    const add = (col, val) => {
      if (val !== undefined) { params.push(val); sets.push(`${col}=$${params.length}`); }
    };
    const b = req.body;
    add('transportadora_id', b.transportadora_id);
    add('nome', b.nome);
    add('cnh', b.cnh);
    add('telefone', b.telefone);
    add('veiculo_padrao_id', b.veiculo_padrao_id);
    add('cnh_validade', b.cnh_validade);
    add('cnh_categoria', b.cnh_categoria);
    add('endereco_cep', b.endereco_cep);
    add('endereco_logradouro', b.endereco_logradouro);
    add('endereco_numero', b.endereco_numero);
    add('endereco_complemento', b.endereco_complemento);
    add('endereco_bairro', b.endereco_bairro);
    add('endereco_cidade', b.endereco_cidade);
    add('endereco_estado', b.endereco_estado);
    add('contato_esposa', b.contato_esposa);
    add('contato_pai', b.contato_pai);
    add('contato_mae', b.contato_mae);
    add('contato_outro_nome', b.contato_outro_nome);
    add('contato_outro_telefone', b.contato_outro_telefone);
    add('status_cadastro', b.status_cadastro);
    add('tipo_colaborador', b.tipo_colaborador);
    add('dono_veiculo', b.dono_veiculo);
    add('data_admissao', b.data_admissao);
    add('cnpj', b.cnpj);

    // Uploads opcionais (somente sobrescreve se o arquivo foi enviado)
    const cnh_doc  = fileInfo(req, 'cnh_arquivo');
    if (cnh_doc.path)  { add('cnh_arquivo_nome', cnh_doc.nome);          add('cnh_arquivo_path', cnh_doc.path); }
    const cnpj_doc = fileInfo(req, 'cnpj_arquivo');
    if (cnpj_doc.path) { add('cnpj_arquivo_nome', cnpj_doc.nome);        add('cnpj_arquivo_path', cnpj_doc.path); }
    const comp_doc = fileInfo(req, 'comprovante_endereco');
    if (comp_doc.path) { add('comprovante_endereco_nome', comp_doc.nome); add('comprovante_endereco_path', comp_doc.path); }
    const ctr_doc  = fileInfo(req, 'contrato_social');
    if (ctr_doc.path)  { add('contrato_social_nome', ctr_doc.nome);       add('contrato_social_path', ctr_doc.path); }

    if (!sets.length) return res.status(400).json({ error: 'Nada a atualizar' });

    params.push(req.params.id);
    const { rows } = await db.query(
      `UPDATE logi_motoristas SET ${sets.join(',')} WHERE id=$${params.length} RETURNING *`,
      params
    );
    if (!rows.length) return res.status(404).json({ error: 'Não encontrado' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// Download CNH
motoristasRouter.get('/:id/cnh', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      'SELECT cnh_arquivo_path, cnh_arquivo_nome FROM logi_motoristas WHERE id=$1', [req.params.id]
    );
    if (!rows.length || !rows[0].cnh_arquivo_path) {
      return res.status(404).json({ error: 'CNH não encontrada' });
    }
    const filePath = path.join(MOT_UPLOADS_DIR, rows[0].cnh_arquivo_path);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Arquivo não encontrado' });
    res.download(filePath, rows[0].cnh_arquivo_nome);
  } catch (err) { next(err); }
});

// Helper: serve um arquivo armazenado no motorista
function serveDoc(colPath, colNome, errMsg) {
  return async (req, res, next) => {
    try {
      const { rows } = await db.query(
        `SELECT ${colPath} AS p, ${colNome} AS n FROM logi_motoristas WHERE id=$1`, [req.params.id]
      );
      if (!rows.length || !rows[0].p) return res.status(404).json({ error: errMsg });
      const filePath = path.join(MOT_UPLOADS_DIR, rows[0].p);
      if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Arquivo não encontrado no disco' });
      res.download(filePath, rows[0].n);
    } catch (err) { next(err); }
  };
}
motoristasRouter.get('/:id/comprovante-endereco', serveDoc('comprovante_endereco_path', 'comprovante_endereco_nome', 'Comprovante de endereço não encontrado'));
motoristasRouter.get('/:id/cnpj-arquivo',         serveDoc('cnpj_arquivo_path',         'cnpj_arquivo_nome',         'Cartão CNPJ não encontrado'));
motoristasRouter.get('/:id/contrato-social',      serveDoc('contrato_social_path',      'contrato_social_nome',      'Contrato social não encontrado'));

// POST /motoristas/:id/definir-senha — admin define/reseta senha
// body: { senha } (default = últimos 6 dígitos do CPF se omitido)
motoristasRouter.post('/:id/definir-senha', async (req, res, next) => {
  try {
    const { senha } = req.body || {};
    const { rows: ms } = await db.query(
      `SELECT id, cpf, senha_hash FROM logi_motoristas WHERE id = $1`, [req.params.id]
    );
    if (!ms.length) return res.status(404).json({ error: 'Motorista não encontrado' });
    const mot = ms[0];

    let senhaFinal = senha;
    if (!senhaFinal) {
      if (!mot.cpf) return res.status(422).json({ error: 'Motorista sem CPF cadastrado. Preencha o CPF antes ou envie uma senha no body.' });
      const cpfDigits = String(mot.cpf).replace(/\D/g, '');
      if (cpfDigits.length < 6) return res.status(422).json({ error: 'CPF inválido' });
      senhaFinal = cpfDigits.slice(-6);
    }
    if (String(senhaFinal).length < 4) {
      return res.status(422).json({ error: 'Senha precisa ter no mínimo 4 caracteres' });
    }

    const hash = await bcrypt.hash(String(senhaFinal), 10);
    await db.query(
      `UPDATE logi_motoristas SET senha_hash = $1, senha_resetada = true WHERE id = $2`,
      [hash, req.params.id]
    );
    res.json({
      success: true,
      senha_temporaria: senha ? null : senhaFinal,
      mensagem: senha ? 'Senha definida com sucesso' : `Senha temporária: ${senhaFinal} (motorista deve trocar no 1º acesso)`,
    });
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
      `SELECT m.*, v.placa, v.modelo, v.tipo AS veiculo_tipo,
              f.nome AS fornecedor_nome
       FROM logi_manutencoes m
       JOIN logi_veiculos v ON v.id = m.veiculo_id
       LEFT JOIN logi_fornecedores f ON f.id = m.fornecedor_id
       ${wc} ORDER BY m.data_manutencao DESC`, params
    );
    res.json(rows);
  } catch (err) { next(err); }
});

manutencoesRouter.post('/', upload.single('orcamento_anexo'), async (req, res, next) => {
  try {
    const { veiculo_id, tipo_manutencao, componente, descricao,
            valor_orcamento, aprovado_por, data_manutencao, data_vencimento, fornecedor_id } = req.body;
    const orcamento_anexo = req.file ? `manutencoes/${req.file.filename}` : null;
    const { rows } = await db.query(
      `INSERT INTO logi_manutencoes
        (veiculo_id, tipo_manutencao, componente, descricao,
         valor_orcamento, aprovado_por, data_manutencao, data_vencimento,
         fornecedor_id, orcamento_anexo)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [veiculo_id, tipo_manutencao, componente, descricao,
       valor_orcamento, aprovado_por, data_manutencao || new Date(), data_vencimento || null,
       fornecedor_id || null, orcamento_anexo]
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
