const jwt = require('jsonwebtoken');
const SECRET = process.env.JWT_SECRET || 'logisystem_secret_2026';

// Verifica token JWT
function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token não fornecido' });
  }
  try {
    const token = auth.split(' ')[1];
    req.user = jwt.verify(token, SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido ou expirado' });
  }
}

// Verifica perfil mínimo necessário
function requirePerfil(...perfis) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Não autenticado' });
    if (!perfis.includes(req.user.perfil)) {
      return res.status(403).json({ error: 'Sem permissão para esta ação' });
    }
    next();
  };
}

// Permissões por rota
const PERMISSOES = {
  admin:      ['clientes','transportadoras','veiculos','motoristas','ordens','manutencoes','multas','financeiro','relatorios','usuarios'],
  operador:   ['clientes','transportadoras','veiculos','motoristas','ordens','manutencoes','multas'],
  financeiro: ['clientes','ordens','financeiro','relatorios'],
};

function podeAcessar(perfil, modulo) {
  return PERMISSOES[perfil]?.includes(modulo) ?? false;
}

module.exports = { authMiddleware, requirePerfil, podeAcessar, SECRET };
