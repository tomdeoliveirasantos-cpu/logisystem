require('dotenv').config({ path: 'C:\\Desenvolvimento\\logisystem\\backend\\.env' });
const { Pool } = require('pg');
const fs = require('fs'); const path = require('path');
const p = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });
const LOG = path.join(__dirname, '..', 'check_db.txt');
fs.writeFileSync(LOG, '');
(async () => {
  try {
    // Total de registros em tabelas tenant
    const tabelas = await p.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name LIKE 'logi_%'
      ORDER BY table_name
    `);
    let s = `Tabelas: ${tabelas.rows.length}\n\n`;
    // Conexões ativas
    const c = await p.query("SELECT COUNT(*) FROM pg_stat_activity WHERE datname = current_database()");
    s += `Conexões ativas: ${c.rows[0].count}\n\n`;
    // Tamanho de cada tabela
    const sz = await p.query(`
      SELECT relname AS tabela, pg_size_pretty(pg_total_relation_size(c.oid)) AS tamanho,
             reltuples::bigint AS linhas
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname LIKE 'logi_%' AND c.relkind = 'r'
      ORDER BY pg_total_relation_size(c.oid) DESC
      LIMIT 10
    `);
    s += 'Top 10 tabelas por tamanho:\n';
    sz.rows.forEach(r => s += `  ${r.tabela.padEnd(35)} ${r.tamanho.padStart(10)} (~${r.linhas} linhas)\n`);
    fs.writeFileSync(LOG, s);
    process.exit(0);
  } catch (e) {
    fs.writeFileSync(LOG, 'ERRO: ' + e.message);
    process.exit(1);
  }
})();
