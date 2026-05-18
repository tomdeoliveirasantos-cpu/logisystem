// Simula um endpoint mal escrito (esqueceu o WHERE organizacao_id)
// e confirma que o RLS isola via app.current_org_id

require('dotenv').config({ path: 'C:\\Desenvolvimento\\logisystem\\backend\\.env' });
const path = require('path');
const fs = require('fs');

// Carregar o módulo db real do app
const db = require(path.join(process.cwd(), 'src', 'db'));
const LOG = path.join(process.cwd(), '..', 'rls_isolation_test.txt');
fs.writeFileSync(LOG, '');
const log = (m) => fs.appendFileSync(LOG, m + '\n');

(async () => {
  try {
    log('=== TESTE: query sem filtro WHERE manual, mas com contexto Mtrans ===\n');

    // Sem contexto: modo soft (vê tudo)
    let r = await db.query('SELECT COUNT(*)::int AS n FROM logi_ordens_transporte');
    log(`SEM contexto: ${r.rows[0].n} OTs visíveis (modo soft — vê tudo)`);

    // Com contexto Mtrans
    await db.runWithTenant('fcb4f2ec605481cb49c6ee7807db0565', async () => {
      const r = await db.query('SELECT COUNT(*)::int AS n FROM logi_ordens_transporte');
      log(`Contexto=Mtrans: ${r.rows[0].n} OTs (deveria ser 0 mesmo SEM filtro WHERE)`);

      // SELECT que cruza tabelas — também deve isolar
      const r2 = await db.query(`
        SELECT COUNT(*)::int AS n FROM logi_contas_pagar cp
        LEFT JOIN logi_ordens_transporte o ON o.id = cp.ordem_id
      `);
      log(`Contexto=Mtrans (JOIN): ${r2.rows[0].n} CPs (deveria ser 0)`);
    });

    // Com contexto Léo
    await db.runWithTenant('8d15631f97045237b0866eb1efe7d0d7', async () => {
      const r = await db.query('SELECT COUNT(*)::int AS n FROM logi_ordens_transporte');
      log(`Contexto=Léo: ${r.rows[0].n} OTs (deveria ser 6)`);

      const r2 = await db.query('SELECT COUNT(*)::int AS n FROM logi_contas_pagar');
      log(`Contexto=Léo: ${r2.rows[0].n} CPs (deveria ser 7)`);
    });

    // Super-admin: vê tudo
    await db.runWithTenant(null, async () => {
      const r = await db.query('SELECT COUNT(*)::int AS n FROM logi_ordens_transporte');
      log(`Contexto=super_admin: ${r.rows[0].n} OTs (deveria ser 6 — só Léo tem)`);
    }, { isSuperAdmin: true });

    // Tentar INSERT cross-tenant (org no body diferente do contexto)
    log('\n=== TESTE: INSERT cross-tenant deve falhar ===');
    try {
      await db.runWithTenant('fcb4f2ec605481cb49c6ee7807db0565', async () => {
        await db.query(
          `INSERT INTO logi_ordens_transporte
            (data, numero_rota, status, organizacao_id)
           VALUES ('2026-05-18', 9999, 'pendente', '8d15631f97045237b0866eb1efe7d0d7')`
        );
      });
      log('FALHA: INSERT cross-tenant não foi bloqueado!');
    } catch (e) {
      log(`✓ INSERT cross-tenant BLOQUEADO: ${e.message}`);
    }

    log('\n=== TESTE: UPDATE cross-tenant deve falhar ===');
    try {
      await db.runWithTenant('fcb4f2ec605481cb49c6ee7807db0565', async () => {
        const r = await db.query(
          `UPDATE logi_ordens_transporte SET obs = 'HACKED' WHERE id = (SELECT id FROM logi_ordens_transporte LIMIT 1) RETURNING id`
        );
        log(`UPDATE com contexto Mtrans afetou: ${r.rowCount} linhas (deveria ser 0)`);
      });
    } catch (e) {
      log(`UPDATE bloqueado: ${e.message}`);
    }

    process.exit(0);
  } catch (e) {
    log('ERRO: ' + e.message);
    process.exit(1);
  }
})();
