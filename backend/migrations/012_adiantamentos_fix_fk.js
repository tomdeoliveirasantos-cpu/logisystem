require('dotenv').config({ path: 'C:\\Desenvolvimento\\logisystem\\backend\\.env' });
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const p = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });

// Helper: descobre o tipo da PK 'id' de uma tabela
async function pkType(client, table) {
  const { rows } = await client.query(
    `SELECT data_type, udt_name
       FROM information_schema.columns
      WHERE table_schema='public' AND table_name=$1 AND column_name='id'`, [table]
  );
  if (!rows.length) return null;
  // udt_name dá o tipo SQL real (int4 / int8)
  if (rows[0].udt_name === 'int8') return 'BIGINT';
  if (rows[0].udt_name === 'int4') return 'INTEGER';
  return rows[0].data_type.toUpperCase();
}

async function run() {
  const log = [];
  const append = (msg) => { console.log(msg); log.push(msg); };
  const client = await p.connect();

  try {
    append('=== MIGRATION 012 - Fix tipos FK em logi_adiantamentos ===');
    append(`Iniciado em ${new Date().toISOString()}\n`);

    // ── 0. Descobrir tipos das tabelas referenciadas ──
    append('--- 0. Inspecionando tipos das PKs ---');
    const tipos = {
      motoristas:  await pkType(client, 'logi_motoristas'),
      ajudantes:   await pkType(client, 'logi_ajudantes'),
      veiculos:    await pkType(client, 'logi_veiculos'),
      ordens:      await pkType(client, 'logi_ordens_transporte'),
      contasPagar: await pkType(client, 'logi_contas_pagar'),
      usuarios:    await pkType(client, 'logi_usuarios'),
    };
    Object.entries(tipos).forEach(([k, v]) => append(`  ${k.padEnd(14)} → ${v}`));

    await client.query('BEGIN');

    // ── 1. Dropar tabela parcial criada pela 011 ──
    append('\n--- 1. Removendo logi_adiantamentos parcial (se existir) ---');
    await client.query(`DROP TABLE IF EXISTS logi_adiantamentos CASCADE`);
    append('  ✓ drop concluído');

    // ── 2. Criar tabela base SEM FKs (passo 1) ──
    append('\n--- 2. Criando logi_adiantamentos (sem FKs) ---');
    await client.query(`
      CREATE TABLE logi_adiantamentos (
        id                SERIAL PRIMARY KEY,
        tipo_beneficiario VARCHAR(20) NOT NULL,
        motorista_id      ${tipos.motoristas || 'INTEGER'},
        ajudante_id       ${tipos.ajudantes  || 'INTEGER'},
        veiculo_id        ${tipos.veiculos   || 'INTEGER'},
        ordem_id          ${tipos.ordens     || 'INTEGER'},
        valor             NUMERIC(12,2) NOT NULL CHECK (valor > 0),
        data_adiantamento DATE NOT NULL DEFAULT CURRENT_DATE,
        forma_pagamento   VARCHAR(30),
        comprovante_nome  VARCHAR(255),
        comprovante_path  VARCHAR(255),
        status            VARCHAR(20) NOT NULL DEFAULT 'pendente',
        valor_descontado  NUMERIC(12,2) NOT NULL DEFAULT 0,
        conta_pagar_id    ${tipos.contasPagar || 'INTEGER'},
        cp_acerto_id      ${tipos.contasPagar || 'INTEGER'},
        observacao        TEXT,
        criado_por        ${tipos.usuarios   || 'INTEGER'},
        criado_em         TIMESTAMP NOT NULL DEFAULT NOW(),
        atualizado_em     TIMESTAMP NOT NULL DEFAULT NOW(),
        CONSTRAINT chk_adto_tipo CHECK (
          tipo_beneficiario IN ('motorista_proprio','motorista_terceiro','ajudante')
        ),
        CONSTRAINT chk_adto_status CHECK (
          status IN ('pendente','descontado','cancelado')
        ),
        CONSTRAINT chk_adto_motorista CHECK (
          tipo_beneficiario = 'ajudante' OR motorista_id IS NOT NULL
        ),
        CONSTRAINT chk_adto_terceiro_veiculo CHECK (
          tipo_beneficiario <> 'motorista_terceiro' OR veiculo_id IS NOT NULL
        ),
        CONSTRAINT chk_adto_ajudante CHECK (
          tipo_beneficiario <> 'ajudante' OR ajudante_id IS NOT NULL
        )
      )
    `);
    append('  ✓ tabela criada');

    // ── 3. Adicionar FKs uma a uma ──
    append('\n--- 3. Adicionando foreign keys ---');
    const fks = [
      ['motorista_id',   'logi_motoristas',        tipos.motoristas],
      ['ajudante_id',    'logi_ajudantes',         tipos.ajudantes],
      ['veiculo_id',     'logi_veiculos',          tipos.veiculos],
      ['ordem_id',       'logi_ordens_transporte', tipos.ordens],
      ['conta_pagar_id', 'logi_contas_pagar',      tipos.contasPagar],
      ['cp_acerto_id',   'logi_contas_pagar',      tipos.contasPagar],
      ['criado_por',     'logi_usuarios',          tipos.usuarios],
    ];
    for (const [col, ref, tipo] of fks) {
      if (!tipo) {
        append(`  ⚠ ${col} → ${ref}: tabela não encontrada, FK ignorada`);
        continue;
      }
      const fkName = `fk_adto_${col}`;
      await client.query(
        `ALTER TABLE logi_adiantamentos
           ADD CONSTRAINT ${fkName}
           FOREIGN KEY (${col}) REFERENCES ${ref}(id) ON DELETE SET NULL`
      );
      append(`  ✓ ${col} → ${ref}(id)  [${tipo}]`);
    }

    // ── 4. Índices ──
    append('\n--- 4. Índices ---');
    const idx = [
      ['idx_adto_motorista', 'motorista_id'],
      ['idx_adto_ajudante',  'ajudante_id'],
      ['idx_adto_veiculo',   'veiculo_id'],
      ['idx_adto_status',    'status'],
      ['idx_adto_data',      'data_adiantamento'],
      ['idx_adto_cp',        'conta_pagar_id'],
    ];
    for (const [name, col] of idx) {
      await client.query(`CREATE INDEX IF NOT EXISTS ${name} ON logi_adiantamentos(${col})`);
      append(`  ✓ ${name}`);
    }

    // ── 5. Trigger de atualizado_em ──
    append('\n--- 5. Trigger atualizado_em ---');
    await client.query(`
      CREATE OR REPLACE FUNCTION fn_logi_adto_atualizado()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.atualizado_em = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    await client.query(`DROP TRIGGER IF EXISTS tg_logi_adto_atualizado ON logi_adiantamentos`);
    await client.query(`
      CREATE TRIGGER tg_logi_adto_atualizado
        BEFORE UPDATE ON logi_adiantamentos
        FOR EACH ROW EXECUTE FUNCTION fn_logi_adto_atualizado()
    `);
    await client.query(`DROP TRIGGER IF EXISTS tg_logi_ajud_atualizado ON logi_ajudantes`);
    await client.query(`
      CREATE TRIGGER tg_logi_ajud_atualizado
        BEFORE UPDATE ON logi_ajudantes
        FOR EACH ROW EXECUTE FUNCTION fn_logi_adto_atualizado()
    `);
    append('  ✓ triggers prontas');

    // ── 6. Verificação ──
    append('\n--- 6. Verificação final ---');
    const cols = await client.query(
      `SELECT column_name, udt_name FROM information_schema.columns
        WHERE table_schema='public' AND table_name='logi_adiantamentos'
          AND column_name LIKE '%_id' OR column_name = 'criado_por'`
    );
    cols.rows.forEach(c => append(`  ${c.column_name.padEnd(20)} → ${c.udt_name}`));
    const fkCount = await client.query(
      `SELECT COUNT(*)::int c FROM pg_constraint
        WHERE conrelid = 'logi_adiantamentos'::regclass AND contype = 'f'`
    );
    append(`\n  Total de FKs em logi_adiantamentos: ${fkCount.rows[0].c}`);

    await client.query('COMMIT');
    append('\n--- COMMIT realizado ---');
    append('\n=== MIGRATION_012_COMPLETE ===');
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    append(`\n!!! MIGRATION_ERROR: ${e.message}`);
    append(e.stack);
  } finally {
    client.release();
    await p.end();
    fs.writeFileSync(path.join(__dirname, 'migrate-012.log'), log.join('\n'));
    process.exit(0);
  }
}
run();
