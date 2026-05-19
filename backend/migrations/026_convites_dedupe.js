// backend/migrations/026_convites_dedupe.js
// Limpa duplicidades existentes (mantém o convite mais antigo de cada par)
// e adiciona UNIQUE INDEX parcial para impedir novas duplicidades pendentes
// com mesmo nome na mesma org (case-insensitive).

require('dotenv').config({ path: 'C:\\Desenvolvimento\\logisystem\\backend\\.env' });
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false, max: 1 });
const LOG = path.join(__dirname, '..', 'migration_026.log');
fs.writeFileSync(LOG, '');
const log = (m) => { fs.appendFileSync(LOG, m + '\n'); console.log(m); };

(async () => {
  const client = await pool.connect();
  try {
    log('=== Migration 026: dedupe convites + UNIQUE parcial ===');
    log(`Início: ${new Date().toISOString()}\n`);

    await client.query("SET lock_timeout = '5s'");
    await client.query("SET statement_timeout = '15s'");

    // ── PASSO 1: Achar duplicidades pendentes com nome ─────────────
    log('PASSO 1: Detectar e remover duplicidades pendentes...');
    const { rows: groups } = await client.query(
      `SELECT organizacao_id, LOWER(TRIM(nome_motorista)) AS nome_norm, COUNT(*) AS qt
         FROM logi_cadastro_convites
        WHERE status = 'pendente'
          AND nome_motorista IS NOT NULL
          AND TRIM(nome_motorista) <> ''
        GROUP BY organizacao_id, LOWER(TRIM(nome_motorista))
       HAVING COUNT(*) > 1`
    );

    let totalRemovidos = 0;
    for (const g of groups) {
      // Para cada grupo, manter o mais antigo
      const { rows } = await client.query(
        `SELECT id, created_at, nome_motorista
           FROM logi_cadastro_convites
          WHERE organizacao_id = $1
            AND status = 'pendente'
            AND LOWER(TRIM(nome_motorista)) = $2
          ORDER BY created_at ASC`,
        [g.organizacao_id, g.nome_norm]
      );
      const manter = rows[0];
      const remover = rows.slice(1);
      log(`  "${manter.nome_motorista}" (org ${g.organizacao_id.substring(0,8)}): ${rows.length} convites — mantendo ${manter.id}, removendo ${remover.map(r => r.id).join(',')}`);
      for (const r of remover) {
        await client.query('DELETE FROM logi_cadastro_convites WHERE id = $1', [r.id]);
        totalRemovidos++;
      }
    }
    log(`Total removidos: ${totalRemovidos}\n`);

    // ── PASSO 2: Criar UNIQUE INDEX parcial ─────────────────────────
    log('PASSO 2: Criar UNIQUE INDEX parcial para prevenir duplicidades futuras...');
    try {
      await client.query('BEGIN');
      // Dropa se já existir (idempotente)
      await client.query(`DROP INDEX IF EXISTS uq_convites_pendentes_nome`);
      // Cria índice: cada org só pode ter 1 convite pendente por nome (case-insensitive)
      await client.query(`
        CREATE UNIQUE INDEX uq_convites_pendentes_nome
          ON logi_cadastro_convites (organizacao_id, LOWER(TRIM(nome_motorista)))
          WHERE status = 'pendente' AND nome_motorista IS NOT NULL AND TRIM(nome_motorista) <> ''
      `);
      await client.query('COMMIT');
      log('  UNIQUE INDEX criado com sucesso.');
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      log(`  ERRO ao criar índice: ${e.message}`);
    }

    log(`\nConcluído: ${new Date().toISOString()}`);
    process.exit(0);
  } catch (err) {
    log(`FATAL: ${err.message}`);
    process.exit(1);
  } finally {
    client.release();
  }
})();
