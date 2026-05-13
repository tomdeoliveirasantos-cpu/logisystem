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
    append('=== MIGRATION 017 - Colunas de acerto/abatimento em logi_contas_pagar ===');
    append(`Iniciado em ${new Date().toISOString()}\n`);

    await client.query('BEGIN');

    // ── 1. valor_pago ──
    append('--- 1. Coluna valor_pago ---');
    const has1 = await client.query(
      `SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name='logi_contas_pagar' AND column_name='valor_pago'`
    );
    if (!has1.rows.length) {
      await client.query(`ALTER TABLE logi_contas_pagar ADD COLUMN valor_pago NUMERIC(12,2)`);
      append('  ✓ adicionada');
    } else append('  ✓ já existe');

    // ── 2. valor_adiantamentos (soma do que foi abatido nesta CP) ──
    append('\n--- 2. Coluna valor_adiantamentos ---');
    const has2 = await client.query(
      `SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name='logi_contas_pagar' AND column_name='valor_adiantamentos'`
    );
    if (!has2.rows.length) {
      await client.query(`ALTER TABLE logi_contas_pagar ADD COLUMN valor_adiantamentos NUMERIC(12,2) NOT NULL DEFAULT 0`);
      append('  ✓ adicionada');
    } else append('  ✓ já existe');

    // ── 3. ajudante_id (necessário pra diária de ajudante apontar pro cadastro) ──
    append('\n--- 3. Coluna ajudante_id ---');
    const has3 = await client.query(
      `SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name='logi_contas_pagar' AND column_name='ajudante_id'`
    );
    if (!has3.rows.length) {
      await client.query(`ALTER TABLE logi_contas_pagar ADD COLUMN ajudante_id TEXT`);
      // FK pra ajudantes
      await client.query(`
        ALTER TABLE logi_contas_pagar
          ADD CONSTRAINT fk_cp_ajudante
          FOREIGN KEY (ajudante_id) REFERENCES logi_ajudantes(id) ON DELETE SET NULL
      `);
      append('  ✓ adicionada (com FK)');
    } else append('  ✓ já existe');

    // ── 4. Índices auxiliares ──
    append('\n--- 4. Índices ---');
    await client.query(`CREATE INDEX IF NOT EXISTS idx_cp_status_tipo ON logi_contas_pagar(status, tipo_lancamento)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_cp_motorista_status ON logi_contas_pagar(motorista_id, status)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_cp_ajudante ON logi_contas_pagar(ajudante_id)`);
    append('  ✓ idx_cp_status_tipo, idx_cp_motorista_status, idx_cp_ajudante');

    // ── 5. Verificação ──
    append('\n--- 5. Verificação ---');
    const r = await client.query(
      `SELECT column_name, udt_name FROM information_schema.columns
        WHERE table_schema='public' AND table_name='logi_contas_pagar'
          AND column_name IN ('valor','valor_pago','valor_adiantamentos','ajudante_id','motorista_id')
        ORDER BY column_name`
    );
    r.rows.forEach(c => append(`  ${c.column_name.padEnd(22)} → ${c.udt_name}`));

    await client.query('COMMIT');
    append('\n=== MIGRATION_017_COMPLETE ===');
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    append(`\n!!! MIGRATION_ERROR: ${e.message}`);
    append(e.stack || '');
  } finally {
    client.release();
    await p.end();
    fs.writeFileSync(path.join(__dirname, 'migrate-017.log'), log.join('\n'));
    process.exit(0);
  }
}
run();
