require('dotenv').config({ path: 'C:\\Desenvolvimento\\logisystem\\backend\\.env' });
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');

const p = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });
const LOG = path.join(__dirname, '..', 'check_mtrans.txt');
fs.writeFileSync(LOG, '');
const log = (m) => fs.appendFileSync(LOG, m + '\n');

(async () => {
  try {
    const r = await p.query(
      `SELECT id, email, senha_hash, senha_resetada, ativo
         FROM logi_usuarios WHERE LOWER(email)='admin@mtrans.com.br'`
    );
    if (!r.rows.length) {
      log('Usuário não existe');
    } else {
      const u = r.rows[0];
      log(`ID: ${u.id}`);
      log(`Email: ${u.email}`);
      log(`Senha hash: ${u.senha_hash.substring(0, 30)}...`);
      log(`Senha resetada: ${u.senha_resetada}`);
      log(`Ativo: ${u.ativo}`);

      // Tenta verificar senha LogiSystem@2026
      const ok1 = await bcrypt.compare('LogiSystem@2026', u.senha_hash);
      log(`\nbcrypt.compare('LogiSystem@2026') = ${ok1}`);

      // E uma alternativa
      const ok2 = await bcrypt.compare('Mtrans@2026', u.senha_hash);
      log(`bcrypt.compare('Mtrans@2026') = ${ok2}`);
    }

    log('OK');
    process.exit(0);
  } catch (e) {
    log('ERRO: ' + e.message);
    process.exit(1);
  }
})();
