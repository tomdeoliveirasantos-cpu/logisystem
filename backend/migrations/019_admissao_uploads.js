require('dotenv').config({ path: 'C:\\Desenvolvimento\\logisystem\\backend\\.env' });
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const p = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });

const COLS = [
  ['data_admissao',             'DATE'],
  ['cnpj',                      'TEXT'],
  ['cnpj_arquivo_nome',         'TEXT'],
  ['cnpj_arquivo_path',         'TEXT'],
  ['comprovante_endereco_nome', 'TEXT'],
  ['comprovante_endereco_path', 'TEXT'],
  ['contrato_social_nome',      'TEXT'],
  ['contrato_social_path',      'TEXT'],
];

(async () => {
  const log = [];
  const out = (m) => { console.log(m); log.push(m); };
  try {
    out('=== MIGRATION 019 - admissão + uploads em logi_motoristas ===');
    for (const [col, type] of COLS) {
      const has = await p.query(
        `SELECT 1 FROM information_schema.columns
          WHERE table_schema='public' AND table_name='logi_motoristas' AND column_name=$1`, [col]
      );
      if (has.rows.length) {
        out(`  ✓ ${col} já existe`);
      } else {
        await p.query(`ALTER TABLE logi_motoristas ADD COLUMN ${col} ${type}`);
        out(`  ✓ ${col} adicionada (${type})`);
      }
    }
    out('=== MIGRATION_019_COMPLETE ===');
  } catch (e) {
    out('!!! ERRO: ' + e.message);
  } finally {
    fs.writeFileSync(path.join(__dirname, 'migrate-019.log'), log.join('\n'));
    await p.end();
    process.exit(0);
  }
})();
