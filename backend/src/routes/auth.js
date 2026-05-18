const express  = require('express');
const bcrypt   = require('bcrypt');
const jwt      = require('jsonwebtoken');
const db       = require('../db');
const { authMiddleware, requirePerfil, SECRET } = require('../middleware/auth');
const { getUserOrgs, validarVinculo } = require('../middleware/tenant');

const crypto = require('crypto');

const router = express.Router();

// ── Config WebAuthn ──
const RP_NAME = 'LogiSystem';
const RP_ID = 'app.wsdevsoft.com';
const ORIGIN = 'https://app.wsdevsoft.com';

// Armazenamento temporário de challenges (em memória — ok para sessão curta)
const challenges = new Map();

// ── Helpers de JWT ──────────────────────────────────────────
function gerarToken(user, org = null) {
  const payload = {
    id: user.id,
    nome: user.nome,
    email: user.email,
    perfil: user.perfil, // legacy — mantido por compatibilidade
  };
  if (org) {
    payload.organizacao_id = org.id;
    payload.organizacao_nome = org.nome;
    payload.organizacao_slug = org.slug;
    payload.perfil_na_org = org.perfil_na_org;
    payload.is_wsdevsoft = org.is_wsdevsoft;
  }
  return jwt.sign(payload, SECRET, { expiresIn: '12h' });
}

// Token de pré-seleção (curto): usado entre login e select-org quando
// usuário tem múltiplas orgs. Marcado com pending_org=true.
function gerarTokenPreSelecao(user) {
  return jwt.sign(
    {
      id: user.id,
      nome: user.nome,
      email: user.email,
      perfil: user.perfil,
      pending_org: true,
    },
    SECRET,
    { expiresIn: '15m' }
  );
}

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const { email, senha } = req.body;
    if (!email || !senha) return res.status(422).json({ error: 'E-mail e senha obrigatórios' });

    const { rows } = await db.query(
      'SELECT * FROM logi_usuarios WHERE email = $1 AND ativo = true', [email.toLowerCase()]
    );
    if (!rows.length) return res.status(401).json({ error: 'E-mail ou senha incorretos' });

    const user = rows[0];
    const ok = await bcrypt.compare(senha, user.senha_hash);
    if (!ok) return res.status(401).json({ error: 'E-mail ou senha incorretos' });

    // Buscar orgs do usuário
    const orgs = await getUserOrgs(user.id);
    if (orgs.length === 0) {
      return res.status(403).json({ error: 'Usuário sem vínculo a nenhuma organização ativa' });
    }

    // Atualiza último login
    await db.query('UPDATE logi_usuarios SET ultimo_login=NOW() WHERE id=$1', [user.id]);

    const baseUser = {
      id: user.id, nome: user.nome, email: user.email, perfil: user.perfil,
      senha_resetada: user.senha_resetada,
    };

    if (orgs.length === 1) {
      // Único vínculo — emite JWT completo direto (UX igual ao anterior)
      const token = gerarToken(user, orgs[0]);
      return res.json({
        token,
        user: baseUser,
        org: {
          id: orgs[0].id, nome: orgs[0].nome, slug: orgs[0].slug,
          logo_url: orgs[0].logo_url, cor_primaria: orgs[0].cor_primaria,
          perfil_na_org: orgs[0].perfil_na_org, is_wsdevsoft: orgs[0].is_wsdevsoft,
        },
        orgs,
        precisa_selecionar_org: false,
      });
    }

    // Múltiplas orgs — emite token de pré-seleção
    const token = gerarTokenPreSelecao(user);
    return res.json({
      token,
      user: baseUser,
      orgs,
      precisa_selecionar_org: true,
    });
  } catch (err) { next(err); }
});

// GET /api/auth/me — valida token e retorna dados do usuário
router.get('/me', authMiddleware, (req, res) => {
  res.json({ user: req.user });
});

// GET /api/auth/me/orgs — lista as orgs do usuário logado
router.get('/me/orgs', authMiddleware, async (req, res, next) => {
  try {
    const orgs = await getUserOrgs(req.user.id);
    res.json(orgs);
  } catch (err) { next(err); }
});

// POST /api/auth/select-org — emite novo JWT já com a org escolhida
// Aceita tanto token de pré-seleção quanto token completo (para troca de org)
router.post('/select-org', authMiddleware, async (req, res, next) => {
  try {
    const { organizacao_id } = req.body;
    if (!organizacao_id) return res.status(422).json({ error: 'organizacao_id obrigatório' });

    // Valida que o usuário tem vínculo ativo com aquela org
    const vinculo = await validarVinculo(req.user.id, organizacao_id);
    if (!vinculo) {
      return res.status(403).json({ error: 'Sem acesso a esta organização' });
    }

    // Recarrega dados do usuário (caso tenham mudado desde o token original)
    const { rows } = await db.query(
      'SELECT id, nome, email, perfil, ativo, senha_resetada FROM logi_usuarios WHERE id = $1 AND ativo = true',
      [req.user.id]
    );
    if (!rows.length) return res.status(401).json({ error: 'Usuário inativo' });
    const user = rows[0];

    // Busca dados completos da org para o token
    const { rows: orgRows } = await db.query(
      `SELECT id, nome, slug, logo_url, cor_primaria, is_wsdevsoft FROM logi_organizacoes WHERE id = $1 AND ativo = TRUE`,
      [organizacao_id]
    );
    if (!orgRows.length) return res.status(404).json({ error: 'Organização não encontrada' });
    const org = { ...orgRows[0], perfil_na_org: vinculo.perfil_na_org };

    const token = gerarToken(user, org);
    res.json({
      token,
      user: {
        id: user.id, nome: user.nome, email: user.email, perfil: user.perfil,
        senha_resetada: user.senha_resetada,
      },
      org,
    });
  } catch (err) { next(err); }
});

// ── Gestão de usuários (só admin) ──────────────────────────
// GET /api/auth/usuarios
router.get('/usuarios', authMiddleware, requirePerfil('admin'), async (req, res, next) => {
  try {
    const { rows } = await db.query(
      'SELECT id,nome,email,perfil,ativo,ultimo_login,created_at FROM logi_usuarios ORDER BY nome'
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// POST /api/auth/usuarios
router.post('/usuarios', authMiddleware, requirePerfil('admin'), async (req, res, next) => {
  try {
    const { nome, email, senha, perfil } = req.body;
    if (!nome || !email || !senha) return res.status(422).json({ error: 'Nome, e-mail e senha obrigatórios' });
    const hash = await bcrypt.hash(senha, 10);
    const { rows } = await db.query(
      `INSERT INTO logi_usuarios (nome,email,senha_hash,perfil) VALUES ($1,$2,$3,$4)
       RETURNING id,nome,email,perfil,ativo,created_at`,
      [nome, email.toLowerCase(), hash, perfil || 'operador']
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(422).json({ error: 'E-mail já cadastrado' });
    next(err);
  }
});

// PUT /api/auth/usuarios/:id
router.put('/usuarios/:id', authMiddleware, requirePerfil('admin'), async (req, res, next) => {
  try {
    const { nome, email, perfil, ativo, senha } = req.body;
    let q, params;
    if (senha) {
      const hash = await bcrypt.hash(senha, 10);
      q = `UPDATE logi_usuarios SET nome=$1,email=$2,perfil=$3,ativo=$4,senha_hash=$5,updated_at=NOW()
           WHERE id=$6 RETURNING id,nome,email,perfil,ativo`;
      params = [nome, email.toLowerCase(), perfil, ativo, hash, req.params.id];
    } else {
      q = `UPDATE logi_usuarios SET nome=$1,email=$2,perfil=$3,ativo=$4,updated_at=NOW()
           WHERE id=$5 RETURNING id,nome,email,perfil,ativo`;
      params = [nome, email.toLowerCase(), perfil, ativo, req.params.id];
    }
    const { rows } = await db.query(q, params);
    if (!rows.length) return res.status(404).json({ error: 'Não encontrado' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// PATCH /api/auth/usuarios/senha — troca a própria senha
router.patch('/usuarios/senha', authMiddleware, async (req, res, next) => {
  try {
    const { senha_atual, nova_senha } = req.body;
    const { rows } = await db.query('SELECT senha_hash FROM logi_usuarios WHERE id=$1', [req.user.id]);
    const ok = await bcrypt.compare(senha_atual, rows[0].senha_hash);
    if (!ok) return res.status(401).json({ error: 'Senha atual incorreta' });
    const hash = await bcrypt.hash(nova_senha, 10);
    // Limpa flag senha_resetada quando o usuário troca a senha
    await db.query('UPDATE logi_usuarios SET senha_hash=$1,senha_resetada=false,updated_at=NOW() WHERE id=$2', [hash, req.user.id]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// DELETE /api/auth/usuarios/:id (soft delete)
router.delete('/usuarios/:id', authMiddleware, requirePerfil('admin'), async (req, res, next) => {
  try {
    if (req.params.id === req.user.id) return res.status(422).json({ error: 'Não pode desativar a si mesmo' });
    await db.query('UPDATE logi_usuarios SET ativo=false,updated_at=NOW() WHERE id=$1', [req.params.id]);
    res.status(204).send();
  } catch (err) { next(err); }
});

// ══════════════════════════════════════════════════
//   WebAuthn — Face ID / Touch ID / Biometria
// ══════════════════════════════════════════════════

// POST /api/auth/webauthn/register-options — gera opções para registrar credencial
router.post('/webauthn/register-options', authMiddleware, async (req, res, next) => {
  try {
    const { generateRegistrationOptions } = await import('@simplewebauthn/server');

    // Buscar credenciais existentes do usuário
    const { rows: existing } = await db.query(
      'SELECT credential_id FROM logi_webauthn_credentials WHERE usuario_id=$1',
      [req.user.id]
    );

    const options = await generateRegistrationOptions({
      rpName: RP_NAME,
      rpID: RP_ID,
      userID: new Uint8Array(Buffer.from(req.user.id)),
      userName: req.user.email,
      userDisplayName: req.user.nome,
      attestationType: 'none',
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
        residentKey: 'preferred',
      },
      excludeCredentials: existing.map(c => ({
        id: c.credential_id,
        type: 'public-key',
      })),
    });

    challenges.set(req.user.id, options.challenge);
    setTimeout(() => challenges.delete(req.user.id), 120000);

    res.json(options);
  } catch (err) { next(err); }
});

// POST /api/auth/webauthn/register-verify — verifica e salva credencial
router.post('/webauthn/register-verify', authMiddleware, async (req, res, next) => {
  try {
    const { verifyRegistrationResponse } = await import('@simplewebauthn/server');

    const challenge = challenges.get(req.user.id);
    if (!challenge) return res.status(400).json({ error: 'Challenge expirado' });

    const verification = await verifyRegistrationResponse({
      response: req.body,
      expectedChallenge: challenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
    });

    if (!verification.verified) return res.status(400).json({ error: 'Verificação falhou' });

    const { credential } = verification.registrationInfo;
    const credId = Buffer.from(credential.id).toString('base64url');
    const pubKey = Buffer.from(credential.publicKey).toString('base64url');

    await db.query(
      `INSERT INTO logi_webauthn_credentials (id, usuario_id, credential_id, public_key, counter, device_name)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [crypto.randomUUID(), req.user.id, credId, pubKey, credential.counter || 0, req.body.deviceName || 'Face ID']
    );

    challenges.delete(req.user.id);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// POST /api/auth/webauthn/auth-options — gera opções para autenticar
router.post('/webauthn/auth-options', async (req, res, next) => {
  try {
    const { generateAuthenticationOptions } = await import('@simplewebauthn/server');

    // Se email fornecido, buscar credenciais específicas
    const { email } = req.body;
    let allowCredentials = [];

    if (email) {
      const { rows } = await db.query(
        `SELECT wc.credential_id FROM logi_webauthn_credentials wc
         JOIN logi_usuarios u ON u.id = wc.usuario_id
         WHERE u.email = $1 AND u.ativo = true`,
        [email.toLowerCase()]
      );
      allowCredentials = rows.map(r => ({ id: r.credential_id, type: 'public-key' }));
    }

    const options = await generateAuthenticationOptions({
      rpID: RP_ID,
      userVerification: 'required',
      allowCredentials,
    });

    const challengeId = crypto.randomUUID();
    challenges.set(challengeId, { challenge: options.challenge, email });
    setTimeout(() => challenges.delete(challengeId), 120000);

    res.json({ ...options, challengeId });
  } catch (err) { next(err); }
});

// POST /api/auth/webauthn/auth-verify — verifica biometria e retorna JWT
router.post('/webauthn/auth-verify', async (req, res, next) => {
  try {
    const { verifyAuthenticationResponse } = await import('@simplewebauthn/server');
    const { challengeId, ...authResponse } = req.body;

    const stored = challenges.get(challengeId);
    if (!stored) return res.status(400).json({ error: 'Challenge expirado' });

    const credId = authResponse.id;

    // Buscar credencial no banco
    const { rows } = await db.query(
      `SELECT wc.*, u.id AS uid, u.nome, u.email, u.perfil, u.senha_resetada
       FROM logi_webauthn_credentials wc
       JOIN logi_usuarios u ON u.id = wc.usuario_id
       WHERE wc.credential_id = $1 AND u.ativo = true`,
      [credId]
    );

    if (!rows.length) return res.status(401).json({ error: 'Credencial não encontrada' });

    const cred = rows[0];

    const verification = await verifyAuthenticationResponse({
      response: authResponse,
      expectedChallenge: stored.challenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
      credential: {
        id: cred.credential_id,
        publicKey: Buffer.from(cred.public_key, 'base64url'),
        counter: cred.counter || 0,
      },
    });

    if (!verification.verified) return res.status(401).json({ error: 'Biometria inválida' });

    // Atualizar counter
    await db.query(
      'UPDATE logi_webauthn_credentials SET counter=$1 WHERE id=$2',
      [verification.authenticationInfo.newCounter, cred.id]
    );

    // Atualiza último login
    await db.query('UPDATE logi_usuarios SET ultimo_login=NOW() WHERE id=$1', [cred.uid]);

    // Busca orgs do usuário
    const userForToken = { id: cred.uid, nome: cred.nome, email: cred.email, perfil: cred.perfil };
    const orgs = await getUserOrgs(cred.uid);

    if (orgs.length === 0) {
      return res.status(403).json({ error: 'Usuário sem vínculo a nenhuma organização ativa' });
    }

    const baseUser = {
      id: cred.uid, nome: cred.nome, email: cred.email, perfil: cred.perfil,
      senha_resetada: cred.senha_resetada,
    };

    challenges.delete(challengeId);

    if (orgs.length === 1) {
      const token = gerarToken(userForToken, orgs[0]);
      return res.json({
        token,
        user: baseUser,
        org: {
          id: orgs[0].id, nome: orgs[0].nome, slug: orgs[0].slug,
          logo_url: orgs[0].logo_url, cor_primaria: orgs[0].cor_primaria,
          perfil_na_org: orgs[0].perfil_na_org, is_wsdevsoft: orgs[0].is_wsdevsoft,
        },
        orgs,
        precisa_selecionar_org: false,
      });
    }

    const token = gerarTokenPreSelecao(userForToken);
    return res.json({
      token,
      user: baseUser,
      orgs,
      precisa_selecionar_org: true,
    });
  } catch (err) { next(err); }
});

// GET /api/auth/webauthn/has-credential?email=x — verifica se tem biometria cadastrada
router.get('/webauthn/has-credential', async (req, res, next) => {
  try {
    const { email } = req.query;
    if (!email) return res.json({ has: false });
    const { rows } = await db.query(
      `SELECT count(*) c FROM logi_webauthn_credentials wc
       JOIN logi_usuarios u ON u.id = wc.usuario_id
       WHERE u.email = $1 AND u.ativo = true`,
      [email.toLowerCase()]
    );
    res.json({ has: Number(rows[0].c) > 0 });
  } catch (err) { next(err); }
});

module.exports = router;
