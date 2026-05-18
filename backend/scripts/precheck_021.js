require('dotenv').config({ path: 'C:\\Desenvolvimento\\logisystem\\backend\\.env' });
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const p = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });
const LOG = path.join(__dirname, '..', 'precheck_021.txt');
fs.writeFileSync(LOG, '');
const log = (m) => fs.appendFileSync(LOG, m + '\n');

(async () => {
  try {
    // 1. Listar todos os usuários (precisamos do email real do super_admin)
    const us = await p.query(`SELECT id, nome, email, perfil, ativo FROM logi_usuarios ORDER BY email`);
    log('=== USUÁRIOS EXISTENTES ===');
    us.rows.forEach(u => log(`- ${u.email} | ${u.nome} | perfil=${u.perfil} | ativo=${u.ativo} | id=${u.id}`));

    // 2. Tipo do id em logi_usuarios
    const tu = await p.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema='public' AND table_name='logi_usuarios' AND column_name='id'
    `);
    log(`\nlogi_usuarios.id tipo = ${tu.rows[0]?.data_type}`);

    // 3. Tipo do id nas tabelas tenant — amostra
    const tabelas = ['logi_clientes', 'logi_motoristas', 'logi_veiculos', 'logi_ordens_transporte', 'logi_fornecedores'];
    log(`\n=== TIPO DO id (amostra) ===`);
    for (const t of tabelas) {
      const r = await p.query(`
        SELECT data_type FROM information_schema.columns
        WHERE table_schema='public' AND table_name=$1 AND column_name='id'
      `, [t]);
      log(`- ${t}.id = ${r.rows[0]?.data_type || 'sem coluna id'}`);
    }

    // 4. Já existe a tabela logi_organizacoes ou logi_usuarios_orgs?
    const tex = await p.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema='public' AND table_name IN ('logi_organizacoes','logi_usuarios_orgs')
    `);
    log(`\nTabelas multi-tenant já existem? ${tex.rows.length === 0 ? 'NÃO' : tex.rows.map(r=>r.table_name).join(', ')}`);

    // 5. PG version
    const v = await p.query(`SELECT version()`);
    log(`\nPostgres: ${v.rows[0].version.substring(0, 60)}`);

    log('\nOK');
    process.exit(0);
  } catch (e) {
    log('ERRO: ' + e.message);
    process.exit(1);
  }
})();
