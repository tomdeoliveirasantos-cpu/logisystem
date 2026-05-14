require('dotenv').config({ path: 'C:\\Desenvolvimento\\logisystem\\backend\\.env' });
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const p = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });

// Colunas a adicionar em logi_ordem_paradas
const COLS_PARADAS = [
  ['motivo_nao_entrega',     'TEXT'],
  ['data_tentativa',         'TIMESTAMP'],
  ['marcado_por',            'TEXT'],          // 'admin:<userid>' ou 'motorista:<motoristaid>'
  ['observacao',             'TEXT'],
  ['foto_path',              'TEXT'],
  ['foto_nome',              'TEXT'],
  ['assinatura_path',        'TEXT'],
  ['nome_recebedor',         'TEXT'],
  ['reentrega_origem_id',    'INTEGER'],       // FK para logi_ordem_paradas.id (int4)
  ['tentativa_numero',       'INTEGER DEFAULT 1'],
];

// Colunas a adicionar em logi_motoristas
const COLS_MOTORISTAS = [
  ['cpf',                    'VARCHAR(14)'],
  ['senha_hash',             'TEXT'],
  ['senha_resetada',         'BOOLEAN DEFAULT false'],   // se true, força troca no 1º login
  ['ultimo_login',           'TIMESTAMP'],
];

(async () => {
  const out = [];
  const log = (m) => { console.log(m); out.push(m); };
  const client = await p.connect();
  try {
    await client.query('BEGIN');
    log('=== MIGRATION 020 - Entregas + Auth Motorista ===');
    log(`Iniciado em ${new Date().toISOString()}\n`);

    // ── 1. Colunas em logi_ordem_paradas ──
    log('--- 1. logi_ordem_paradas ---');
    for (const [col, type] of COLS_PARADAS) {
      const has = await client.query(
        `SELECT 1 FROM information_schema.columns
          WHERE table_schema='public' AND table_name='logi_ordem_paradas' AND column_name=$1`, [col]
      );
      if (has.rows.length) {
        log(`  ✓ ${col} já existe`);
      } else {
        await client.query(`ALTER TABLE logi_ordem_paradas ADD COLUMN ${col} ${type}`);
        log(`  ✓ ${col} adicionada (${type})`);
      }
    }

    // ── 2. FK reentrega_origem_id ──
    log('\n--- 2. FK reentrega_origem_id ---');
    const fkExists = await client.query(`
      SELECT 1 FROM information_schema.table_constraints
       WHERE constraint_name='fk_parada_reentrega_origem'
         AND table_name='logi_ordem_paradas'`);
    if (fkExists.rows.length) {
      log('  ✓ FK já existe');
    } else {
      await client.query(`
        ALTER TABLE logi_ordem_paradas
          ADD CONSTRAINT fk_parada_reentrega_origem
          FOREIGN KEY (reentrega_origem_id) REFERENCES logi_ordem_paradas(id) ON DELETE SET NULL
      `);
      log('  ✓ FK criada');
    }

    // ── 3. Constraint CHECK do status (5 valores válidos) ──
    log('\n--- 3. CHECK constraint status ---');
    // Primeiro, garante que não há status inválido (atualiza pra "pendente" se houver)
    await client.query(`UPDATE logi_ordem_paradas
       SET status = 'pendente'
       WHERE status NOT IN ('pendente','entregue','nao_entregue','reentrega','cancelada')
          OR status IS NULL`);
    // Remove constraint antigo se existir
    await client.query(`ALTER TABLE logi_ordem_paradas DROP CONSTRAINT IF EXISTS chk_parada_status`);
    await client.query(`
      ALTER TABLE logi_ordem_paradas
        ADD CONSTRAINT chk_parada_status
        CHECK (status IN ('pendente','entregue','nao_entregue','reentrega','cancelada'))
    `);
    log('  ✓ CHECK constraint aplicado');

    // ── 4. Índices auxiliares ──
    log('\n--- 4. Índices ---');
    await client.query(`CREATE INDEX IF NOT EXISTS idx_paradas_ordem_status ON logi_ordem_paradas(ordem_id, status)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_paradas_status ON logi_ordem_paradas(status)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_paradas_reentrega_origem ON logi_ordem_paradas(reentrega_origem_id)`);
    log('  ✓ idx_paradas_ordem_status, idx_paradas_status, idx_paradas_reentrega_origem');

    // ── 5. Colunas em logi_motoristas ──
    log('\n--- 5. logi_motoristas ---');
    for (const [col, type] of COLS_MOTORISTAS) {
      const has = await client.query(
        `SELECT 1 FROM information_schema.columns
          WHERE table_schema='public' AND table_name='logi_motoristas' AND column_name=$1`, [col]
      );
      if (has.rows.length) {
        log(`  ✓ ${col} já existe`);
      } else {
        await client.query(`ALTER TABLE logi_motoristas ADD COLUMN ${col} ${type}`);
        log(`  ✓ ${col} adicionada (${type})`);
      }
    }

    // ── 6. Índice único no CPF (apenas onde não-nulo) ──
    log('\n--- 6. Índice único CPF ---');
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS uniq_motoristas_cpf
                          ON logi_motoristas(cpf) WHERE cpf IS NOT NULL`);
    log('  ✓ uniq_motoristas_cpf criado');

    await client.query('COMMIT');
    log('\n=== MIGRATION_020_COMPLETE ===');
  } catch (e) {
    await client.query('ROLLBACK').catch(()=>{});
    log('!!! ERRO: ' + e.message);
    log(e.stack || '');
  } finally {
    client.release();
    await p.end();
    fs.writeFileSync(path.join(__dirname,'migrate-020.log'), out.join('\n'));
    process.exit(0);
  }
})();
