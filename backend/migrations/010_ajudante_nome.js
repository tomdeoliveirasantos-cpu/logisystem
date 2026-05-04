require('dotenv').config({ path: 'C:\\Desenvolvimento\\logisystem\\backend\\.env' });
const { Pool } = require('pg');
const fs = require('fs');
const p = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });

(async () => {
  const log = [];
  try {
    // Ver colunas existentes
    const { rows } = await p.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name='logi_ordens_transporte' AND column_name LIKE 'ajud%'
       ORDER BY column_name`
    );
    log.push('=== Colunas ajud* em logi_ordens_transporte ===');
    rows.forEach(r => log.push(`  • ${r.column_name}`));

    // Adicionar ajudante_nome se não existir
    const tem = rows.some(r => r.column_name === 'ajudante_nome');
    if (!tem) {
      log.push('\n--- Adicionando coluna ajudante_nome ---');
      await p.query(`ALTER TABLE logi_ordens_transporte ADD COLUMN ajudante_nome TEXT`);
      log.push('  ✓ coluna criada');
    } else {
      log.push('\n  ⚠ ajudante_nome já existe');
    }

    log.push('\n=== MIGRATION_010_COMPLETE ===');
  } catch (e) {
    log.push(`!!! ERRO: ${e.message}`);
  } finally {
    fs.writeFileSync(__dirname + '/migrate-010.log', log.join('\n'));
    await p.end();
    process.exit(0);
  }
})();
