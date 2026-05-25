require('dotenv').config({ path: 'C:\\Desenvolvimento\\logisystem\\backend\\.env' });
const { Pool } = require('pg');
const fs = require('fs'); const path = require('path');
const p = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });
const LOG = path.join(__dirname, '..', 'dados.txt');
fs.writeFileSync(LOG, '');

(async () => {
  try {
    // 1. Total geral em tabelas principais (sem filtro de org)
    const tabelas = ['logi_clientes','logi_transportadoras','logi_veiculos','logi_motoristas',
                     'logi_ordens_transporte','logi_contas_pagar','logi_contas_receber',
                     'logi_fornecedores','logi_motorista_cadastros','logi_cadastro_convites'];
    let s = '=== TOTAL GERAL POR TABELA (sem filtro de org) ===\n';
    for (const t of tabelas) {
      const r = await p.query(`SELECT COUNT(*)::int AS qt FROM ${t}`);
      s += `${t.padEnd(35)} ${r.rows[0].qt}\n`;
    }

    // 2. Totais por organização
    s += '\n=== BREAKDOWN POR ORGANIZAÇÃO ===\n';
    const { rows: orgs } = await p.query(`SELECT id, nome FROM logi_organizacoes ORDER BY nome`);
    for (const org of orgs) {
      s += `\n--- ${org.nome} (${org.id.substring(0,8)}) ---\n`;
      for (const t of tabelas) {
        try {
          const r = await p.query(`SELECT COUNT(*)::int AS qt FROM ${t} WHERE organizacao_id = $1`, [org.id]);
          if (r.rows[0].qt > 0) s += `  ${t.padEnd(33)} ${r.rows[0].qt}\n`;
        } catch (e) {
          s += `  ${t} ERRO: ${e.message}\n`;
        }
      }
    }

    // 3. Registros órfãos
    s += '\n=== REGISTROS ÓRFÃOS (org_id NULL ou inválido) ===\n';
    for (const t of tabelas) {
      try {
        const r = await p.query(`
          SELECT COUNT(*)::int AS qt FROM ${t}
          WHERE organizacao_id IS NULL
             OR organizacao_id NOT IN (SELECT id FROM logi_organizacoes)
        `);
        if (r.rows[0].qt > 0) s += `${t.padEnd(35)} ${r.rows[0].qt} órfãos\n`;
      } catch (e) {}
    }

    // 4. Conferir o usuário super-admin
    s += '\n=== USUÁRIOS SUPER ADMIN ===\n';
    const sa = await p.query(`
      SELECT u.id, u.nome, u.email,
             ARRAY(SELECT o.nome FROM logi_usuarios_orgs uo JOIN logi_organizacoes o ON o.id = uo.organizacao_id WHERE uo.usuario_id = u.id) AS orgs
      FROM logi_usuarios u
      WHERE u.perfil = 'super_admin' OR u.email LIKE '%wsdevsoft%' OR u.email LIKE '%admin%' OR u.nome ILIKE '%admin%'
      LIMIT 10
    `);
    sa.rows.forEach(u => s += `${u.email} (${u.nome}) → orgs: ${u.orgs.join(', ')}\n`);

    fs.writeFileSync(LOG, s);
    process.exit(0);
  } catch (e) {
    fs.writeFileSync(LOG, 'ERRO: ' + e.message + '\n' + e.stack);
    process.exit(1);
  }
})();
