const express  = require('express');
const bcrypt   = require('bcrypt');
const jwt      = require('jsonwebtoken');
const db       = require('../db');
const { authMiddleware, requirePerfil, SECRET } = require('../middleware/auth');
const { getUserOrgs, validarVinculo, requireTenant, requirePerfilOrg } = require('../middleware/tenant');

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

// ── Gestão de usuários (só admin da org) ──────────────────
// GET /api/auth/usuarios — lista apenas usuários vinculados à org ativa
//   Super-admin (WsDevSoft) vê todos os usuários do sistema.
router.get('/usuarios', authMiddleware, requireTenant, requirePerfilOrg('admin', 'super_admin'), async (req, res, next) => {
  try {
    if (req.is_super_admin) {
      // Super-admin: lista global com info de quantas orgs cada usuário tem
      const { rows } = await db.query(
        `SELECT u.id, u.nome, u.email, u.perfil, u.ativo, u.ultimo_login, u.created_at,
                (SELECT COUNT(*)::int FROM logi_usuarios_orgs uo
                  WHERE uo.usuario_id = u.id AND uo.ativo = TRUE) AS qtd_orgs
         FROM logi_usuarios u
         ORDER BY u.nome`
      );
      return res.json(rows);
    }
    // Admin da org: só vê usuários com vínculo ativo nessa org, e o perfil_na_org
    const { rows } = await db.query(
      `SELECT u.id, u.nome, u.email, u.perfil, u.ativo, u.ultimo_login, u.created_at,
              uo.perfil_na_org
         FROM logi_usuarios u
         JOIN logi_usuarios_orgs uo ON uo.usuario_id = u.id
        WHERE uo.organizacao_id = $1 AND uo.ativo = TRUE
        ORDER BY u.nome`,
      [req.organizacao_id]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// POST /api/auth/usuarios — cria usuário E vincula à org ativa (transação)
//   body: { nome, email, senha, perfil, perfil_na_org? }
//   Se perfil_na_org não vier, usa perfil. Super-admin pode passar organizacao_id
//   explícito para criar usuário em outra org.
router.post('/usuarios', authMiddleware, requireTenant, requirePerfilOrg('admin', 'super_admin'), async (req, res, next) => {
  const client = await db.pool.connect();
  try {
    const { nome, email, senha, perfil, perfil_na_org, organizacao_id: orgIdBody } = req.body;
    if (!nome || !email || !senha) return res.status(422).json({ error: 'Nome, e-mail e senha obrigatórios' });

    // Por padrão vincula à org ativa. Super-admin pode escolher outra org via body.
    const orgDestino = (req.is_super_admin && orgIdBody) ? orgIdBody : req.organizacao_id;
    const perfilOrg = perfil_na_org || perfil || 'operador';

    await client.query('BEGIN');

    // 1) Cria o usuário
    const hash = await bcrypt.hash(senha, 10);
    const { rows: usrRows } = await client.query(
      `INSERT INTO logi_usuarios (nome, email, senha_hash, perfil)
       VALUES ($1, $2, $3, $4)
       RETURNING id, nome, email, perfil, ativo, created_at`,
      [nome, email.toLowerCase(), hash, perfil || 'operador']
    );
    const novoUser = usrRows[0];

    // 2) Cria o vínculo com a org
    await client.query(
      `INSERT INTO logi_usuarios_orgs (usuario_id, organizacao_id, perfil_na_org, ativo)
       VALUES ($1, $2, $3, TRUE)`,
      [novoUser.id, orgDestino, perfilOrg]
    );

    await client.query('COMMIT');
    res.status(201).json({ ...novoUser, perfil_na_org: perfilOrg, organizacao_id: orgDestino });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    if (err.code === '23505') return res.status(422).json({ error: 'E-mail já cadastrado' });
    next(err);
  } finally {
    client.release();
  }
});

// PUT /api/auth/usuarios/:id — atualiza dados do usuário E perfil_na_org
//   Só permite editar usuários que têm vínculo com a org ativa
//   (super-admin pode editar qualquer um)
router.put('/usuarios/:id', authMiddleware, requireTenant, requirePerfilOrg('admin', 'super_admin'), async (req, res, next) => {
  const client = await db.pool.connect();
  try {
    const { nome, email, perfil, ativo, senha, perfil_na_org } = req.body;

    // 1) Valida que o alvo está vinculado à org ativa (a menos que seja super-admin)
    if (!req.is_super_admin) {
      const vinc = await client.query(
        `SELECT 1 FROM logi_usuarios_orgs
          WHERE usuario_id = $1 AND organizacao_id = $2 AND ativo = TRUE`,
        [req.params.id, req.organizacao_id]
      );
      if (!vinc.rows.length) {
        return res.status(404).json({ error: 'Usuário não encontrado nesta organização' });
      }
    }

    await client.query('BEGIN');

    // 2) Atualiza dados globais do usuário
    let q, params;
    if (senha) {
      const hash = await bcrypt.hash(senha, 10);
      q = `UPDATE logi_usuarios SET nome=$1, email=$2, perfil=$3, ativo=$4, senha_hash=$5, updated_at=NOW()
           WHERE id=$6 RETURNING id, nome, email, perfil, ativo`;
      params = [nome, email.toLowerCase(), perfil, ativo, hash, req.params.id];
    } else {
      q = `UPDATE logi_usuarios SET nome=$1, email=$2, perfil=$3, ativo=$4, updated_at=NOW()
           WHERE id=$5 RETURNING id, nome, email, perfil, ativo`;
      params = [nome, email.toLowerCase(), perfil, ativo, req.params.id];
    }
    const { rows } = await client.query(q, params);
    if (!rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Não encontrado' });
    }

    // 3) Se mudou perfil_na_org, atualiza o vínculo
    if (perfil_na_org) {
      await client.query(
        `UPDATE logi_usuarios_orgs SET perfil_na_org = $1
          WHERE usuario_id = $2 AND organizacao_id = $3`,
        [perfil_na_org, req.params.id, req.organizacao_id]
      );
    }

    await client.query('COMMIT');
    res.json({ ...rows[0], perfil_na_org: perfil_na_org || undefined });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    next(err);
  } finally {
    client.release();
  }
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

// DELETE /api/auth/usuarios/:id — remove usuário desta org
//   Estratégia: desativa o vínculo da org ativa (logi_usuarios_orgs.ativo=false).
//   Se o usuário ficar sem nenhum vínculo ativo, desativa também o usuário global.
//   Super-admin pode opcionalmente desativar globalmente passando ?global=1.
router.delete('/usuarios/:id', authMiddleware, requireTenant, requirePerfilOrg('admin', 'super_admin'), async (req, res, next) => {
  const client = await db.pool.connect();
  try {
    if (req.params.id === req.user.id) {
      return res.status(422).json({ error: 'Não pode desativar a si mesmo' });
    }

    await client.query('BEGIN');

    if (req.is_super_admin && req.query.global === '1') {
      // Modo super-admin: desativa global E todos os vínculos
      await client.query('UPDATE logi_usuarios SET ativo=false, updated_at=NOW() WHERE id=$1', [req.params.id]);
      await client.query('UPDATE logi_usuarios_orgs SET ativo=false WHERE usuario_id=$1', [req.params.id]);
      await client.query('COMMIT');
      return res.status(204).send();
    }

    // Modo normal: só desativa o vínculo desta org
    const upd = await client.query(
      `UPDATE logi_usuarios_orgs SET ativo=false
        WHERE usuario_id=$1 AND organizacao_id=$2 AND ativo=TRUE
        RETURNING usuario_id`,
      [req.params.id, req.organizacao_id]
    );
    if (!upd.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Usuário não estava vinculado a esta organização' });
    }

    // Se não restou nenhum vínculo ativo, desativa o usuário global também
    const { rows: restante } = await client.query(
      `SELECT COUNT(*)::int AS c FROM logi_usuarios_orgs
        WHERE usuario_id = $1 AND ativo = TRUE`,
      [req.params.id]
    );
    if (restante[0].c === 0) {
      await client.query('UPDATE logi_usuarios SET ativo=false, updated_at=NOW() WHERE id=$1', [req.params.id]);
    }

    await client.query('COMMIT');
    res.status(204).send();
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    next(err);
  } finally {
    client.release();
  }
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
