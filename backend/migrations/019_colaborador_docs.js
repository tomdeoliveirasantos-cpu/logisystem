require('dotenv').config({ path: 'C:\\Desenvolvimento\\logisystem\\backend\\.env' });
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const p = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });

(async () => {
  const log = [];
  const out = (m) => { console.log(m); log.push(m); };
  try {
    out('=== MIGRATION 019 - documentos e data_admissao em logi_motoristas ===');

    const cols = [
      ['data_admissao',                'DATE'],
      ['cnpj',                         'VARCHAR(20)'],
      ['cnpj_arquivo_nome',            'VARCHAR(255)'],
      ['cnpj_arquivo_path',            'VARCHAR(255)'],
      ['comprovante_endereco_nome',    'VARCHAR(255)'],
      ['comprovante_endereco_path',    'VARCHAR(255)'],
      ['contrato_social_nome',         'VARCHAR(255)'],
      ['contrato_social_path',         'VARCHAR(255)'],
    ];

    for (const [c, t] of cols) {
      const has = await p.query(
        `SELECT 1 FROM information_schema.columns
          WHERE table_schema='public' AND table_name='logi_motoristas' AND column_name=$1`, [c]);
      if (has.rows.length) { out(`  ✓ ${c} já existe`); continue; }
      await p.query(`ALTER TABLE logi_motoristas ADD COLUMN ${c} ${t}`);
      out(`  ✓ ${c} (${t}) adicionada`);
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
