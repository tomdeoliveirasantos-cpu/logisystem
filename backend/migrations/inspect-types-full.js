require('dotenv').config({ path: 'C:\\Desenvolvimento\\logisystem\\backend\\.env' });
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const p = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });

async function run() {
  const log = [];
  const append = (msg) => { console.log(msg); log.push(msg); };
  try {
    const tabs = ['logi_motoristas', 'logi_veiculos', 'logi_ordens_transporte', 'logi_contas_pagar', 'logi_usuarios', 'logi_ajudantes', 'logi_adiantamentos', 'logi_fornecedores'];

    for (const t of tabs) {
      append(`\n=== ${t} ===`);
      const cols = await p.query(
        `SELECT column_name, data_type, udt_name, character_maximum_length, column_default, is_nullable
           FROM information_schema.columns
          WHERE table_schema='public' AND table_name=$1
          ORDER BY ordinal_position
          LIMIT 12`, [t]
      );
      if (!cols.rows.length) { append('  (tabela NÃO existe)'); continue; }
      cols.rows.forEach(c => {
        const def = c.column_default ? ` default=${c.column_default.substring(0, 40)}` : '';
        const len = c.character_maximum_length ? `(${c.character_maximum_length})` : '';
        append(`  ${c.column_name.padEnd(22)} ${c.udt_name}${len} ${c.is_nullable === 'YES' ? '(null)' : '(NN)'}${def}`);
      });

      // Sample do id
      try {
        const s = await p.query(`SELECT id FROM ${t} LIMIT 3`);
        if (s.rows.length) {
          append(`  amostra de id: ${s.rows.map(r => JSON.stringify(r.id)).join(', ')}`);
        }
      } catch (e) { /* sem id, ignorar */ }
    }
  } catch (e) {
    append(`!!! ERRO: ${e.message}`);
  } finally {
    await p.end();
    fs.writeFileSync(path.join(__dirname, 'inspect-types-full.log'), log.join('\n'));
    process.exit(0);
  }
}
run();
