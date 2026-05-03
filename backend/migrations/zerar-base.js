require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const p = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });

async function run() {
  const log = [];
  const append = (msg) => { console.log(msg); log.push(msg); };
  const client = await p.connect();

  try {
    append(`=== ZERAGEM OT + MOTORISTAS ===`);
    append(`Iniciado em ${new Date().toISOString()}`);

    // Contagem ANTES
    append('\n--- Contagens ANTES ---');
    const tabelas = [
      'logi_ordens_transporte',
      'logi_historico_ordens',
      'logi_contas_pagar',
      'logi_contas_receber',
      'logi_motoristas',
      'logi_motorista_cadastros',
      'logi_cadastro_convites',
    ];
    const antes = {};
    for (const t of tabelas) {
      try {
        const { rows } = await client.query(`SELECT COUNT(*)::int AS c FROM ${t}`);
        antes[t] = rows[0].c;
        append(`  ${t}: ${rows[0].c}`);
      } catch (e) {
        antes[t] = `ERRO: ${e.message}`;
        append(`  ${t}: ERRO (${e.message})`);
      }
    }

    // Vínculos que serão preservados (ficarão NULL)
    try {
      const { rows: v } = await client.query(
        `SELECT COUNT(*)::int AS c FROM logi_veiculos WHERE motorista_id IS NOT NULL`
      );
      append(`  logi_veiculos com motorista vinculado: ${v[0].c}`);
    } catch (e) { append(`  veiculos: ${e.message}`); }
    try {
      const { rows: m } = await client.query(
        `SELECT COUNT(*)::int AS c FROM logi_multas WHERE motorista_id IS NOT NULL`
      );
      append(`  logi_multas com motorista vinculado: ${m[0].c}`);
    } catch (e) { append(`  multas: ${e.message}`); }
    try {
      const { rows: mt } = await client.query(
        `SELECT COUNT(*)::int AS c FROM logi_manutencoes WHERE motorista_id IS NOT NULL`
      );
      append(`  logi_manutencoes com motorista vinculado: ${mt[0].c}`);
    } catch (e) { append(`  manutencoes: ${e.message}`); }

    // Transação
    append('\n--- Executando zeragem (BEGIN) ---');
    await client.query('BEGIN');

    // 1. Histórico de OTs
    const r1 = await client.query('DELETE FROM logi_historico_ordens');
    append(`  1/10 logi_historico_ordens: ${r1.rowCount} removidos`);

    // 2. CAP vinculado a OT
    const r2 = await client.query('DELETE FROM logi_contas_pagar WHERE ordem_id IS NOT NULL');
    append(`  2/10 logi_contas_pagar (com ordem_id): ${r2.rowCount} removidos`);

    // 3. CAR vinculado a OT
    const r3 = await client.query('DELETE FROM logi_contas_receber WHERE ordem_id IS NOT NULL');
    append(`  3/10 logi_contas_receber (com ordem_id): ${r3.rowCount} removidos`);

    // 4. OTs
    const r4 = await client.query('DELETE FROM logi_ordens_transporte');
    append(`  4/10 logi_ordens_transporte: ${r4.rowCount} removidos`);

    // 5. Desvincular motoristas em veículos
    const r5 = await client.query(
      'UPDATE logi_veiculos SET motorista_id = NULL WHERE motorista_id IS NOT NULL'
    );
    append(`  5/10 logi_veiculos (motorista_id desvinculado): ${r5.rowCount}`);

    // 6. Desvincular motoristas em multas (preserva multa)
    let r6 = { rowCount: 0 };
    try {
      r6 = await client.query(
        'UPDATE logi_multas SET motorista_id = NULL WHERE motorista_id IS NOT NULL'
      );
    } catch (e) { append(`     (logi_multas: ${e.message})`); }
    append(`  6/10 logi_multas (motorista_id desvinculado): ${r6.rowCount}`);

    // 7. Desvincular motoristas em manutenções (preserva manutenção)
    let r7 = { rowCount: 0 };
    try {
      r7 = await client.query(
        'UPDATE logi_manutencoes SET motorista_id = NULL WHERE motorista_id IS NOT NULL'
      );
    } catch (e) { append(`     (logi_manutencoes: ${e.message})`); }
    append(`  7/10 logi_manutencoes (motorista_id desvinculado): ${r7.rowCount}`);

    // 8. Onboarding em andamento
    let r8 = { rowCount: 0 };
    try {
      r8 = await client.query('DELETE FROM logi_motorista_cadastros');
    } catch (e) { append(`     (logi_motorista_cadastros: ${e.message})`); }
    append(`  8/10 logi_motorista_cadastros: ${r8.rowCount} removidos`);

    // 9. Convites públicos
    let r9 = { rowCount: 0 };
    try {
      r9 = await client.query('DELETE FROM logi_cadastro_convites');
    } catch (e) { append(`     (logi_cadastro_convites: ${e.message})`); }
    append(`  9/10 logi_cadastro_convites: ${r9.rowCount} removidos`);

    // 10. Motoristas
    const r10 = await client.query('DELETE FROM logi_motoristas');
    append(` 10/10 logi_motoristas: ${r10.rowCount} removidos`);

    await client.query('COMMIT');
    append('\n--- COMMIT realizado ---');

    // Resetar sequences (IDs começam em 1 de novo)
    append('\n--- Resetando sequences ---');
    const seqs = [
      'logi_ordens_transporte_id_seq',
      'logi_motoristas_id_seq',
      'logi_historico_ordens_id_seq',
      'logi_motorista_cadastros_id_seq',
      'logi_cadastro_convites_id_seq',
    ];
    for (const s of seqs) {
      try {
        await client.query(`ALTER SEQUENCE ${s} RESTART WITH 1`);
        append(`  ${s}: reiniciado`);
      } catch (e) {
        append(`  ${s}: ${e.message}`);
      }
    }

    // Contagem DEPOIS
    append('\n--- Contagens DEPOIS ---');
    for (const t of tabelas) {
      try {
        const { rows } = await client.query(`SELECT COUNT(*)::int AS c FROM ${t}`);
        append(`  ${t}: ${rows[0].c}`);
      } catch (e) {
        append(`  ${t}: ERRO`);
      }
    }

    append('\n=== ZERAGEM_COMPLETE ===');
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    append(`\n!!! ZERAGEM_ERROR: ${e.message}`);
    append(`!!! ROLLBACK executado — nenhuma alteração persistida.`);
    append(e.stack);
  } finally {
    client.release();
    await p.end();
    fs.writeFileSync(path.join(__dirname, 'zerar-base.log'), log.join('\n'));
    process.exit(0);
  }
}
run();
