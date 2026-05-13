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
    append('=== MIGRATION 011 - Adiantamentos a colaboradores e terceiros ===');
    append(`Iniciado em ${new Date().toISOString()}\n`);

    await client.query('BEGIN');

    // ── 1. Tabela logi_ajudantes (cadastro mínimo) ──
    append('--- 1. Criando tabela logi_ajudantes ---');
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
    append('  ✓ logi_ajudantes pronta');

    // ── 2. Tabela logi_adiantamentos ──
    append('\n--- 2. Criando tabela logi_adiantamentos ---');
    await client.query(`
      CREATE TABLE IF NOT EXISTS logi_adiantamentos (
        id                SERIAL PRIMARY KEY,

        tipo_beneficiario VARCHAR(20) NOT NULL,
        -- 'motorista_proprio' | 'motorista_terceiro' | 'ajudante'

        motorista_id      INTEGER REFERENCES logi_motoristas(id) ON DELETE SET NULL,
        ajudante_id       INTEGER REFERENCES logi_ajudantes(id)  ON DELETE SET NULL,
        veiculo_id        INTEGER REFERENCES logi_veiculos(id)   ON DELETE SET NULL,

        ordem_id          INTEGER REFERENCES logi_ordens_transporte(id) ON DELETE SET NULL,

        valor             NUMERIC(12,2) NOT NULL CHECK (valor > 0),
        data_adiantamento DATE NOT NULL DEFAULT CURRENT_DATE,
        forma_pagamento   VARCHAR(30),
        -- 'pix' | 'dinheiro' | 'transferencia' | 'cartao' | 'outro'

        comprovante_nome  VARCHAR(255),
        comprovante_path  VARCHAR(255),

        status            VARCHAR(20) NOT NULL DEFAULT 'pendente',
        -- 'pendente' | 'descontado' | 'cancelado'

        valor_descontado  NUMERIC(12,2) NOT NULL DEFAULT 0,
        conta_pagar_id    INTEGER REFERENCES logi_contas_pagar(id) ON DELETE SET NULL,
        -- CP gerada automaticamente quando o adiantamento é criado (saída de caixa)

        cp_acerto_id      INTEGER REFERENCES logi_contas_pagar(id) ON DELETE SET NULL,
        -- CP onde o adiantamento foi descontado (acerto do frete/salário)

        observacao        TEXT,
        criado_por        INTEGER REFERENCES logi_usuarios(id) ON DELETE SET NULL,
        criado_em         TIMESTAMP NOT NULL DEFAULT NOW(),
        atualizado_em     TIMESTAMP NOT NULL DEFAULT NOW(),

        CONSTRAINT chk_adto_tipo CHECK (
          tipo_beneficiario IN ('motorista_proprio','motorista_terceiro','ajudante')
        ),
        CONSTRAINT chk_adto_status CHECK (
          status IN ('pendente','descontado','cancelado')
        ),
        -- Motorista (próprio ou terceiro) exige motorista_id
        CONSTRAINT chk_adto_motorista CHECK (
          tipo_beneficiario = 'ajudante' OR motorista_id IS NOT NULL
        ),
        -- Terceiro exige placa (veículo)
        CONSTRAINT chk_adto_terceiro_veiculo CHECK (
          tipo_beneficiario <> 'motorista_terceiro' OR veiculo_id IS NOT NULL
        ),
        -- Ajudante exige ajudante_id
        CONSTRAINT chk_adto_ajudante CHECK (
          tipo_beneficiario <> 'ajudante' OR ajudante_id IS NOT NULL
        )
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_adto_motorista ON logi_adiantamentos(motorista_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_adto_ajudante  ON logi_adiantamentos(ajudante_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_adto_veiculo   ON logi_adiantamentos(veiculo_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_adto_status    ON logi_adiantamentos(status)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_adto_data      ON logi_adiantamentos(data_adiantamento)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_adto_cp        ON logi_adiantamentos(conta_pagar_id)`);
    append('  ✓ logi_adiantamentos pronta');

    // ── 3. Trigger de atualizado_em em ambas as tabelas ──
    append('\n--- 3. Triggers de atualizado_em ---');
    await client.query(`
      CREATE OR REPLACE FUNCTION fn_logi_adto_atualizado()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.atualizado_em = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    await client.query(`
      DROP TRIGGER IF EXISTS tg_logi_adto_atualizado ON logi_adiantamentos;
      CREATE TRIGGER tg_logi_adto_atualizado
        BEFORE UPDATE ON logi_adiantamentos
        FOR EACH ROW EXECUTE FUNCTION fn_logi_adto_atualizado();
    `);
    await client.query(`
      DROP TRIGGER IF EXISTS tg_logi_ajud_atualizado ON logi_ajudantes;
      CREATE TRIGGER tg_logi_ajud_atualizado
        BEFORE UPDATE ON logi_ajudantes
        FOR EACH ROW EXECUTE FUNCTION fn_logi_adto_atualizado();
    `);
    append('  ✓ triggers criadas');

    // ── 4. Verificação ──
    append('\n--- 4. Verificação ---');
    const tabs = await client.query(`
      SELECT table_name FROM information_schema.tables
       WHERE table_schema='public' AND table_name IN ('logi_ajudantes','logi_adiantamentos')
       ORDER BY table_name
    `);
    tabs.rows.forEach(r => append(`  ✓ tabela ${r.table_name}`));

    const cnt = await client.query(`SELECT COUNT(*)::int c FROM logi_adiantamentos`);
    append(`  → registros em logi_adiantamentos: ${cnt.rows[0].c}`);

    await client.query('COMMIT');
    append('\n--- COMMIT realizado ---');
    append('\n=== MIGRATION_011_COMPLETE ===');
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    append(`\n!!! MIGRATION_ERROR: ${e.message}`);
    append(e.stack);
  } finally {
    client.release();
    await p.end();
    fs.writeFileSync(path.join(__dirname, 'migrate-011.log'), log.join('\n'));
    process.exit(0);
  }
}
run();
