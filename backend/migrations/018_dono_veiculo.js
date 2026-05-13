require('dotenv').config({ path: 'C:\\Desenvolvimento\\logisystem\\backend\\.env' });
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const p = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });

(async () => {
  const log = [];
  const out = (m) => { console.log(m); log.push(m); };
  try {
    out('=== MIGRATION 018 - dono_veiculo em logi_motoristas ===');

    const has = await p.query(`
      SELECT 1 FROM information_schema.columns
       WHERE table_schema='public' AND table_name='logi_motoristas' AND column_name='dono_veiculo'
    `);
    if (has.rows.length) {
      out('  ✓ coluna dono_veiculo já existe');
    } else {
      await p.query(`ALTER TABLE logi_motoristas ADD COLUMN dono_veiculo TEXT`);
      out('  ✓ coluna dono_veiculo adicionada');
    }

    out('=== MIGRATION_018_COMPLETE ===');
  } catch (e) {
    out('!!! ERRO: ' + e.message);
  } finally {
    fs.writeFileSync(path.join(__dirname, 'migrate-018.log'), log.join('\n'));
    await p.end();
    process.exit(0);
  }
})();
