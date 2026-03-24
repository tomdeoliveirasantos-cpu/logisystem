const express  = require('express');
const bcrypt   = require('bcrypt');
const jwt      = require('jsonwebtoken');
const db       = require('../db');
const { authMiddleware, requirePerfil, SECRET } = require('../middleware/auth');

const router = express.Router();

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

    // Atualiza último login
    await db.query('UPDATE logi_usuarios SET ultimo_login=NOW() WHERE id=$1', [user.id]);

    const token = jwt.sign(
      { id: user.id, nome: user.nome, email: user.email, perfil: user.perfil },
      SECRET,
      { expiresIn: '12h' }
    );

    res.json({
      token,
      user: { id: user.id, nome: user.nome, email: user.email, perfil: user.perfil }
    });
  } catch (err) { next(err); }
});

// GET /api/auth/me — valida token e retorna dados do usuário
router.get('/me', authMiddleware, (req, res) => {
  res.json({ user: req.user });
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
    await db.query('UPDATE logi_usuarios SET senha_hash=$1,updated_at=NOW() WHERE id=$2', [hash, req.user.id]);
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

module.exports = router;
