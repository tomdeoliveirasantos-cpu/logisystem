require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');

const log = (msg) => fs.appendFileSync('C:\\Desenvolvimento\\logisystem\\backend\\schema_inspect.txt', msg + '\n');

fs.writeFileSync('C:\\Desenvolvimento\\logisystem\\backend\\schema_inspect.txt', '');

log('DB_HOST=' + process.env.DB_HOST);
log('DB_PORT=' + process.env.DB_PORT);
log('DB_NAME=' + process.env.DB_NAME);
log('DB_USER=' + process.env.DB_USER);
log('HAS_PWD=' + (!!process.env.DB_PASSWORD));

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

(async () => {
  try {
    log('Conectando...');
    const tables = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name LIKE 'logi_%'
      ORDER BY table_name
    `);

    log(`\n=== TABELAS LOGI_* (${tables.rows.length}) ===`);
    tables.rows.forEach(r => log(`- ${r.table_name}`));

    const orgCols = await pool.query(`
      SELECT table_name, column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name LIKE 'logi_%'
        AND (column_name ILIKE '%empresa%' OR column_name ILIKE '%organiz%' OR column_name ILIKE '%tenant%')
      ORDER BY table_name, column_name
    `);

    log(`\n=== COLUNAS RELACIONADAS A EMPRESA/ORG (${orgCols.rows.length}) ===`);
    orgCols.rows.forEach(r => log(`- ${r.table_name}.${r.column_name} (${r.data_type})`));

    const userCols = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'logi_usuarios'
      ORDER BY ordinal_position
    `);

    log(`\n=== logi_usuarios SCHEMA ===`);
    userCols.rows.forEach(r => log(`- ${r.column_name} ${r.data_type}${r.is_nullable === 'NO' ? ' NOT NULL' : ''}${r.column_default ? ' DEFAULT '+r.column_default : ''}`));

    const mainTables = ['logi_usuarios', 'logi_clientes', 'logi_motoristas', 'logi_veiculos', 'logi_ordens_transporte', 'logi_romaneios', 'logi_fornecedores', 'logi_manutencoes', 'logi_contas_pagar', 'logi_contas_receber', 'logi_multas', 'logi_tabela_frete'];
    log(`\n=== CONTAGEM DE REGISTROS ===`);
    for (const t of mainTables) {
      try {
        const r = await pool.query(`SELECT COUNT(*) as c FROM ${t}`);
        log(`- ${t}: ${r.rows[0].c}`);
      } catch (e) {
        log(`- ${t}: (${e.message.substring(0, 60)})`);
      }
    }

    log('\nOK');
    process.exit(0);
  } catch (e) {
    log('ERRO: ' + e.message);
    log('STACK: ' + e.stack);
    process.exit(1);
  }
})();
