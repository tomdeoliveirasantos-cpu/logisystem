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
    append('=== MIGRATION 015 - Triggers atualizado_em (EXECUTE PROCEDURE) ===');
    append(`Iniciado em ${new Date().toISOString()}\n`);

    // Confirma versão do PostgreSQL
    const v = await client.query(`SELECT version()`);
    append(`PostgreSQL: ${v.rows[0].version}\n`);

    await client.query('BEGIN');

    // 1. Garantir a função (idempotente)
    append('--- 1. Função fn_logi_adto_atualizado ---');
    await client.query(`CREATE OR REPLACE FUNCTION fn_logi_adto_atualizado()
RETURNS TRIGGER AS $$
BEGIN
  NEW.atualizado_em = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql`);
    append('  ✓ função pronta');

    // 2. Trigger logi_adiantamentos (usando EXECUTE PROCEDURE — compat pg<11)
    append('\n--- 2. Trigger em logi_adiantamentos ---');
    await client.query(`DROP TRIGGER IF EXISTS tg_logi_adto_atualizado ON logi_adiantamentos`);
    await client.query(`CREATE TRIGGER tg_logi_adto_atualizado
  BEFORE UPDATE ON logi_adiantamentos
  FOR EACH ROW EXECUTE PROCEDURE fn_logi_adto_atualizado()`);
    append('  ✓ trigger criada');

    // 3. Trigger logi_ajudantes
    append('\n--- 3. Trigger em logi_ajudantes ---');
    await client.query(`DROP TRIGGER IF EXISTS tg_logi_ajud_atualizado ON logi_ajudantes`);
    await client.query(`CREATE TRIGGER tg_logi_ajud_atualizado
  BEFORE UPDATE ON logi_ajudantes
  FOR EACH ROW EXECUTE PROCEDURE fn_logi_adto_atualizado()`);
    append('  ✓ trigger criada');

    // 4. Verificação
    append('\n--- 4. Verificação ---');
    const trs = await client.query(`
      SELECT tgname, tgrelid::regclass AS tabela
        FROM pg_trigger
       WHERE tgname IN ('tg_logi_adto_atualizado','tg_logi_ajud_atualizado')
       ORDER BY tgname
    `);
    trs.rows.forEach(t => append(`  ✓ ${t.tgname} em ${t.tabela}`));

    const fkCount = await client.query(
      `SELECT COUNT(*)::int c FROM pg_constraint
        WHERE conrelid = 'logi_adiantamentos'::regclass AND contype = 'f'`
    );
    append(`\n  logi_adiantamentos: ${fkCount.rows[0].c} FKs ativas`);

    await client.query('COMMIT');
    append('\n--- COMMIT realizado ---');
    append('\n=== MIGRATION_015_COMPLETE ===');
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    append(`\n!!! MIGRATION_ERROR: ${e.message}`);
    append(e.stack || '');
  } finally {
    client.release();
    await p.end();
    fs.writeFileSync(path.join(__dirname, 'migrate-015.log'), log.join('\n'));
    process.exit(0);
  }
}
run();
