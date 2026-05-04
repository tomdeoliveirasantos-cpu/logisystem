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
    append('=== MIGRATION 008 - Abolir "agregado", consolidar em "terceiro" ===');
    append(`Iniciado em ${new Date().toISOString()}\n`);

    await client.query('BEGIN');

    // ── 1. logi_veiculos.ag_ft: 'agregado' → 'terceiro' ──
    append('--- 1. logi_veiculos.ag_ft ---');
    const r1 = await client.query(
      `UPDATE logi_veiculos SET ag_ft='terceiro' WHERE ag_ft='agregado'`
    );
    append(`  ✓ ${r1.rowCount} veículos atualizados (agregado → terceiro)`);

    // ── 2. logi_motoristas.tipo_colaborador: 'motorista_agregado' → 'motorista_terceiro' ──
    append('\n--- 2. logi_motoristas.tipo_colaborador ---');
    const r2 = await client.query(
      `UPDATE logi_motoristas SET tipo_colaborador='motorista_terceiro'
       WHERE tipo_colaborador='motorista_agregado'`
    );
    append(`  ✓ ${r2.rowCount} motoristas atualizados`);

    // ── 3. logi_motorista_cadastros.tipo_colaborador (onboarding) ──
    append('\n--- 3. logi_motorista_cadastros.tipo_colaborador ---');
    const r3 = await client.query(
      `UPDATE logi_motorista_cadastros SET tipo_colaborador='motorista_terceiro'
       WHERE tipo_colaborador='motorista_agregado'`
    );
    append(`  ✓ ${r3.rowCount} cadastros públicos atualizados`);

    // ── 4. logi_ordens_transporte.tipo_frota: 'agregado' → 'terceiro' ──
    append('\n--- 4. logi_ordens_transporte.tipo_frota ---');
    const r4 = await client.query(
      `UPDATE logi_ordens_transporte SET tipo_frota='terceiro'
       WHERE tipo_frota='agregado'`
    );
    append(`  ✓ ${r4.rowCount} OTs atualizadas`);

    // ── 5. logi_contas_pagar.tipo_lancamento: 'frete_agregado' → 'frete_terceiro' ──
    append('\n--- 5. logi_contas_pagar.tipo_lancamento ---');
    const r5 = await client.query(
      `UPDATE logi_contas_pagar SET tipo_lancamento='frete_terceiro'
       WHERE tipo_lancamento='frete_agregado'`
    );
    append(`  ✓ ${r5.rowCount} lançamentos CAP atualizados`);

    // ── 6. logi_tabela_fretes.tipo_frete: 'agregado' → 'terceiro' ──
    append('\n--- 6. logi_tabela_fretes.tipo_frete ---');
    try {
      const r6 = await client.query(
        `UPDATE logi_tabela_fretes SET tipo_frete='terceiro'
         WHERE tipo_frete='agregado'`
      );
      append(`  ✓ ${r6.rowCount} entradas de tabela de fretes atualizadas`);
    } catch (e) {
      append(`  ⚠ erro (campo pode não existir): ${e.message}`);
    }

    // ── 7. (opcional) Atualizar descrições históricas em CAP ──
    append('\n--- 7. Descrições históricas em logi_contas_pagar ---');
    const r7 = await client.query(
      `UPDATE logi_contas_pagar
       SET descricao = REPLACE(descricao, 'Frete agregado', 'Frete terceiro')
       WHERE descricao LIKE '%Frete agregado%'`
    );
    append(`  ✓ ${r7.rowCount} descrições atualizadas`);

    // ── 8. Verificação ──
    append('\n--- 8. Verificação (não deve sobrar nenhum "agregado") ---');
    const checks = [
      ['veiculos com ag_ft=agregado', `SELECT COUNT(*)::int c FROM logi_veiculos WHERE ag_ft='agregado'`],
      ['motoristas com tipo=motorista_agregado', `SELECT COUNT(*)::int c FROM logi_motoristas WHERE tipo_colaborador='motorista_agregado'`],
      ['ordens com tipo_frota=agregado', `SELECT COUNT(*)::int c FROM logi_ordens_transporte WHERE tipo_frota='agregado'`],
      ['cap com tipo=frete_agregado', `SELECT COUNT(*)::int c FROM logi_contas_pagar WHERE tipo_lancamento='frete_agregado'`],
    ];
    for (const [label, sql] of checks) {
      const { rows } = await client.query(sql);
      append(`  ${rows[0].c === 0 ? '✓' : '✗'} ${label}: ${rows[0].c}`);
    }

    await client.query('COMMIT');
    append('\n--- COMMIT realizado ---');
    append('\n=== MIGRATION_008_COMPLETE ===');
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    append(`\n!!! MIGRATION_ERROR: ${e.message}`);
    append(e.stack);
  } finally {
    client.release();
    await p.end();
    fs.writeFileSync(path.join(__dirname, 'migrate-008.log'), log.join('\n'));
    process.exit(0);
  }
}
run();
