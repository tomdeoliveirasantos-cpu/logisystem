const db = require('../db');

/**
 * Busca todas as organizações ativas de um usuário, com o perfil em cada uma.
 * Retorna array no formato:
 *   [{ id, nome, slug, perfil_na_org, logo_url, is_wsdevsoft }, ...]
 */
async function getUserOrgs(usuarioId) {
  const { rows } = await db.query(
    `SELECT o.id, o.nome, o.slug, o.logo_url, o.cor_primaria, o.is_wsdevsoft,
            uo.perfil_na_org
       FROM logi_usuarios_orgs uo
       JOIN logi_organizacoes o ON o.id = uo.organizacao_id
      WHERE uo.usuario_id = $1
        AND uo.ativo = TRUE
        AND o.ativo = TRUE
      ORDER BY o.is_wsdevsoft DESC, o.nome`,
    [usuarioId]
  );
  return rows;
}

/**
 * Valida que o usuário tem vínculo ativo com a organização indicada.
 * Retorna o registro de logi_usuarios_orgs ou null.
 */
async function validarVinculo(usuarioId, organizacaoId) {
  const { rows } = await db.query(
    `SELECT uo.perfil_na_org, o.is_wsdevsoft, o.nome AS org_nome, o.slug AS org_slug
       FROM logi_usuarios_orgs uo
       JOIN logi_organizacoes o ON o.id = uo.organizacao_id
      WHERE uo.usuario_id = $1
        AND uo.organizacao_id = $2
        AND uo.ativo = TRUE
        AND o.ativo = TRUE`,
    [usuarioId, organizacaoId]
  );
  return rows[0] || null;
}

/**
 * Middleware: exige que o JWT do usuário contenha organizacao_id e valida o vínculo.
 *
 * Deve ser usado APÓS o authMiddleware. Popula:
 *   req.organizacao_id
 *   req.perfil_na_org
 *   req.is_super_admin (true se usuário está logado na org WsDevSoft com super_admin)
 *
 * Compatibilidade: tokens antigos (sem organizacao_id no payload) recebem 401
 * com um código específico para o frontend reabrir o login.
 */
async function requireTenant(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Não autenticado' });
  }

  const { id: usuarioId, organizacao_id: orgId } = req.user;

  if (!orgId) {
    // Token antigo (pré-multitenant) — força relogin
    return res.status(401).json({
      error: 'Sessão precisa ser renovada — faça login novamente',
      code: 'ORG_NOT_SELECTED',
    });
  }

  const vinculo = await validarVinculo(usuarioId, orgId);
  if (!vinculo) {
    return res.status(403).json({
      error: 'Sem acesso a esta organização',
      code: 'ORG_FORBIDDEN',
    });
  }

  req.organizacao_id = orgId;
  req.perfil_na_org = vinculo.perfil_na_org;
  req.org_nome = vinculo.org_nome;
  req.org_slug = vinculo.org_slug;
  req.is_super_admin = vinculo.is_wsdevsoft && vinculo.perfil_na_org === 'super_admin';
  next();
}

/**
 * Middleware: exige perfil_na_org específico.
 * Uso: requirePerfilOrg('admin', 'super_admin')
 *
 * super_admin sempre é aceito (tem acesso a tudo).
 */
function requirePerfilOrg(...perfis) {
  return (req, res, next) => {
    if (!req.perfil_na_org) {
      return res.status(403).json({ error: 'Tenant não resolvido' });
    }
    if (req.is_super_admin) return next();
    if (!perfis.includes(req.perfil_na_org)) {
      return res.status(403).json({ error: 'Sem permissão para esta ação' });
    }
    next();
  };
}

module.exports = {
  getUserOrgs,
  validarVinculo,
  requireTenant,
  requirePerfilOrg,
};
