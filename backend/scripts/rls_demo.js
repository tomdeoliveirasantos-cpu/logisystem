require('dotenv').config({ path: 'C:\\Desenvolvimento\\logisystem\\backend\\.env' });
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false, max: 1 });
const LOG = path.join(__dirname, '..', 'rls_demo.txt');
fs.writeFileSync(LOG, '');
const log = (m) => fs.appendFileSync(LOG, m + '\n');

(async () => {
  const c = await pool.connect();
  try {
    // SEM setar GUC: vê tudo (modo soft)
    let r = await c.query('SELECT COUNT(*)::int AS n FROM logi_clientes');
    log(`SEM GUC: ${r.rows[0].n} clientes visíveis (modo soft, vê tudo)`);

    // Setar GUC para Mtrans
    await c.query("SET app.current_org_id = 'fcb4f2ec605481cb49c6ee7807db0565'");
    r = await c.query('SELECT COUNT(*)::int AS n FROM logi_clientes');
    log(`GUC=Mtrans: ${r.rows[0].n} clientes visíveis (deveria ser 0)`);

    // Setar GUC para Léo
    await c.query("SET app.current_org_id = '8d15631f97045237b0866eb1efe7d0d7'");
    r = await c.query('SELECT COUNT(*)::int AS n FROM logi_clientes');
    log(`GUC=Léo: ${r.rows[0].n} clientes visíveis (deveria ser 2)`);

    // Tentar INSERT com org errada via WITH CHECK
    await c.query("SET app.current_org_id = 'fcb4f2ec605481cb49c6ee7807db0565'");
    try {
      await c.query("INSERT INTO logi_clientes (nome, organizacao_id) VALUES ('Hack', '8d15631f97045237b0866eb1efe7d0d7')");
      log('FALHA: INSERT cross-tenant não foi bloqueado!');
    } catch (e) {
      log(`✓ INSERT cross-tenant BLOQUEADO: ${e.message}`);
    }

    // Resetar
    await c.query('RESET app.current_org_id');

    // Super-admin bypass
    await c.query("SET app.current_org_id = 'super_admin'");
    r = await c.query('SELECT COUNT(*)::int AS n FROM logi_clientes');
    log(`GUC=super_admin: ${r.rows[0].n} clientes visíveis (vê tudo)`);

    process.exit(0);
  } finally { c.release(); }
})().catch(e => { log('ERRO: ' + e.message); process.exit(1); });
