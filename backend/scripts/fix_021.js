require('dotenv').config({ path: 'C:\\Desenvolvimento\\logisystem\\backend\\.env' });
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const p = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });
const LOG = path.join(__dirname, '..', 'fix_021_log.txt');
fs.writeFileSync(LOG, '');
const log = (m) => fs.appendFileSync(LOG, m + '\n');

(async () => {
  const client = await p.connect();
  try {
    log('=== VALIDAÇÃO E CORREÇÃO DA MIGRATION 021 ===\n');

    // 1. Listar todas as orgs
    const orgs = await client.query(`SELECT id, nome, slug, is_wsdevsoft FROM logi_organizacoes ORDER BY is_wsdevsoft DESC, nome`);
    log(`Organizações (${orgs.rows.length}):`);
    orgs.rows.forEach(o => log(`  - ${o.nome} (${o.slug}) ${o.is_wsdevsoft ? '[SUPER]' : ''} id=${o.id}`));

    // 2. Listar todos os vínculos
    const vinc = await client.query(`
      SELECT u.email, o.nome AS org, o.slug, uo.perfil_na_org, uo.ativo
      FROM logi_usuarios_orgs uo
      JOIN logi_usuarios u ON u.id = uo.usuario_id
      JOIN logi_organizacoes o ON o.id = uo.organizacao_id
      ORDER BY u.email, o.nome
    `);
    log(`\nVínculos (${vinc.rows.length}):`);
    vinc.rows.forEach(v => log(`  - ${v.email} → ${v.org} (${v.perfil_na_org}) ativo=${v.ativo}`));

    // 3. CORREÇÃO: admin@mtrans.com.br não deveria estar vinculado à Léo
    log('\n--- Correção ---');
    const mtransAdmin = await client.query(`SELECT id FROM logi_usuarios WHERE LOWER(email)='admin@mtrans.com.br'`);
    const leoOrg = await client.query(`SELECT id FROM logi_organizacoes WHERE slug='leo-madeiras'`);

    if (mtransAdmin.rows.length && leoOrg.rows.length) {
      const r = await client.query(
        `DELETE FROM logi_usuarios_orgs WHERE usuario_id=$1 AND organizacao_id=$2`,
        [mtransAdmin.rows[0].id, leoOrg.rows[0].id]
      );
      log(`  Removido vínculo admin@mtrans.com.br → Léo: ${r.rowCount} linha(s)`);
    } else {
      log('  Nada a corrigir.');
    }

    // 4. Listar vínculos pós-correção
    const vinc2 = await client.query(`
      SELECT u.email, o.nome AS org, uo.perfil_na_org
      FROM logi_usuarios_orgs uo
      JOIN logi_usuarios u ON u.id = uo.usuario_id
      JOIN logi_organizacoes o ON o.id = uo.organizacao_id
      WHERE uo.ativo
      ORDER BY u.email, o.nome
    `);
    log(`\nVínculos finais (${vinc2.rows.length}):`);
    vinc2.rows.forEach(v => log(`  - ${v.email} → ${v.org} (${v.perfil_na_org})`));

    // 5. Estado da Mtrans: deve estar 100% vazia
    const TABELAS = [
      'logi_clientes','logi_motoristas','logi_veiculos','logi_ordens_transporte',
      'logi_ordem_paradas','logi_ordem_anexos','logi_ordem_ajudantes','logi_historico_ordens',
      'logi_transportadoras','logi_ajudantes','logi_multas','logi_manutencoes',
      'logi_contas_pagar','logi_contas_receber','logi_adiantamentos','logi_fornecedores',
      'logi_tabela_fretes','logi_tabela_frete_recebido','logi_reajustes_frete',
      'logi_motorista_cadastros','logi_cadastro_convites'
    ];

    const mtransOrg = await client.query(`SELECT id FROM logi_organizacoes WHERE slug='mtrans'`);
    const mtransId = mtransOrg.rows[0]?.id;
    if (mtransId) {
      log(`\nEstado da Mtrans (id=${mtransId}):`);
      let totalMtrans = 0;
      for (const t of TABELAS) {
        const r = await client.query(`SELECT COUNT(*) AS c FROM ${t} WHERE organizacao_id=$1`, [mtransId]);
        const c = parseInt(r.rows[0].c, 10);
        if (c > 0) {
          log(`  ⚠ ${t}: ${c} linhas`);
          totalMtrans += c;
        }
      }
      log(totalMtrans === 0 ? '  ✓ Mtrans 100% vazia' : `  ⚠ Total: ${totalMtrans} linhas indevidas`);
    }

    // 6. Estado da Léo: nenhuma linha órfã
    const leoId = leoOrg.rows[0]?.id;
    log(`\nLinhas órfãs (organizacao_id IS NULL):`);
    let orfas = 0;
    for (const t of TABELAS) {
      const r = await client.query(`SELECT COUNT(*) AS c FROM ${t} WHERE organizacao_id IS NULL`);
      const c = parseInt(r.rows[0].c, 10);
      if (c > 0) {
        log(`  ⚠ ${t}: ${c}`);
        orfas += c;
      }
    }
    log(orfas === 0 ? '  ✓ Nenhuma linha órfã' : `  ⚠ Total: ${orfas}`);

    // 7. Distribuição por org
    log(`\nDistribuição por organização:`);
    for (const t of TABELAS) {
      const r = await client.query(`
        SELECT COALESCE(o.nome, '— sem org —') AS org, COUNT(*) AS c
        FROM ${t} x
        LEFT JOIN logi_organizacoes o ON o.id = x.organizacao_id
        GROUP BY o.nome
        ORDER BY o.nome
      `);
      if (r.rows.length === 0) {
        log(`  ${t}: 0 registros`);
      } else {
        log(`  ${t}: ${r.rows.map(x=>`${x.org}=${x.c}`).join(', ')}`);
      }
    }

    log('\nOK');
    process.exit(0);
  } catch (e) {
    log('ERRO: ' + e.message);
    log(e.stack);
    process.exit(1);
  } finally {
    client.release();
  }
})();
