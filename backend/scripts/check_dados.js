require('dotenv').config({ path: 'C:\\Desenvolvimento\\logisystem\\backend\\.env' });
const { Pool } = require('pg');
const fs = require('fs'); const path = require('path');
const p = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });
const LOG = path.join(__dirname, '..', 'dados.txt');
fs.writeFileSync(LOG, '');

(async () => {
  try {
    let s = '';

    // 1. Organizações existentes
    s += '=== ORGANIZAÇÕES ===\n';
    const { rows: orgs } = await p.query(
      `SELECT id, nome, ativo, is_wsdevsoft FROM logi_organizacoes ORDER BY nome`
    );
    orgs.forEach(o => s += `${o.id.substring(0,8)} | ${o.nome.padEnd(20)} | ativo=${o.ativo} | super=${o.is_wsdevsoft}\n`);

    // 2. Total de registros por org nas tabelas principais
    s += '\n=== DADOS POR ORGANIZAÇÃO ===\n';
    const tabelas = ['logi_clientes','logi_transportadoras','logi_veiculos','logi_motoristas',
                     'logi_fornecedores','logi_ordens_transporte','logi_contas_pagar',
                     'logi_contas_receber','logi_motorista_cadastros','logi_cadastro_convites'];
    for (const org of orgs) {
      s += `\n[${org.nome}]\n`;
      for (const t of tabelas) {
        try {
          const r = await p.query(`SELECT COUNT(*)::int AS qt FROM ${t} WHERE organizacao_id = $1`, [org.id]);
          if (r.rows[0].qt > 0) s += `  ${t.padEnd(30)} ${r.rows[0].qt}\n`;
        } catch (e) {}
      }
    }

    // 3. Total geral (incluindo órfãos)
    s += '\n=== TOTAL GERAL (sem filtro de org) ===\n';
    for (const t of tabelas) {
      try {
        const r = await p.query(`SELECT COUNT(*)::int AS qt FROM ${t}`);
        s += `${t.padEnd(30)} ${r.rows[0].qt}\n`;
      } catch (e) {}
    }

    // 4. Há registros órfãos (org_id NULL)?
    s += '\n=== REGISTROS ÓRFÃOS (organizacao_id NULL) ===\n';
    for (const t of tabelas) {
      try {
        const r = await p.query(`SELECT COUNT(*)::int AS qt FROM ${t} WHERE organizacao_id IS NULL`);
        if (r.rows[0].qt > 0) s += `  ${t.padEnd(30)} ${r.rows[0].qt} órfãos\n`;
      } catch (e) {}
    }

    // 5. Quais orgs o admin@logisystem.com tem vínculo
    s += '\n=== VÍNCULOS DO ADMIN@LOGISYSTEM ===\n';
    const v = await p.query(`
      SELECT u.email, u.nome, o.nome AS org_nome, uo.perfil_org
        FROM logi_usuarios u
        JOIN logi_usuarios_orgs uo ON uo.usuario_id = u.id
        JOIN logi_organizacoes o ON o.id = uo.organizacao_id
       WHERE u.email = 'admin@logisystem.com'
    `);
    v.rows.forEach(r => s += `${r.email} → ${r.org_nome} (perfil_org=${r.perfil_org})\n`);

    fs.writeFileSync(LOG, s);
    process.exit(0);
  } catch (e) {
    fs.writeFileSync(LOG, 'ERRO: ' + e.message);
    process.exit(1);
  }
})();
