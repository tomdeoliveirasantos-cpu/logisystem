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
    append(`=== MIGRATION 006 - OT por rota + paradas filhas ===`);
    append(`Iniciado em ${new Date().toISOString()}\n`);

    await client.query('BEGIN');

    // ── 1. Tabela logi_ordem_paradas ─────────────────────
    append('--- Etapa 1: Criar tabela logi_ordem_paradas ---');
    await client.query(`
      CREATE TABLE IF NOT EXISTS logi_ordem_paradas (
        id SERIAL PRIMARY KEY,
        ordem_id INTEGER NOT NULL REFERENCES logi_ordens_transporte(id) ON DELETE CASCADE,
        seq INTEGER NOT NULL DEFAULT 1,
        codigo_local VARCHAR(50),
        cliente_nome VARCHAR(255),
        endereco TEXT,
        regiao VARCHAR(100),
        peso NUMERIC(12,3),
        pedido VARCHAR(50),
        remessa VARCHAR(50),
        nf VARCHAR(50),
        latitude NUMERIC(10,7),
        longitude NUMERIC(10,7),
        obs TEXT,
        status VARCHAR(20) DEFAULT 'pendente',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    append('  ✓ logi_ordem_paradas criada');

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_paradas_ordem ON logi_ordem_paradas(ordem_id);
      CREATE UNIQUE INDEX IF NOT EXISTS uq_paradas_remessa ON logi_ordem_paradas(remessa)
        WHERE remessa IS NOT NULL AND remessa <> '';
    `);
    append('  ✓ índices criados (idx_paradas_ordem, uq_paradas_remessa)');

    // ── 2. Novas colunas em logi_ordens_transporte ───────
    append('\n--- Etapa 2: Novas colunas em logi_ordens_transporte ---');
    const colsNovas = [
      ['tipo_frota', "VARCHAR(20)"],         // 'proprio' | 'agregado' | 'terceiro'
      ['quant_entregas', 'INTEGER'],          // estimativa, sobrescrita pela importação
      ['ajudante_extra', 'NUMERIC(12,2) DEFAULT 0'],  // valor R$ (substitui ajudante_nome)
    ];
    for (const [col, type] of colsNovas) {
      await client.query(
        `ALTER TABLE logi_ordens_transporte ADD COLUMN IF NOT EXISTS ${col} ${type}`
      );
      append(`  ✓ ${col} ${type}`);
    }

    // ── 3. Drop UNIQUE em remessa de ordens (migrou pra paradas) ──
    append('\n--- Etapa 3: Remover constraint UNIQUE em remessa de ordens ---');
    await client.query(`DROP INDEX IF EXISTS uq_ordens_remessa`);
    append('  ✓ uq_ordens_remessa removido (remessa agora é em paradas)');

    // ── 4. Status_cadastro em motoristas e veículos ──────
    append('\n--- Etapa 4: status_cadastro em motoristas e veículos ---');
    await client.query(`
      ALTER TABLE logi_motoristas
        ADD COLUMN IF NOT EXISTS status_cadastro VARCHAR(20) DEFAULT 'completo'
    `);
    append('  ✓ logi_motoristas.status_cadastro');
    await client.query(`
      ALTER TABLE logi_veiculos
        ADD COLUMN IF NOT EXISTS status_cadastro VARCHAR(20) DEFAULT 'completo'
    `);
    append('  ✓ logi_veiculos.status_cadastro');

    // ── 5. Novos campos motorista (Validade CNH, Endereço, Contatos, Categoria) ──
    append('\n--- Etapa 5: Novos campos em logi_motoristas ---');
    const motCols = [
      ['cnh_validade', 'DATE'],
      ['cnh_categoria', 'VARCHAR(10)'],
      ['cnh_arquivo_path', 'VARCHAR(255)'],
      ['cnh_arquivo_nome', 'VARCHAR(255)'],
      ['endereco_cep', 'VARCHAR(10)'],
      ['endereco_logradouro', 'VARCHAR(255)'],
      ['endereco_numero', 'VARCHAR(20)'],
      ['endereco_complemento', 'VARCHAR(100)'],
      ['endereco_bairro', 'VARCHAR(100)'],
      ['endereco_cidade', 'VARCHAR(100)'],
      ['endereco_estado', 'VARCHAR(2)'],
      ['contato_esposa', 'VARCHAR(50)'],
      ['contato_pai', 'VARCHAR(50)'],
      ['contato_mae', 'VARCHAR(50)'],
      ['contato_outro_nome', 'VARCHAR(100)'],
      ['contato_outro_telefone', 'VARCHAR(50)'],
    ];
    for (const [col, type] of motCols) {
      await client.query(
        `ALTER TABLE logi_motoristas ADD COLUMN IF NOT EXISTS ${col} ${type}`
      );
    }
    append(`  ✓ ${motCols.length} colunas adicionadas em logi_motoristas`);

    // ── 6. Novos campos veículo (Proprietário, Responsável, CRLV) ──
    append('\n--- Etapa 6: Novos campos em logi_veiculos ---');
    const vcCols = [
      ['proprietario', 'VARCHAR(255)'],
      ['responsavel', 'VARCHAR(255)'],
      ['crlv_arquivo_path', 'VARCHAR(255)'],
      ['crlv_arquivo_nome', 'VARCHAR(255)'],
    ];
    for (const [col, type] of vcCols) {
      await client.query(
        `ALTER TABLE logi_veiculos ADD COLUMN IF NOT EXISTS ${col} ${type}`
      );
    }
    append(`  ✓ ${vcCols.length} colunas adicionadas em logi_veiculos`);

    // ── 7. Backfill: tipo_frota baseado em ag_ft do veículo (caso haja OTs antigas) ──
    append('\n--- Etapa 7: Backfill tipo_frota (a partir do veículo) ---');
    const r7 = await client.query(`
      UPDATE logi_ordens_transporte ot
      SET tipo_frota = CASE
        WHEN v.ag_ft = 'frota' THEN 'proprio'
        WHEN v.ag_ft = 'agregado' THEN 'agregado'
        ELSE 'terceiro'
      END
      FROM logi_veiculos v
      WHERE ot.veiculo_id = v.id AND ot.tipo_frota IS NULL
    `);
    append(`  ✓ ${r7.rowCount} OTs atualizadas com tipo_frota inferido`);

    await client.query('COMMIT');
    append('\n--- COMMIT realizado ---');

    // ── Diagnóstico final ────────────────────────────────
    append('\n--- Verificação final ---');
    const checks = [
      ["Tabela paradas existe", "SELECT COUNT(*) c FROM information_schema.tables WHERE table_name='logi_ordem_paradas'"],
      ["Coluna tipo_frota", "SELECT COUNT(*) c FROM information_schema.columns WHERE table_name='logi_ordens_transporte' AND column_name='tipo_frota'"],
      ["Coluna quant_entregas", "SELECT COUNT(*) c FROM information_schema.columns WHERE table_name='logi_ordens_transporte' AND column_name='quant_entregas'"],
      ["Coluna ajudante_extra", "SELECT COUNT(*) c FROM information_schema.columns WHERE table_name='logi_ordens_transporte' AND column_name='ajudante_extra'"],
      ["Coluna status_cadastro motoristas", "SELECT COUNT(*) c FROM information_schema.columns WHERE table_name='logi_motoristas' AND column_name='status_cadastro'"],
      ["Coluna status_cadastro veiculos", "SELECT COUNT(*) c FROM information_schema.columns WHERE table_name='logi_veiculos' AND column_name='status_cadastro'"],
      ["Coluna cnh_validade", "SELECT COUNT(*) c FROM information_schema.columns WHERE table_name='logi_motoristas' AND column_name='cnh_validade'"],
      ["Coluna proprietario veiculo", "SELECT COUNT(*) c FROM information_schema.columns WHERE table_name='logi_veiculos' AND column_name='proprietario'"],
    ];
    for (const [label, sql] of checks) {
      const { rows } = await client.query(sql);
      append(`  ${rows[0].c > 0 ? '✓' : '✗'} ${label}: ${rows[0].c}`);
    }

    append('\n=== MIGRATION_006_COMPLETE ===');
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    append(`\n!!! MIGRATION_ERROR: ${e.message}`);
    append(`!!! ROLLBACK executado.`);
    append(e.stack);
  } finally {
    client.release();
    await p.end();
    fs.writeFileSync(path.join(__dirname, 'migrate-006.log'), log.join('\n'));
    process.exit(0);
  }
}
run();
