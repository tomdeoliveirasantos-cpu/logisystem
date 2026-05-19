require('dotenv').config({ path: 'C:\\Desenvolvimento\\logisystem\\backend\\.env' });
const { Pool } = require('pg');
const fs = require('fs'); const path = require('path');
const p = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });
const LOG = path.join(__dirname, '..', 'dup_full.txt');
fs.writeFileSync(LOG, '');

(async () => {
  try {
    // Listar convites Mtrans com agrupamento por nome
    const r = await p.query(
      `SELECT id, token, nome_motorista, created_at, status
       FROM logi_cadastro_convites
       WHERE organizacao_id = 'fcb4f2ec605481cb49c6ee7807db0565'
       ORDER BY created_at DESC LIMIT 30`
    );
    let s = `Total convites Mtrans: ${r.rows.length}\n\n`;
    r.rows.forEach(c => {
      s += `${c.created_at.toISOString()} | id=${c.id} | status=${c.status} | "${c.nome_motorista}"\n`;
    });

    // Duplicidades — agrupar por nome + status pendente
    s += '\n=== DUPLICIDADES PENDENTES ===\n';
    const dup = await p.query(
      `SELECT nome_motorista, COUNT(*) as qt, MIN(created_at) as primeiro, MAX(created_at) as ultimo
       FROM logi_cadastro_convites
       WHERE organizacao_id = 'fcb4f2ec605481cb49c6ee7807db0565'
         AND status = 'pendente'
       GROUP BY nome_motorista
       HAVING COUNT(*) > 1`
    );
    dup.rows.forEach(d => {
      s += `"${d.nome_motorista}": ${d.qt} convites (${d.primeiro.toISOString()} → ${d.ultimo.toISOString()})\n`;
    });

    fs.writeFileSync(LOG, s);
    process.exit(0);
  } catch (e) {
    fs.writeFileSync(LOG, 'ERRO: ' + e.message);
    process.exit(1);
  }
})();
