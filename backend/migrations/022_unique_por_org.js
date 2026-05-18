require('dotenv').config({ path: 'C:\\Desenvolvimento\\logisystem\\backend\\.env' });
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const p = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });
const LOG = path.join(__dirname, '..', 'migration_022_log.txt');
fs.writeFileSync(LOG, '');
const log = (m) => {
  console.log(m);
  fs.appendFileSync(LOG, m + '\n');
};

/**
 * Migration 022 — Multi-tenant: constraints UNIQUE escopadas por organização
 *
 * Hoje várias tabelas têm UNIQUE em campos como cpf/cnpj/placa/documento.
 * Para multi-tenant, isso impede duas organizações terem (por exemplo)
 * o mesmo CPF ou placa, o que é um requisito legítimo do negócio.
 *
 * Esta migration:
 *  1. Remove os UNIQUE globais
 *  2. Cria UNIQUE compostos (organizacao_id, <campo>)
 *
 * Constraints tratadas:
 *  - logi_motoristas:      uniq_motoristas_cpf      → (organizacao_id, cpf)
 *  - logi_ajudantes:       uq_ajudantes_cpf         → (organizacao_id, cpf)
 *  - logi_veiculos:        logi_veiculos_placa_key  → (organizacao_id, placa)
 *  - logi_clientes:        logi_clientes_documento_key + uq_clientes_documento → (organizacao_id, documento)
 *  - logi_transportadoras: logi_transportadoras_cnpj_key → (organizacao_id, cnpj)
 */

const CONSTRAINTS = [
  { tabela: 'logi_motoristas',      drop: ['uniq_motoristas_cpf'],                                        col: 'cpf',       novoNome: 'uq_motoristas_org_cpf' },
  { tabela: 'logi_ajudantes',       drop: ['uq_ajudantes_cpf'],                                           col: 'cpf',       novoNome: 'uq_ajudantes_org_cpf' },
  { tabela: 'logi_veiculos',        drop: ['logi_veiculos_placa_key'],                                    col: 'placa',     novoNome: 'uq_veiculos_org_placa' },
  { tabela: 'logi_clientes',        drop: ['logi_clientes_documento_key','uq_clientes_documento'],        col: 'documento', novoNome: 'uq_clientes_org_documento' },
  { tabela: 'logi_transportadoras', drop: ['logi_transportadoras_cnpj_key'],                              col: 'cnpj',      novoNome: 'uq_transportadoras_org_cnpj' },
];

(async () => {
  const client = await p.connect();
  try {
    await client.query('BEGIN');
    log('=== MIGRATION 022 — Constraints UNIQUE por organização ===');
    log(`Iniciado em ${new Date().toISOString()}\n`);

    for (const { tabela, drop, col, novoNome } of CONSTRAINTS) {
      log(`--- ${tabela} ---`);

      // 1. Verificar quantas linhas duplicadas existem hoje no par (organizacao_id, col)
      // Se houver, a migration falha — precisa decidir o que fazer com elas.
      const dup = await client.query(`
        SELECT organizacao_id, ${col}, COUNT(*) AS c
        FROM ${tabela}
        WHERE ${col} IS NOT NULL
        GROUP BY organizacao_id, ${col}
        HAVING COUNT(*) > 1
      `);
      if (dup.rows.length) {
        log(`  ⚠ Existem duplicatas em (organizacao_id, ${col}):`);
        dup.rows.forEach(d => log(`    org=${d.organizacao_id} ${col}=${d[col]} (${d.c} linhas)`));
        throw new Error(`Duplicatas em ${tabela}.${col} impedem criação da UNIQUE composta`);
      }

      // 2. Drop dos UNIQUE antigos
      for (const c of drop) {
        const exists = await client.query(
          `SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname=$1`, [c]
        );
        if (!exists.rows.length) {
          log(`  • ${c} não existe — pulando drop`);
          continue;
        }
        // Tenta dropar como constraint primeiro; se não for, dropa como índice
        try {
          await client.query(`ALTER TABLE ${tabela} DROP CONSTRAINT ${c}`);
          log(`  ✓ dropped constraint ${c}`);
        } catch (e) {
          if (/does not exist|não existe/i.test(e.message)) {
            await client.query(`DROP INDEX ${c}`);
            log(`  ✓ dropped index ${c}`);
          } else {
            throw e;
          }
        }
      }

      // 3. Criar UNIQUE composto (parcial: ignora NULL)
      const idxExists = await client.query(
        `SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname=$1`, [novoNome]
      );
      if (idxExists.rows.length) {
        log(`  ✓ ${novoNome} já existe`);
      } else {
        await client.query(
          `CREATE UNIQUE INDEX ${novoNome} ON ${tabela} (organizacao_id, ${col}) WHERE ${col} IS NOT NULL`
        );
        log(`  ✓ criado ${novoNome} ON ${tabela} (organizacao_id, ${col}) WHERE ${col} IS NOT NULL`);
      }

      log('');
    }

    // Validação final
    log('--- Validação ---');
    const finalCheck = await client.query(`
      SELECT i.relname AS idx, c.relname AS tbl, ix.indisunique AS uniq,
             pg_get_indexdef(ix.indexrelid) AS def
      FROM pg_index ix
      JOIN pg_class c ON c.oid = ix.indrelid
      JOIN pg_class i ON i.oid = ix.indexrelid
      WHERE c.relname IN ('logi_motoristas','logi_ajudantes','logi_veiculos','logi_clientes','logi_transportadoras')
        AND ix.indisunique = TRUE
      ORDER BY c.relname, i.relname
    `);
    finalCheck.rows.forEach(r => log(`  ${r.tbl}.${r.idx}: ${r.def}`));

    await client.query('COMMIT');
    log(`\n=== ✓ MIGRATION 022 CONCLUÍDA EM ${new Date().toISOString()} ===`);
    process.exit(0);
  } catch (e) {
    await client.query('ROLLBACK');
    log('\n=== ✗ ERRO — ROLLBACK ===');
    log('ERROR: ' + e.message);
    log('STACK: ' + e.stack);
    process.exit(1);
  } finally {
    client.release();
  }
})();
