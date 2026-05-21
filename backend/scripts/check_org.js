require('dotenv').config({ path: 'C:\\Desenvolvimento\\logisystem\\backend\\.env' });
const { Pool } = require('pg'); const fs = require('fs'); const path = require('path');
const p = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });
const LOG = path.join(__dirname, '..', 'org.txt');
fs.writeFileSync(LOG, '');
(async () => {
  try {
    // Achar a tabela de orgs
    const r = await p.query(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND (table_name LIKE '%org%' OR table_name LIKE '%tenant%')
       ORDER BY table_name`
    );
    let s = 'Tabelas relacionadas a org:\n';
    r.rows.forEach(c => s += `  ${c.table_name}\n`);
    
    // Conferir o tipo de id
    const c = await p.query(
      `SELECT column_name, data_type FROM information_schema.columns
       WHERE table_name LIKE '%org%' AND column_name IN ('id','ativa','ativo','nome')
       ORDER BY table_name, ordinal_position`
    );
    s += '\nColunas-chave:\n';
    c.rows.forEach(x => s += `  ${x.column_name} (${x.data_type})\n`);
    
    fs.writeFileSync(LOG, s);
    process.exit(0);
  } catch (e) { fs.writeFileSync(LOG, 'ERRO: ' + e.message); process.exit(1); }
})();
