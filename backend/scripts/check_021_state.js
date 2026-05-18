require('dotenv').config({ path: 'C:\\Desenvolvimento\\logisystem\\backend\\.env' });
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const p = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });
const LOG = path.join(__dirname, '..', 'check_021_state.txt');
fs.writeFileSync(LOG, '');
const log = (m) => fs.appendFileSync(LOG, m + '\n');

(async () => {
  try {
    // 1. logi_organizacoes existe?
    const t1 = await p.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('logi_organizacoes','logi_usuarios_orgs')`);
    log('Tabelas multi-tenant: ' + t1.rows.map(r=>r.table_name).join(', '));

    // 2. Orgs cadastradas
    if (t1.rows.find(r=>r.table_name==='logi_organizacoes')) {
      const orgs = await p.query(`SELECT id, nome, slug, is_wsdevsoft FROM logi_organizacoes ORDER BY is_wsdevsoft DESC, nome`);
      log(`\nOrganizações (${orgs.rows.length}):`);
      orgs.rows.forEach(o => log(`  - ${o.nome} (${o.slug}) id=${o.id} super=${o.is_wsdevsoft}`));
    }

    // 3. Vínculos
    if (t1.rows.find(r=>r.table_name==='logi_usuarios_orgs')) {
      const v = await p.query(`
        SELECT u.email, o.nome AS org, uo.perfil_na_org
        FROM logi_usuarios_orgs uo
        JOIN logi_usuarios u ON u.id = uo.usuario_id
        JOIN logi_organizacoes o ON o.id = uo.organizacao_id
        ORDER BY u.email, o.nome
      `);
      log(`\nVínculos (${v.rows.length}):`);
      v.rows.forEach(r => log(`  - ${r.email} → ${r.org} (${r.perfil_na_org})`));
    }

    // 4. organizacao_id em cada tabela tenant?
    const tabelas = [
      'logi_clientes','logi_motoristas','logi_veiculos','logi_ordens_transporte',
      'logi_ordem_paradas','logi_ordem_anexos','logi_ordem_ajudantes','logi_historico_ordens',
      'logi_transportadoras','logi_ajudantes','logi_multas','logi_manutencoes',
      'logi_contas_pagar','logi_contas_receber','logi_adiantamentos','logi_fornecedores',
      'logi_tabela_fretes','logi_tabela_frete_recebido','logi_reajustes_frete',
      'logi_motorista_cadastros','logi_cadastro_convites'
    ];
    log(`\n=== organizacao_id por tabela ===`);
    for (const t of tabelas) {
      const c = await p.query(`SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 AND column_name='organizacao_id'`, [t]);
      const has = c.rows.length > 0;
      let cnt = '?', cntNull = '?';
      if (has) {
        const r = await p.query(`SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE organizacao_id IS NULL) AS nulls FROM ${t}`);
        cnt = r.rows[0].total;
        cntNull = r.rows[0].nulls;
      }
      log(`  ${has ? '✓' : '✗'} ${t} — col=${has} total=${cnt} sem_org=${cntNull}`);
    }

    // 5. Locks pendentes?
    const locks = await p.query(`
      SELECT pid, state, query_start, LEFT(query, 80) AS query
      FROM pg_stat_activity
      WHERE datname = current_database() AND state != 'idle' AND pid != pg_backend_pid()
    `);
    log(`\n=== Conexões ativas (${locks.rows.length}) ===`);
    locks.rows.forEach(l => log(`  pid=${l.pid} state=${l.state} query=${l.query}`));

    log('\nOK');
    process.exit(0);
  } catch (e) {
    log('ERRO: ' + e.message);
    process.exit(1);
  }
})();
