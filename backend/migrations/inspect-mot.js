require('dotenv').config({ path: 'C:\\Desenvolvimento\\logisystem\\backend\\.env' });
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const p = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });
(async () => {
  const out = [];
  for (const t of ['logi_motoristas','logi_motorista_cadastros']) {
    const r = await p.query(`SELECT column_name, udt_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position`, [t]);
    out.push(`=== ${t} (${r.rows.length} cols) ===`);
    r.rows.forEach(c => out.push(`  ${c.column_name.padEnd(30)} ${c.udt_name}`));
  }
  fs.writeFileSync(path.join(__dirname,'inspect-mot.log'), out.join('\n'));
  await p.end();
  console.log(out.join('\n'));
  process.exit(0);
})();
