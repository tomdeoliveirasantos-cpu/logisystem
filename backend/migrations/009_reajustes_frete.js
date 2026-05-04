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
    append('=== MIGRATION 009 - Tabela de Reajustes de Frete ===');
    append(`Iniciado em ${new Date().toISOString()}\n`);

    await client.query('BEGIN');

    // ── Criar tabela ──
    append('--- 1. Criando logi_reajustes_frete ---');
    await client.query(`
      CREATE TABLE IF NOT EXISTS logi_reajustes_frete (
        id SERIAL PRIMARY KEY,
        tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('recebido','pago','diaria')),
        percentual NUMERIC(6,3) NOT NULL,
        data_vigencia DATE NOT NULL,
        descricao TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    append('  ✓ tabela criada');

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_reajustes_tipo_vigencia
        ON logi_reajustes_frete(tipo, data_vigencia)
    `);
    append('  ✓ índice criado (tipo, data_vigencia)');

    // ── Seed: reajuste de 3,5% recebido a partir de 16/04/2026 ──
    append('\n--- 2. Seed: reajuste 3,5% recebido (vigência 2026-04-16) ---');
    const { rows: ex } = await client.query(
      `SELECT id FROM logi_reajustes_frete
       WHERE tipo='recebido' AND data_vigencia='2026-04-16'`
    );
    if (ex.length === 0) {
      await client.query(
        `INSERT INTO logi_reajustes_frete (tipo, percentual, data_vigencia, descricao)
         VALUES ('recebido', 3.500, '2026-04-16', 'Reajuste anual Léo Madeiras 2026')`
      );
      append('  ✓ inserido');
    } else {
      append(`  ⚠ já existe (id=${ex[0].id}), pulando`);
    }

    // ── Verificação ──
    append('\n--- 3. Verificação ---');
    const { rows: all } = await client.query(
      `SELECT id, tipo, percentual, data_vigencia, descricao
       FROM logi_reajustes_frete
       ORDER BY data_vigencia DESC`
    );
    all.forEach(r => append(`  • [${r.id}] ${r.tipo} ${r.percentual}% a partir de ${r.data_vigencia.toISOString().slice(0,10)} — ${r.descricao}`));

    await client.query('COMMIT');
    append('\n--- COMMIT realizado ---');
    append('\n=== MIGRATION_009_COMPLETE ===');
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    append(`\n!!! MIGRATION_ERROR: ${e.message}`);
    append(e.stack);
  } finally {
    client.release();
    await p.end();
    fs.writeFileSync(path.join(__dirname, 'migrate-009.log'), log.join('\n'));
    process.exit(0);
  }
}
run();
