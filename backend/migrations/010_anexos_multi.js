require('dotenv').config({ path: 'C:\\Desenvolvimento\\logisystem\\backend\\.env' });
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const p = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });

async function run() {
  const log = [];
  const append = (msg) => { console.log(msg); log.push(msg); };
  const client = await p.connect();

  try {
    append('=== MIGRATION 010 - Anexos múltiplos por OT ===');
    append(`Iniciado em ${new Date().toISOString()}\n`);

    await client.query('BEGIN');

    append('--- 1. Criar logi_ordem_anexos ---');
    await client.query(`
      CREATE TABLE IF NOT EXISTS logi_ordem_anexos (
        id SERIAL PRIMARY KEY,
        ordem_id TEXT NOT NULL REFERENCES logi_ordens_transporte(id) ON DELETE CASCADE,
        nome TEXT NOT NULL,
        path TEXT NOT NULL,
        tamanho INTEGER,
        content_type TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    append('  ✓ tabela criada');

    await client.query(`CREATE INDEX IF NOT EXISTS idx_anexos_ordem ON logi_ordem_anexos(ordem_id)`);
    append('  ✓ índice criado');

    // Migrar anexo legado (campo único anexo_path da OT) para a nova tabela
    append('\n--- 2. Migrar anexos legados (anexo_path/anexo_nome/anexo_tamanho) ---');
    const r = await client.query(`
      INSERT INTO logi_ordem_anexos (ordem_id, nome, path, tamanho)
      SELECT id, COALESCE(anexo_nome, 'anexo'), anexo_path, anexo_tamanho
      FROM logi_ordens_transporte
      WHERE anexo_path IS NOT NULL AND anexo_path <> ''
        AND NOT EXISTS (
          SELECT 1 FROM logi_ordem_anexos a WHERE a.ordem_id = logi_ordens_transporte.id AND a.path = logi_ordens_transporte.anexo_path
        )
      RETURNING id
    `);
    append(`  ✓ ${r.rowCount} anexos legados migrados`);

    await client.query('COMMIT');
    append('\n--- COMMIT ---');
    append('\n=== MIGRATION_010_COMPLETE ===');
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    append(`\n!!! ERROR: ${e.message}`);
    append(e.stack);
  } finally {
    client.release();
    await p.end();
    fs.writeFileSync(path.join(__dirname, 'migrate-010.log'), log.join('\n'));
    process.exit(0);
  }
}
run();
