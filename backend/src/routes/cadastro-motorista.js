const express = require('express');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const db = require('../db');

// ══════════════════════════════════════════════════════
// ROUTER PÚBLICO — formulário do motorista (sem auth)
//
// O escopo de organização é determinado pelo CONVITE
// (cada convite carrega organizacao_id e é descoberto pelo token na URL).
// ══════════════════════════════════════════════════════
const publicRouter = express.Router();

// ── Configuração Multer para uploads de documentos ──
const uploadsDir = path.join(__dirname, '../../uploads/motoristas');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(uploadsDir, req.params.token);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const prefix = file.fieldname;
    cb(null, `${prefix}_${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.jpg', '.jpeg', '.png', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Tipo de arquivo não permitido. Use PDF, JPG, PNG ou WebP.'));
  },
});

const docFields = upload.fields([
  { name: 'cnh', maxCount: 1 },
  { name: 'cnpj_contrato_social', maxCount: 1 },
  { name: 'rntrc', maxCount: 1 },
  { name: 'comprovante_endereco', maxCount: 1 },
  { name: 'assinatura', maxCount: 1 },
]);

// GET /api/cadastro-motorista/:token — Verificar convite
publicRouter.get('/:token', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT cc.id, cc.token, cc.status, cc.nome_motorista, cc.expires_at,
              cc.organizacao_id, o.nome AS organizacao_nome
       FROM logi_cadastro_convites cc
       LEFT JOIN logi_organizacoes o ON o.id = cc.organizacao_id
       WHERE cc.token = $1`,
      [req.params.token]
    );
    if (!rows.length) return res.status(404).json({ error: 'Convite não encontrado' });
    const convite = rows[0];
    if (convite.status === 'preenchido') return res.status(400).json({ error: 'Este formulário já foi preenchido' });
    if (convite.expires_at && new Date(convite.expires_at) < new Date()) return res.status(400).json({ error: 'Este convite expirou' });
    res.json({
      valid: true,
      nome_motorista: convite.nome_motorista,
      organizacao_nome: convite.organizacao_nome,
    });
  } catch (err) { next(err); }
});

// POST /api/cadastro-motorista/:token — Enviar formulário completo
publicRouter.post('/:token', docFields, async (req, res, next) => {
  try {
    const { rows: convites } = await db.query(
      `SELECT id, status, expires_at, organizacao_id FROM logi_cadastro_convites WHERE token = $1`,
      [req.params.token]
    );
    if (!convites.length) return res.status(404).json({ error: 'Convite não encontrado' });
    if (convites[0].status === 'preenchido') return res.status(400).json({ error: 'Já preenchido' });
    if (convites[0].expires_at && new Date(convites[0].expires_at) < new Date()) return res.status(400).json({ error: 'Convite expirado' });

    const conviteId = convites[0].id;
    const organizacaoId = convites[0].organizacao_id;
    if (!organizacaoId) {
      return res.status(500).json({ error: 'Convite sem organização vinculada — contate o suporte.' });
    }

    const data = JSON.parse(req.body.dados || '{}');

    const arquivos = {};
    for (const campo of ['cnh', 'cnpj_contrato_social', 'rntrc', 'comprovante_endereco', 'assinatura']) {
      if (req.files && req.files[campo] && req.files[campo][0]) {
        arquivos[campo] = `/uploads/motoristas/${req.params.token}/${req.files[campo][0].filename}`;
      }
    }

    const { rows: cadastro } = await db.query(
      `INSERT INTO logi_motorista_cadastros (
        convite_id,
        nome, cpf, rg, cnh_numero, cnh_categoria, cnh_validade,
        endereco, bairro, cidade, estado, cep, telefone, email,
        razao_social, cnpj, endereco_pj, bairro_pj, cidade_pj, estado_pj, cep_pj, data_abertura,
        veiculo_placa, veiculo_modelo, veiculo_ano, veiculo_rntrc,
        banco, agencia, conta, tipo_conta, pix,
        doc_cnh, doc_cnpj_contrato, doc_rntrc, doc_comprovante_endereco,
        assinatura_path, assinatura_ip, status, organizacao_id
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,
        $15,$16,$17,$18,$19,$20,$21,$22,
        $23,$24,$25,$26,$27,$28,$29,$30,$31,
        $32,$33,$34,$35,$36,$37,'pendente',$38
      ) RETURNING *`,
      [
        conviteId,
        data.nome, data.cpf, data.rg, data.cnh_numero, data.cnh_categoria, data.cnh_validade || null,
        data.endereco, data.bairro, data.cidade, data.estado, data.cep, data.telefone, data.email,
        data.razao_social, data.cnpj, data.endereco_pj, data.bairro_pj, data.cidade_pj, data.estado_pj, data.cep_pj, data.data_abertura || null,
        data.veiculo_placa, data.veiculo_modelo, data.veiculo_ano, data.veiculo_rntrc,
        data.banco, data.agencia, data.conta, data.tipo_conta, data.pix,
        arquivos.cnh || null, arquivos.cnpj_contrato_social || null, arquivos.rntrc || null, arquivos.comprovante_endereco || null,
        arquivos.assinatura || null, req.headers['x-forwarded-for'] || req.ip,
        organizacaoId,
      ]
    );

    await db.query(
      `UPDATE logi_cadastro_convites SET status = 'preenchido', preenchido_em = NOW() WHERE id = $1`,
      [conviteId]
    );

    res.status(201).json({ success: true, id: cadastro[0].id });
  } catch (err) { next(err); }
});

// ══════════════════════════════════════════════════════
// ROUTER PROTEGIDO — gestão interna
// requireTenant aplicado no server.js → req.organizacao_id disponível
// ══════════════════════════════════════════════════════
const adminRouter = express.Router();

// GET / — Listar cadastros da org
adminRouter.get('/', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT mc.*, cc.token, cc.nome_motorista AS convite_nome
       FROM logi_motorista_cadastros mc
       JOIN logi_cadastro_convites cc ON cc.id = mc.convite_id AND cc.organizacao_id = mc.organizacao_id
       WHERE mc.organizacao_id = $1
       ORDER BY mc.created_at DESC`,
      [req.organizacao_id]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// GET /convites/todos — Listar convites da org
adminRouter.get('/convites/todos', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT * FROM logi_cadastro_convites
       WHERE organizacao_id = $1
       ORDER BY created_at DESC`,
      [req.organizacao_id]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// POST /convites/gerar — Gerar novo convite vinculado à org ativa
adminRouter.post('/convites/gerar', async (req, res, next) => {
  try {
    const { nome_motorista } = req.body;
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    const { rows } = await db.query(
      `INSERT INTO logi_cadastro_convites (token, nome_motorista, criado_por, expires_at, organizacao_id)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [token, nome_motorista || null, req.user?.nome || 'sistema', expiresAt, req.organizacao_id]
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

// GET /:id — Detalhe de um cadastro
adminRouter.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT mc.*, cc.token
       FROM logi_motorista_cadastros mc
       JOIN logi_cadastro_convites cc ON cc.id = mc.convite_id AND cc.organizacao_id = mc.organizacao_id
       WHERE mc.id = $1 AND mc.organizacao_id = $2`,
      [req.params.id, req.organizacao_id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Cadastro não encontrado' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// PATCH /:id/validar — Checklist de documentos
adminRouter.patch('/:id/validar', async (req, res, next) => {
  try {
    const { check_cnh, check_cnpj, check_rntrc, check_endereco, status } = req.body;
    const { rows } = await db.query(
      `UPDATE logi_motorista_cadastros SET
        check_cnh = COALESCE($1, check_cnh),
        check_cnpj = COALESCE($2, check_cnpj),
        check_rntrc = COALESCE($3, check_rntrc),
        check_endereco = COALESCE($4, check_endereco),
        status = COALESCE($5, status),
        validado_em = CASE WHEN $5 = 'aprovado' THEN NOW() ELSE validado_em END,
        validado_por = CASE WHEN $5 = 'aprovado' THEN $6 ELSE validado_por END,
        updated_at = NOW()
       WHERE id = $7 AND organizacao_id = $8 RETURNING *`,
      [check_cnh, check_cnpj, check_rntrc, check_endereco, status, req.user?.nome || 'sistema', req.params.id, req.organizacao_id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Cadastro não encontrado' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// GET /:id/contrato-pdf — Gerar PDF do contrato
adminRouter.get('/:id/contrato-pdf', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT mc.*, cc.token, o.nome AS organizacao_nome
       FROM logi_motorista_cadastros mc
       JOIN logi_cadastro_convites cc ON cc.id = mc.convite_id AND cc.organizacao_id = mc.organizacao_id
       LEFT JOIN logi_organizacoes o ON o.id = mc.organizacao_id
       WHERE mc.id = $1 AND mc.organizacao_id = $2`,
      [req.params.id, req.organizacao_id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Cadastro não encontrado' });

    const cad = rows[0];
    const contratante = cad.organizacao_nome || 'CONTRATANTE';
    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({ size: 'A4', margin: 60 });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="contrato_${cad.nome || 'motorista'}.pdf"`);
    doc.pipe(res);

    doc.fontSize(14).font('Helvetica-Bold')
      .text('CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE TRANSPORTE', { align: 'center' });
    doc.moveDown(1.5);

    doc.fontSize(10).font('Helvetica');
    doc.text('Pelo presente instrumento particular, de um lado:');
    doc.moveDown(0.5);
    doc.font('Helvetica-Bold').text('CONTRATANTE: ', { continued: true });
    doc.font('Helvetica').text(`${contratante}, pessoa jurídica de direito privado, doravante denominada CONTRATANTE.`);
    doc.moveDown(0.5);
    doc.text('E, de outro lado:');
    doc.moveDown(0.5);
    doc.font('Helvetica-Bold').text('CONTRATADO: ', { continued: true });
    doc.font('Helvetica').text(
      `${cad.razao_social || cad.nome || '—'}, inscrita no CNPJ sob o nº ${cad.cnpj || '—'}, ` +
      `com sede em ${cad.endereco_pj || '—'}, ${cad.cidade_pj || '—'}/${cad.estado_pj || '—'}, ` +
      `CEP: ${cad.cep_pj || '—'}, doravante denominado CONTRATADO.`
    );
    doc.moveDown(1);

    const clausulas = [
      { titulo: 'CLÁUSULA 1 – DO OBJETO', texto: 'O presente contrato tem por objeto a prestação de serviços de transporte rodoviário de cargas pelo CONTRATADO, com fornecimento de veículo próprio e mão de obra para condução e operações correlatas, conforme demanda da CONTRATANTE, sem exclusividade.' },
      { titulo: 'CLÁUSULA 2 – DAS OBRIGAÇÕES DO CONTRATADO', texto: 'Conferir a carga no embarque e desembarque; zelar pela integridade da carga durante todo o transporte; arcar integralmente com as despesas do veículo utilizado; manter-se regularmente inscrito no RNTRC.' },
      { titulo: 'CLÁUSULA 3 – DOS HORÁRIOS E LOCAL', texto: 'A prestação dos serviços será realizada de segunda a sábado, nos locais e horários definidos pela CONTRATANTE, conforme necessidade operacional.' },
      { titulo: 'CLÁUSULA 4 – DA REMUNERAÇÃO E PAGAMENTO', texto: 'Os valores serão calculados com base na tabela de frete vigente. Pagamento quinzenal: 1ª quinzena até dia 5, 2ª até dia 20 do mês subsequente, por depósito bancário.' },
      { titulo: 'CLÁUSULA 5 – DO VÍNCULO CONTRATUAL', texto: 'O presente contrato tem natureza civil e autônoma, não se estabelecendo vínculo empregatício entre as partes.' },
      { titulo: 'CLÁUSULA 6 – DAS EXIGÊNCIAS FISCAIS', texto: 'O CONTRATADO compromete-se a cumprir integralmente as obrigações fiscais e tributárias relativas à sua atividade.' },
      { titulo: 'CLÁUSULA 7 – DA RESPONSABILIDADE', texto: 'O CONTRATADO declara estar devidamente habilitado e capacitado para a execução dos serviços contratados.' },
      { titulo: 'CLÁUSULA 8 – SIGILO E CONFIDENCIALIDADE', texto: 'O CONTRATADO obriga-se a manter sigilo sobre todas as informações a que tiver acesso em razão deste contrato.' },
      { titulo: 'CLÁUSULA 9 – CASO FORTUITO E FORÇA MAIOR', texto: 'As partes ficam isentas de responsabilidade em caso de descumprimento por motivo de caso fortuito ou força maior.' },
      { titulo: 'CLÁUSULA 10 – RESPONSABILIDADE PELA CARGA', texto: 'O CONTRATADO se compromete a zelar pela integridade da carga. Em caso de dano, o CONTRATANTE poderá efetuar descontos.' },
      { titulo: 'CLÁUSULA 11 – NÃO CONCORRÊNCIA', texto: 'Durante a vigência e por 12 meses após, o CONTRATADO se compromete a não prestar serviços a clientes do CONTRATANTE com os quais tenha tido contato.' },
      { titulo: 'CLÁUSULA 12 – PENALIDADES', texto: 'Descumprimento sujeita à multa de 100% do valor recebido nos últimos 3 meses.' },
      { titulo: 'CLÁUSULA 13 – LGPD', texto: 'As partes comprometem-se a cumprir as disposições da Lei nº 13.709/2018 (LGPD).' },
      { titulo: 'CLÁUSULA 14 – AUSÊNCIA DE SUBORDINAÇÃO', texto: 'O CONTRATADO prestará os serviços por sua conta e risco, com autonomia técnica e gerencial.' },
      { titulo: 'CLÁUSULA 15 – MULTIPLICIDADE DE TOMADORES', texto: 'O CONTRATADO declara prestar serviços a outros contratantes simultaneamente.' },
      { titulo: 'CLÁUSULA 16 – DO FORO', texto: 'Para dirimir dúvidas, as partes elegem o foro da comarca de Barueri/SP.' },
    ];

    for (const c of clausulas) {
      if (doc.y > 700) doc.addPage();
      doc.moveDown(0.3);
      doc.font('Helvetica-Bold').fontSize(9).text(c.titulo);
      doc.font('Helvetica').fontSize(9).text(c.texto, { align: 'justify' });
    }

    doc.addPage();
    doc.fontSize(12).font('Helvetica-Bold').text('DADOS DO CONTRATADO', { align: 'center' });
    doc.moveDown(1);
    doc.fontSize(9).font('Helvetica');

    const dados = [
      ['Nome Completo', cad.nome], ['CPF', cad.cpf], ['RG', cad.rg],
      ['CNH', `${cad.cnh_numero || '—'} - Cat. ${cad.cnh_categoria || '—'} - Val. ${cad.cnh_validade ? new Date(cad.cnh_validade).toLocaleDateString('pt-BR') : '—'}`],
      ['Endereço', `${cad.endereco || '—'}, ${cad.bairro || '—'}, ${cad.cidade || '—'}/${cad.estado || '—'} - CEP: ${cad.cep || '—'}`],
      ['Telefone', cad.telefone], ['Email', cad.email],
      ['', ''],
      ['Razão Social', cad.razao_social], ['CNPJ', cad.cnpj],
      ['Endereço PJ', `${cad.endereco_pj || '—'}, ${cad.bairro_pj || '—'}, ${cad.cidade_pj || '—'}/${cad.estado_pj || '—'} - CEP: ${cad.cep_pj || '—'}`],
      ['Data de Abertura', cad.data_abertura ? new Date(cad.data_abertura).toLocaleDateString('pt-BR') : '—'],
      ['', ''],
      ['Veículo - Placa', cad.veiculo_placa], ['Veículo - Modelo', cad.veiculo_modelo],
      ['Veículo - Ano', cad.veiculo_ano], ['RNTRC', cad.veiculo_rntrc],
      ['', ''],
      ['Banco', cad.banco], ['Agência', cad.agencia],
      ['Conta', `${cad.conta || '—'} (${cad.tipo_conta || '—'})`], ['PIX', cad.pix],
    ];

    for (const [label, value] of dados) {
      if (!label && !value) { doc.moveDown(0.3); continue; }
      doc.font('Helvetica-Bold').text(`${label}: `, { continued: true });
      doc.font('Helvetica').text(value || '—');
    }

    doc.moveDown(2);
    const hoje = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
    doc.text(`Barueri/SP, ${hoje}`, { align: 'center' });
    doc.moveDown(2);

    if (cad.assinatura_path) {
      const sigPath = path.join(__dirname, '../..', cad.assinatura_path);
      if (fs.existsSync(sigPath)) {
        doc.image(sigPath, doc.page.width / 2 - 75, doc.y, { width: 150 });
        doc.moveDown(4);
      }
    }

    doc.text('_____________________________________________', { align: 'center' });
    doc.font('Helvetica-Bold').text(`CONTRATADO — ${cad.nome || ''}`, { align: 'center' });
    doc.font('Helvetica').fontSize(8).text(`CPF: ${cad.cpf || '—'} | IP: ${cad.assinatura_ip || '—'}`, { align: 'center' });
    doc.moveDown(2);
    doc.text('_____________________________________________', { align: 'center' });
    doc.font('Helvetica-Bold').fontSize(9).text(contratante, { align: 'center' });

    doc.end();
  } catch (err) { next(err); }
});

module.exports = { publicRouter, adminRouter };
