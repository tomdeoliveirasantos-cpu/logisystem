require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

(async () => {
  try {
    // Lista todas as tabelas logi_*
    const tables = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name LIKE 'logi_%'
      ORDER BY table_name
    `);

    let output = `=== TABELAS LOGI_* (${tables.rows.length}) ===\n`;
    tables.rows.forEach(r => output += `- ${r.table_name}\n`);

    // Verifica se já existe coluna organizacao/empresa em alguma
    const orgCols = await pool.query(`
      SELECT table_name, column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name LIKE 'logi_%'
        AND (column_name ILIKE '%empresa%' OR column_name ILIKE '%organiz%' OR column_name ILIKE '%tenant%')
      ORDER BY table_name, column_name
    `);

    output += `\n=== COLUNAS RELACIONADAS A EMPRESA/ORG (${orgCols.rows.length}) ===\n`;
    orgCols.rows.forEach(r => output += `- ${r.table_name}.${r.column_name} (${r.data_type})\n`);

    // Schema de logi_usuarios
    const userCols = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'logi_usuarios'
      ORDER BY ordinal_position
    `);

    output += `\n=== logi_usuarios SCHEMA ===\n`;
    userCols.rows.forEach(r => output += `- ${r.column_name} ${r.data_type}${r.is_nullable === 'NO' ? ' NOT NULL' : ''}${r.column_default ? ' DEFAULT '+r.column_default : ''}\n`);

    // Conta registros por tabela operacional principal
    const mainTables = ['logi_usuarios', 'logi_clientes', 'logi_motoristas', 'logi_veiculos', 'logi_ordens_transporte', 'logi_romaneios', 'logi_fornecedores'];
    output += `\n=== CONTAGEM DE REGISTROS ===\n`;
    for (const t of mainTables) {
      try {
        const r = await pool.query(`SELECT COUNT(*) as c FROM ${t}`);
        output += `- ${t}: ${r.rows[0].c}\n`;
      } catch (e) {
        output += `- ${t}: (não existe ou erro)\n`;
      }
    }

    fs.writeFileSync('C:\\Desenvolvimento\\logisystem\\backend\\schema_inspect.txt', output);
    console.log('OK escrito em schema_inspect.txt');
    process.exit(0);
  } catch (e) {
    console.error('ERRO:', e.message);
    fs.writeFileSync('C:\\Desenvolvimento\\logisystem\\backend\\schema_inspect.txt', 'ERRO: ' + e.message);
    process.exit(1);
  }
})();
