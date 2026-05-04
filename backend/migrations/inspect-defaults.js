require('dotenv').config({ path: 'C:\\Desenvolvimento\\logisystem\\backend\\.env' });
const { Pool } = require('pg');
const fs = require('fs');
const p = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });
async function run() {
  const log = [];
  try {
    // Ver default do id em ordens, motoristas, veiculos
    const { rows: r } = await p.query(`
      SELECT table_name, column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name IN ('logi_ordens_transporte', 'logi_motoristas', 'logi_veiculos', 'logi_clientes', 'logi_contas_pagar', 'logi_contas_receber')
        AND column_name IN ('id', 'ordem_id')
      ORDER BY table_name, column_name
    `);
    log.push('=== Tipos e defaults ===');
    for (const row of r) {
      log.push(`  ${row.table_name}.${row.column_name}: ${row.data_type} [default: ${row.column_default || 'NULL'}]`);
    }

    // Confirma se contas_pagar.ordem_id também é text
    const { rows: cp } = await p.query(`
      SELECT column_name, data_type FROM information_schema.columns
      WHERE table_name='logi_contas_pagar' ORDER BY ordinal_position
    `);
    log.push('\n=== logi_contas_pagar ===');
    cp.forEach(c => log.push(`  ${c.column_name}: ${c.data_type}`));

    // Schema completo de motoristas e veiculos
    const { rows: m } = await p.query(`
      SELECT column_name, data_type, character_maximum_length FROM information_schema.columns
      WHERE table_name='logi_motoristas' ORDER BY ordinal_position
    `);
    log.push('\n=== logi_motoristas ===');
    m.forEach(c => log.push(`  ${c.column_name}: ${c.data_type}${c.character_maximum_length ? '(' + c.character_maximum_length + ')' : ''}`));

    const { rows: v } = await p.query(`
      SELECT column_name, data_type, character_maximum_length FROM information_schema.columns
      WHERE table_name='logi_veiculos' ORDER BY ordinal_position
    `);
    log.push('\n=== logi_veiculos ===');
    v.forEach(c => log.push(`  ${c.column_name}: ${c.data_type}${c.character_maximum_length ? '(' + c.character_maximum_length + ')' : ''}`));
  } catch(e) {
    log.push(`ERRO: ${e.message}`);
  }
  fs.writeFileSync('C:\\Desenvolvimento\\logisystem\\backend\\migrations\\inspect-defaults.log', log.join('\n'));
  await p.end();
  process.exit(0);
}
run();
