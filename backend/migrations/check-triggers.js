require('dotenv').config({ path: 'C:\\Desenvolvimento\\logisystem\\backend\\.env' });
const { Pool } = require('pg');
const fs = require('fs');
const p = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });
async function run() {
  const log = [];
  try {
    // Verificar coluna updated_at em logi_motoristas
    const c = await p.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'logi_motoristas' AND column_name = 'updated_at'
    `);
    log.push(`Coluna updated_at em logi_motoristas: ${c.rows.length > 0 ? 'EXISTE' : 'NÃO EXISTE'}`);
    
    // Verificar triggers
    const t = await p.query(`
      SELECT trigger_name, event_manipulation, action_statement
      FROM information_schema.triggers
      WHERE event_object_table = 'logi_motoristas'
    `);
    log.push(`\nTriggers em logi_motoristas: ${t.rows.length}`);
    t.rows.forEach(r => log.push(`  - ${r.trigger_name} (${r.event_manipulation}): ${r.action_statement?.substring(0, 100)}`));
    
    // Listar todas as colunas
    const cols = await p.query(`
      SELECT column_name, data_type FROM information_schema.columns 
      WHERE table_name = 'logi_motoristas' ORDER BY ordinal_position
    `);
    log.push(`\nColunas de logi_motoristas (${cols.rows.length}):`);
    cols.rows.forEach(r => log.push(`  ${r.column_name}: ${r.data_type}`));
    
  } catch(e) { log.push(`ERRO: ${e.message}`); }
  fs.writeFileSync('C:\\Desenvolvimento\\logisystem\\backend\\migrations\\check-triggers.log', log.join('\n'));
  await p.end();
  process.exit(0);
}
run();
