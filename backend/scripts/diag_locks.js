require('dotenv').config({ path: 'C:\\Desenvolvimento\\logisystem\\backend\\.env' });
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false,
  max: 1,
  statement_timeout: 8000,
  query_timeout: 8000,
});

const LOG = path.join(__dirname, '..', 'diag_locks.txt');
fs.writeFileSync(LOG, '');
const log = (m) => fs.appendFileSync(LOG, m + '\n');

(async () => {
  try {
    log('=== Verificar conexões ativas ===');
    const conns = await pool.query(`
      SELECT pid, state, query_start, state_change, application_name,
             LEFT(query, 100) AS query_snippet
        FROM pg_stat_activity
       WHERE datname = current_database()
         AND pid <> pg_backend_pid()
       ORDER BY query_start
    `);
    conns.rows.forEach(c => {
      log(`pid=${c.pid} state=${c.state} app=${c.application_name || '-'} q=${c.query_snippet || '-'}`);
    });

    log('\n=== Verificar locks ===');
    const locks = await pool.query(`
      SELECT l.pid, l.mode, l.granted, c.relname
        FROM pg_locks l
        LEFT JOIN pg_class c ON c.oid = l.relation
       WHERE c.relname LIKE 'logi_%'
         AND l.pid <> pg_backend_pid()
       ORDER BY l.pid, c.relname
    `);
    if (locks.rows.length === 0) {
      log('  (nenhum lock ativo em tabelas logi_*)');
    }
    locks.rows.forEach(l => {
      log(`  pid=${l.pid} mode=${l.mode} granted=${l.granted} tabela=${l.relname}`);
    });

    log('\n=== Matar conexões idle/idle in transaction de outros PIDs ===');
    const kill = await pool.query(`
      SELECT pg_terminate_backend(pid) AS killed, pid, state
        FROM pg_stat_activity
       WHERE datname = current_database()
         AND pid <> pg_backend_pid()
         AND state IN ('idle', 'idle in transaction', 'idle in transaction (aborted)')
    `);
    log(`  ${kill.rows.length} conexões terminadas`);
    kill.rows.forEach(k => log(`    pid=${k.pid} state=${k.state} killed=${k.killed}`));

    process.exit(0);
  } catch (e) {
    log('ERRO: ' + e.message);
    process.exit(1);
  }
})();
