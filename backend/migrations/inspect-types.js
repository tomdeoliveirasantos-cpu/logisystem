require('dotenv').config({ path: 'C:\\Desenvolvimento\\logisystem\\backend\\.env' });
const { Pool } = require('pg');
const fs = require('fs');
const p = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });
async function run() {
  const log = [];
  try {
    const { rows } = await p.query(`
      SELECT column_name, data_type, character_maximum_length
      FROM information_schema.columns
      WHERE table_name = 'logi_ordens_transporte'
      ORDER BY ordinal_position
    `);
    log.push('=== Schema logi_ordens_transporte ===');
    for (const r of rows) {
      log.push(`  ${r.column_name}: ${r.data_type}${r.character_maximum_length ? '(' + r.character_maximum_length + ')' : ''}`);
    }
  } catch(e) {
    log.push(`ERRO: ${e.message}`);
  }
  fs.writeFileSync('C:\\Desenvolvimento\\logisystem\\backend\\migrations\\inspect-types.log', log.join('\n'));
  await p.end();
  process.exit(0);
}
run();
