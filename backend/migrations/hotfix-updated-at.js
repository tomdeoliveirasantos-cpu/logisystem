require('dotenv').config({ path: 'C:\\Desenvolvimento\\logisystem\\backend\\.env' });
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const p = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });

async function run() {
  const log = [];
  const append = (msg) => { console.log(msg); log.push(msg); };

  try {
    append('=== Hotfix: adicionar updated_at em tabelas que faltam ===\n');

    // Tabelas que fazem UPDATE ... updated_at = NOW() mas podem não ter a coluna
    const tabelas = [
      'logi_motoristas',
      'logi_veiculos',
      'logi_clientes',
      'logi_transportadoras',
      'logi_fornecedores',
    ];

    for (const tab of tabelas) {
      try {
        const c = await p.query(`
          SELECT column_name FROM information_schema.columns
          WHERE table_name = $1 AND column_name = 'updated_at'
        `, [tab]);
        if (c.rows.length > 0) {
          append(`  ✓ ${tab}.updated_at já existe`);
        } else {
          await p.query(`
            ALTER TABLE ${tab} ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          `);
          append(`  ✓ ${tab}.updated_at criado`);
        }
      } catch (e) {
        append(`  ✗ ${tab}: ${e.message}`);
      }
    }

    append('\n=== HOTFIX_COMPLETE ===');
  } catch (e) {
    append(`\nERRO: ${e.message}`);
  } finally {
    await p.end();
    fs.writeFileSync(path.join(__dirname, 'hotfix-updated-at.log'), log.join('\n'));
    process.exit(0);
  }
}
run();
