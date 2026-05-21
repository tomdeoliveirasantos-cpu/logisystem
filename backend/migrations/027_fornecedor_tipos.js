// backend/migrations/027_fornecedor_tipos.js
// Cria tabela logi_fornecedor_tipos (multi-tenant) com os tipos padrão
// + Administração, Marketing, EPIs (solicitados pelo cliente).
// Idempotente — não duplica se rodar várias vezes.

require('dotenv').config({ path: 'C:\\Desenvolvimento\\logisystem\\backend\\.env' });
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false, max: 1 });
const LOG = path.join(__dirname, '..', 'migration_027.log');
fs.writeFileSync(LOG, '');
const log = (m) => { fs.appendFileSync(LOG, m + '\n'); console.log(m); };

const TIPOS_PADRAO = [
  { valor: 'mecanica',      label: 'Mecânica' },
  { valor: 'pneus',         label: 'Pneus' },
  { valor: 'eletrica',      label: 'Elétrica' },
  { valor: 'funilaria',     label: 'Funilaria / Pintura' },
  { valor: 'seguros',       label: 'Seguros' },
  { valor: 'licenciamento', label: 'Licenciamento / Despachante' },
  { valor: 'combustivel',   label: 'Combustível' },
  { valor: 'pecas',         label: 'Peças / Autopeças' },
  { valor: 'tacografo',     label: 'Tacógrafo' },
  // Novos solicitados:
  { valor: 'administracao', label: 'Administração' },
  { valor: 'marketing',     label: 'Marketing' },
  { valor: 'epis',          label: 'EPIs' },
  { valor: 'outros',        label: 'Outros' },
];

(async () => {
  const client = await pool.connect();
  try {
    log('=== Migration 027: tipos de fornecedor ===');
    log(`Início: ${new Date().toISOString()}\n`);
    await client.query("SET lock_timeout = '5s'");
    await client.query("SET statement_timeout = '15s'");

    // ── PASSO 1: Criar tabela ──
    log('PASSO 1: Criar tabela logi_fornecedor_tipos...');
    await client.query('BEGIN');
    await client.query(`
      CREATE TABLE IF NOT EXISTS logi_fornecedor_tipos (
        id TEXT PRIMARY KEY DEFAULT md5(random()::text || clock_timestamp()::text),
        organizacao_id TEXT NOT NULL REFERENCES logi_organizacoes(id) ON DELETE CASCADE,
        valor VARCHAR(50) NOT NULL,
        label VARCHAR(100) NOT NULL,
        is_padrao BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        created_by TEXT,
        UNIQUE (organizacao_id, valor)
      )
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_fornec_tipos_org ON logi_fornecedor_tipos(organizacao_id)
    `);
    await client.query('COMMIT');
    log('  Tabela criada.\n');

    // ── PASSO 2: Seed para cada org existente ──
    log('PASSO 2: Seed dos tipos padrão para cada organização...');
    const { rows: orgs } = await client.query(
      `SELECT id, nome FROM logi_organizacoes WHERE ativo = TRUE`
    );

    for (const org of orgs) {
      log(`  Org: ${org.nome} (${org.id.substring(0,8)})`);
      let inseridos = 0;
      for (const t of TIPOS_PADRAO) {
        const r = await client.query(
          `INSERT INTO logi_fornecedor_tipos (organizacao_id, valor, label, is_padrao)
           VALUES ($1, $2, $3, TRUE)
           ON CONFLICT (organizacao_id, valor) DO NOTHING
           RETURNING id`,
          [org.id, t.valor, t.label]
        );
        if (r.rowCount > 0) inseridos++;
      }
      log(`    ${inseridos} tipos inseridos (${TIPOS_PADRAO.length - inseridos} já existiam)`);
    }

    log(`\nConcluído: ${new Date().toISOString()}`);
    process.exit(0);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    log(`FATAL: ${err.message}\n${err.stack}`);
    process.exit(1);
  } finally {
    client.release();
  }
})();
