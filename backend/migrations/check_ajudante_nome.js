require('dotenv').config({ path: 'C:\\Desenvolvimento\\logisystem\\backend\\.env' });
const { Pool } = require('pg');
const fs = require('fs');
const p = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });
(async () => {
  const log = [];
  try {
    const r = await p.query(`
      SELECT column_name, data_type FROM information_schema.columns
      WHERE table_name='logi_ordens_transporte' AND column_name LIKE '%ajudante%'
      ORDER BY ordinal_position
    `);
    log.push('=== Colunas %ajudante% em logi_ordens_transporte ===');
    r.rows.forEach(c => log.push(`  • ${c.column_name} (${c.data_type})`));

    if (!r.rows.some(c => c.column_name === 'ajudante_nome')) {
      log.push('\n⚠ Coluna ajudante_nome NÃO existe — criando agora...');
      await p.query(`ALTER TABLE logi_ordens_transporte ADD COLUMN IF NOT EXISTS ajudante_nome TEXT`);
      log.push('  ✓ Coluna criada');
    } else {
      log.push('\n✓ Coluna ajudante_nome já existe');
    }
  } catch (e) {
    log.push('!!! ' + e.message);
  } finally {
    fs.writeFileSync(__dirname + '/check-ajudante.log', log.join('\n'));
    await p.end();
    process.exit(0);
  }
})();
