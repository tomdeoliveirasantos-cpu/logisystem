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
    append('=== MIGRATION 013 - Reset definitivo logi_adiantamentos (INTEGER) ===');
    append(`Iniciado em ${new Date().toISOString()}\n`);

    // Inspeciona tipo real da PK de motoristas pra confirmar antes
    append('--- 0. Confirmando tipo real de logi_motoristas.id ---');
    const r0 = await client.query(`
      SELECT data_type, udt_name, column_default
        FROM information_schema.columns
       WHERE table_schema='public' AND table_name='logi_motoristas' AND column_name='id'
    `);
    if (r0.rows.length) {
      append(`  data_type=${r0.rows[0].data_type}  udt_name=${r0.rows[0].udt_name}  default=${r0.rows[0].column_default}`);
    } else {
      append('  ⚠ coluna id não encontrada em logi_motoristas');
    }

    // Pega o udt_name para usar exatamente o mesmo tipo
    const idType = r0.rows[0]?.udt_name === 'int4' ? 'INTEGER'
                 : r0.rows[0]?.udt_name === 'int8' ? 'BIGINT'
                 : 'INTEGER'; // fallback
    append(`  → usando ${idType} para as FKs\n`);

    await client.query('BEGIN');

    // 1. Drop tudo
    append('--- 1. Removendo logi_adiantamentos parcial ---');
    await client.query(`DROP TABLE IF EXISTS logi_adiantamentos CASCADE`);
    append('  ✓ drop');

    // 2. Garante logi_ajudantes (pode não existir se a 011 falhou antes de criar)
    append('\n--- 2. Garantindo logi_ajudantes ---');
    await client.query(`
      CREATE TABLE IF NOT EXISTS logi_ajudantes (
        id          SERIAL PRIMARY KEY,
        nome        VARCHAR(150) NOT NULL,
        cpf         VARCHAR(14),
        telefone    VARCHAR(20),
        observacao  TEXT,
        ativo       BOOLEAN NOT NULL DEFAULT TRUE,
        criado_em   TIMESTAMP NOT NULL DEFAULT NOW(),
        atualizado_em TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_ajudantes_nome ON logi_ajudantes(nome)`);
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS uq_ajudantes_cpf ON logi_ajudantes(cpf) WHERE cpf IS NOT NULL AND cpf <> ''`);
    append('  ✓ logi_ajudantes ok');

    // 3. Cria logi_adiantamentos (todas as FKs como INTEGER, mesmo padrão SERIAL do sistema)
    append('\n--- 3. Criando logi_adiantamentos ---');
    await client.query(`
      CREATE TABLE logi_adiantamentos (
        id                SERIAL PRIMARY KEY,
        tipo_beneficiario VARCHAR(20) NOT NULL,
        motorista_id      ${idType},
        ajudante_id       ${idType},
        veiculo_id        ${idType},
        ordem_id          ${idType},
        valor             NUMERIC(12,2) NOT NULL CHECK (valor > 0),
        data_adiantamento DATE NOT NULL DEFAULT CURRENT_DATE,
        forma_pagamento   VARCHAR(30),
        comprovante_nome  VARCHAR(255),
        comprovante_path  VARCHAR(255),
        status            VARCHAR(20) NOT NULL DEFAULT 'pendente',
        valor_descontado  NUMERIC(12,2) NOT NULL DEFAULT 0,
        conta_pagar_id    ${idType},
        cp_acerto_id      ${idType},
        observacao        TEXT,
        criado_por        ${idType},
        criado_em         TIMESTAMP NOT NULL DEFAULT NOW(),
        atualizado_em     TIMESTAMP NOT NULL DEFAULT NOW(),
        CONSTRAINT chk_adto_tipo CHECK (
          tipo_beneficiario IN ('motorista_proprio','motorista_terceiro','ajudante')
        ),
        CONSTRAINT chk_adto_status CHECK (
          status IN ('pendente','descontado','cancelado')
        ),
        CONSTRAINT chk_adto_motorista_id CHECK (
          tipo_beneficiario = 'ajudante' OR motorista_id IS NOT NULL
        ),
        CONSTRAINT chk_adto_terceiro_veiculo CHECK (
          tipo_beneficiario <> 'motorista_terceiro' OR veiculo_id IS NOT NULL
        ),
        CONSTRAINT chk_adto_ajudante_id CHECK (
          tipo_beneficiario <> 'ajudante' OR ajudante_id IS NOT NULL
        )
      )
    `);
    append('  ✓ tabela criada');

    // 4. FKs uma a uma
    append('\n--- 4. Adicionando foreign keys ---');
    const fks = [
      ['motorista_id',   'logi_motoristas'],
      ['ajudante_id',    'logi_ajudantes'],
      ['veiculo_id',     'logi_veiculos'],
      ['ordem_id',       'logi_ordens_transporte'],
      ['conta_pagar_id', 'logi_contas_pagar'],
      ['cp_acerto_id',   'logi_contas_pagar'],
      ['criado_por',     'logi_usuarios'],
    ];
    for (const [col, ref] of fks) {
      const ex = await client.query(
        `SELECT 1 FROM information_schema.tables
          WHERE table_schema='public' AND table_name=$1`, [ref]
      );
      if (!ex.rows.length) {
        append(`  ⚠ ${col} → ${ref}: tabela não existe, ignorada`);
        continue;
      }
      try {
        await client.query(
          `ALTER TABLE logi_adiantamentos
             ADD CONSTRAINT fk_adto_${col}
             FOREIGN KEY (${col}) REFERENCES ${ref}(id) ON DELETE SET NULL`
        );
        append(`  ✓ ${col} → ${ref}(id)`);
      } catch (e) {
        append(`  ✗ ${col} → ${ref}(id): ${e.message}`);
        throw e;
      }
    }

    // 5. Índices
    append('\n--- 5. Índices ---');
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

    // 6. Trigger — CADA statement em chamada separada
    append('\n--- 6. Triggers de atualizado_em ---');
    await client.query(`CREATE OR REPLACE FUNCTION fn_logi_adto_atualizado()
RETURNS TRIGGER AS $$
BEGIN
  NEW.atualizado_em = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql`);
    append('  ✓ função criada');

    await client.query(`DROP TRIGGER IF EXISTS tg_logi_adto_atualizado ON logi_adiantamentos`);
    await client.query(`CREATE TRIGGER tg_logi_adto_atualizado
  BEFORE UPDATE ON logi_adiantamentos
  FOR EACH ROW EXECUTE FUNCTION fn_logi_adto_atualizado()`);
    append('  ✓ trigger logi_adiantamentos');

    await client.query(`DROP TRIGGER IF EXISTS tg_logi_ajud_atualizado ON logi_ajudantes`);
    await client.query(`CREATE TRIGGER tg_logi_ajud_atualizado
  BEFORE UPDATE ON logi_ajudantes
  FOR EACH ROW EXECUTE FUNCTION fn_logi_adto_atualizado()`);
    append('  ✓ trigger logi_ajudantes');

    // 7. Verificação final
    append('\n--- 7. Verificação final ---');
    const fkCount = await client.query(
      `SELECT COUNT(*)::int c FROM pg_constraint
        WHERE conrelid = 'logi_adiantamentos'::regclass AND contype = 'f'`
    );
    append(`  Total de FKs em logi_adiantamentos: ${fkCount.rows[0].c}`);
    const idCol = await client.query(
      `SELECT data_type, udt_name FROM information_schema.columns
        WHERE table_schema='public' AND table_name='logi_adiantamentos' AND column_name='id'`
    );
    append(`  PK id: ${idCol.rows[0].data_type} (${idCol.rows[0].udt_name})`);

    await client.query('COMMIT');
    append('\n--- COMMIT realizado ---');
    append('\n=== MIGRATION_013_COMPLETE ===');
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    append(`\n!!! MIGRATION_ERROR: ${e.message}`);
    append(e.stack || '');
  } finally {
    client.release();
    await p.end();
    fs.writeFileSync(path.join(__dirname, 'migrate-013.log'), log.join('\n'));
    process.exit(0);
  }
}
run();
