const db = require('./index');

/**
 * Helper para queries em tabelas tenant-aware.
 *
 * Uso (a partir da Fase 4, ao refatorar as rotas):
 *   const { rows } = await queryTenant(req,
 *     'SELECT * FROM logi_clientes WHERE id = $1',
 *     [clienteId]
 *   );
 *
 * O helper injeta automaticamente AND organizacao_id = $org no WHERE.
 * Use {{ORG}} no SQL para indicar onde o filtro deve entrar, ou deixe o
 * helper anexar automaticamente.
 *
 * Para SELECT/UPDATE/DELETE sem WHERE explícito:
 *   queryTenant(req, 'SELECT * FROM logi_clientes')
 * vira:
 *   SELECT * FROM logi_clientes WHERE organizacao_id = $1
 *
 * Para INSERT, o helper acrescenta organizacao_id no VALUES automaticamente
 * quando a query contém o placeholder {{ORG_INSERT}}.
 *
 * Fase 5 ativará RLS no banco — então mesmo queries sem filtro ficam seguras.
 */

function isSuperAdmin(req) {
  return req.is_super_admin === true;
}

/**
 * Query com filtro de tenant. Super-admin pode bypassar passando
 * { bypassTenant: true } no terceiro arg.
 */
async function queryTenant(req, sql, params = [], opts = {}) {
  if (!req.organizacao_id && !opts.bypassTenant) {
    throw new Error('queryTenant chamado sem req.organizacao_id resolvido');
  }

  // Super-admin com bypass explícito = query global, sem filtro
  if (opts.bypassTenant && isSuperAdmin(req)) {
    return db.query(sql, params);
  }

  // Substituição automática de {{ORG}} pelo placeholder $N do organizacao_id
  const orgParamIndex = params.length + 1;
  let processedSql = sql;
  let processedParams = [...params];

  if (sql.includes('{{ORG}}')) {
    processedSql = sql.replace(/\{\{ORG\}\}/g, `$${orgParamIndex}`);
    processedParams.push(req.organizacao_id);
  } else if (sql.includes('{{ORG_INSERT}}')) {
    // Para INSERT VALUES: injeta organizacao_id como último valor
    processedSql = sql.replace(/\{\{ORG_INSERT\}\}/g, `$${orgParamIndex}`);
    processedParams.push(req.organizacao_id);
  } else {
    // Sem placeholder explícito — anexa WHERE automaticamente
    // Detecção simples: presença de WHERE
    if (/\bWHERE\b/i.test(sql)) {
      // Já tem WHERE — anexar AND
      processedSql = sql.replace(
        /(\bWHERE\b)/i,
        `$1 organizacao_id = $${orgParamIndex} AND`
      );
    } else {
      // Sem WHERE — anexar antes de ORDER BY / LIMIT / GROUP BY ou no final
      const m = sql.match(/\b(ORDER BY|GROUP BY|LIMIT)\b/i);
      if (m) {
        const pos = m.index;
        processedSql = sql.slice(0, pos) + `WHERE organizacao_id = $${orgParamIndex} ` + sql.slice(pos);
      } else {
        processedSql = sql.trimEnd() + ` WHERE organizacao_id = $${orgParamIndex}`;
      }
    }
    processedParams.push(req.organizacao_id);
  }

  return db.query(processedSql, processedParams);
}

/**
 * Query global, sem filtro de tenant. Use apenas para endpoints
 * super_admin que precisam ver dados cross-tenant.
 */
async function queryGlobal(req, sql, params = []) {
  if (!isSuperAdmin(req)) {
    throw new Error('queryGlobal só pode ser usado por super_admin');
  }
  return db.query(sql, params);
}

module.exports = {
  queryTenant,
  queryGlobal,
  isSuperAdmin,
};
