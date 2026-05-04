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
    append('=== MIGRATION 007 - Colaborador + Tipo de Frete + Multiplicador + Ajudantes N-pra-N ===');
    append(`Iniciado em ${new Date().toISOString()}\n`);

    await client.query('BEGIN');

    // ── 1. tipo_colaborador em logi_motoristas ────────────
    append('--- Etapa 1: tipo_colaborador em logi_motoristas ---');
    await client.query(`
      ALTER TABLE logi_motoristas
        ADD COLUMN IF NOT EXISTS tipo_colaborador VARCHAR(30) DEFAULT 'pendente'
    `);
    append('  ✓ logi_motoristas.tipo_colaborador (default pendente)');

    // ── 2. tipo_colaborador em logi_motorista_cadastros ───
    append('\n--- Etapa 2: tipo_colaborador em logi_motorista_cadastros ---');
    await client.query(`
      ALTER TABLE logi_motorista_cadastros
        ADD COLUMN IF NOT EXISTS tipo_colaborador VARCHAR(30)
    `);
    append('  ✓ logi_motorista_cadastros.tipo_colaborador');

    // ── 3. tipo_frete + multiplicador_frete em logi_ordens_transporte ──
    append('\n--- Etapa 3: tipo_frete + multiplicador_frete em ordens ---');
    await client.query(`
      ALTER TABLE logi_ordens_transporte
        ADD COLUMN IF NOT EXISTS tipo_frete VARCHAR(20)
    `);
    append('  ✓ logi_ordens_transporte.tipo_frete');
    await client.query(`
      ALTER TABLE logi_ordens_transporte
        ADD COLUMN IF NOT EXISTS multiplicador_frete INTEGER DEFAULT 1
    `);
    append('  ✓ logi_ordens_transporte.multiplicador_frete (default 1)');

    // Constraint: multiplicador 1-9 (sanity check)
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'chk_multiplicador_range'
        ) THEN
          ALTER TABLE logi_ordens_transporte
            ADD CONSTRAINT chk_multiplicador_range CHECK (multiplicador_frete BETWEEN 1 AND 9);
        END IF;
      END $$
    `);
    append('  ✓ constraint multiplicador 1-9');

    // ── 4. Tabela N-pra-N de ajudantes ────────────────────
    append('\n--- Etapa 4: tabela logi_ordem_ajudantes ---');
    await client.query(`
      CREATE TABLE IF NOT EXISTS logi_ordem_ajudantes (
        id SERIAL PRIMARY KEY,
        ordem_id TEXT NOT NULL REFERENCES logi_ordens_transporte(id) ON DELETE CASCADE,
        motorista_id TEXT NOT NULL REFERENCES logi_motoristas(id) ON DELETE CASCADE,
        valor NUMERIC(12,2),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE (ordem_id, motorista_id)
      )
    `);
    append('  ✓ logi_ordem_ajudantes criada (ordem_id, motorista_id, valor)');

    await client.query(`CREATE INDEX IF NOT EXISTS idx_ordem_ajudantes_ordem ON logi_ordem_ajudantes(ordem_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_ordem_ajudantes_motorista ON logi_ordem_ajudantes(motorista_id)`);
    append('  ✓ índices criados');

    // ── 5. Backfill tipo_frete a partir do veículo (caso haja OTs) ──
    append('\n--- Etapa 5: Backfill tipo_frete (= tipo do veículo) ---');
    const r5 = await client.query(`
      UPDATE logi_ordens_transporte ot
      SET tipo_frete = v.tipo
      FROM logi_veiculos v
      WHERE ot.veiculo_id = v.id AND ot.tipo_frete IS NULL
    `);
    append(`  ✓ ${r5.rowCount} OTs com tipo_frete preenchido`);

    // ── 6. Verificação ──────────────────────────────────
    append('\n--- Etapa 6: Verificação ---');
    const checks = [
      ['tipo_colaborador (motoristas)', `SELECT 1 FROM information_schema.columns WHERE table_name='logi_motoristas' AND column_name='tipo_colaborador'`],
      ['tipo_colaborador (cadastros)', `SELECT 1 FROM information_schema.columns WHERE table_name='logi_motorista_cadastros' AND column_name='tipo_colaborador'`],
      ['tipo_frete (ordens)', `SELECT 1 FROM information_schema.columns WHERE table_name='logi_ordens_transporte' AND column_name='tipo_frete'`],
      ['multiplicador_frete (ordens)', `SELECT 1 FROM information_schema.columns WHERE table_name='logi_ordens_transporte' AND column_name='multiplicador_frete'`],
      ['tabela logi_ordem_ajudantes', `SELECT 1 FROM information_schema.tables WHERE table_name='logi_ordem_ajudantes'`],
    ];
    for (const [label, sql] of checks) {
      const { rows } = await client.query(sql);
      append(`  ${rows.length ? '✓' : '✗'} ${label}`);
    }

    await client.query('COMMIT');
    append('\n--- COMMIT realizado ---');
    append('\n=== MIGRATION_007_COMPLETE ===');
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    append(`\n!!! MIGRATION_ERROR: ${e.message}`);
    append(`!!! ROLLBACK executado.`);
    append(e.stack);
  } finally {
    client.release();
    await p.end();
    fs.writeFileSync(path.join(__dirname, 'migrate-007.log'), log.join('\n'));
    process.exit(0);
  }
}
run();
