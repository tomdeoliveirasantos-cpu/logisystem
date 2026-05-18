require('dotenv').config({ path: 'C:\\Desenvolvimento\\logisystem\\backend\\.env' });
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const p = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });
const LOG = path.join(__dirname, '..', 'check_mot.txt');
fs.writeFileSync(LOG, '');

(async () => {
  try {
    // Colunas da tabela
    const cols = await p.query(
      `SELECT column_name, data_type, is_nullable
       FROM information_schema.columns
       WHERE table_name = 'logi_motoristas'
       ORDER BY ordinal_position`
    );
    let s = 'COLUNAS DE logi_motoristas:\n';
    cols.rows.forEach(c => s += `  ${c.column_name} (${c.data_type}) nullable=${c.is_nullable}\n`);
    
    // Verifica UNIQUE constraint em CPF
    const constraints = await p.query(
      `SELECT con.conname AS nome, pg_get_constraintdef(con.oid) AS def
       FROM pg_constraint con
       JOIN pg_class rel ON rel.oid = con.conrelid
       WHERE rel.relname = 'logi_motoristas'
       ORDER BY con.conname`
    );
    s += '\nCONSTRAINTS:\n';
    constraints.rows.forEach(c => s += `  ${c.nome}: ${c.def}\n`);
    
    fs.writeFileSync(LOG, s);
    process.exit(0);
  } catch (e) {
    fs.writeFileSync(LOG, 'ERRO: ' + e.message);
    process.exit(1);
  }
})();
