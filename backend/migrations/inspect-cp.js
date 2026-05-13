require('dotenv').config({ path: 'C:\\Desenvolvimento\\logisystem\\backend\\.env' });
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const p = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });

(async () => {
  const log = [];
  try {
    const { rows } = await p.query(`
      SELECT column_name, data_type, udt_name, character_maximum_length, column_default, is_nullable
        FROM information_schema.columns
       WHERE table_schema='public' AND table_name='logi_contas_pagar'
       ORDER BY ordinal_position`);
    log.push('=== logi_contas_pagar ===');
    rows.forEach(c => {
      const len = c.character_maximum_length ? `(${c.character_maximum_length})` : '';
      const def = c.column_default ? ` default=${c.column_default.substring(0, 50)}` : '';
      log.push(`  ${c.column_name.padEnd(24)} ${c.udt_name}${len} ${c.is_nullable === 'YES' ? '(null)' : '(NN)'}${def}`);
    });

    // Sample
    const s = await p.query(`SELECT id, valor, status, tipo_lancamento, motorista_id, ordem_id FROM logi_contas_pagar ORDER BY id DESC LIMIT 3`);
    log.push('\n=== últimas 3 linhas ===');
    s.rows.forEach(r => log.push('  ' + JSON.stringify(r)));
  } catch (e) {
    log.push('ERRO: ' + e.message);
  } finally {
    fs.writeFileSync(path.join(__dirname, 'inspect-cp.log'), log.join('\n'));
    await p.end();
    console.log(log.join('\n'));
    process.exit(0);
  }
})();
