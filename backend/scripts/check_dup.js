require('dotenv').config({ path: 'C:\\Desenvolvimento\\logisystem\\backend\\.env' });
const { Pool } = require('pg');
const fs = require('fs'); const path = require('path');
const p = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });
const LOG = path.join(__dirname, '..', 'dup.txt');
fs.writeFileSync(LOG, '');
(async () => {
  try {
    // Convites recentes da Mtrans
    const r = await p.query(
      `SELECT id, token, nome_motorista, created_at, status, expires_at
       FROM logi_cadastro_convites
       WHERE organizacao_id = 'fcb4f2ec605481cb49c6ee7807db0565'
       ORDER BY created_at DESC LIMIT 15`
    );
    let s = `Total convites Mtrans recentes: ${r.rows.length}\n\n`;
    r.rows.forEach(c => {
      s += `${c.created_at.toISOString()} | status=${c.status} | nome="${c.nome_motorista}" | token=${c.token.substring(0,16)}...\n`;
    });

    // Cadastros recebidos da Mtrans
    const cads = await p.query(
      `SELECT id, nome, cpf, status, created_at
       FROM logi_motorista_cadastros
       WHERE organizacao_id = 'fcb4f2ec605481cb49c6ee7807db0565'
       ORDER BY created_at DESC LIMIT 15`
    );
    s += `\n\nTotal cadastros recebidos Mtrans: ${cads.rows.length}\n`;
    cads.rows.forEach(c => {
      s += `${c.created_at.toISOString()} | "${c.nome}" | cpf=${c.cpf} | status=${c.status}\n`;
    });

    fs.writeFileSync(LOG, s);
    process.exit(0);
  } catch (e) {
    fs.writeFileSync(LOG, 'ERRO: ' + e.message);
    process.exit(1);
  }
})();
