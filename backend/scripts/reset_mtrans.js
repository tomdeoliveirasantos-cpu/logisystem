require('dotenv').config({ path: 'C:\\Desenvolvimento\\logisystem\\backend\\.env' });
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');

const p = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });
const LOG = path.join(__dirname, '..', 'reset_mtrans.txt');
fs.writeFileSync(LOG, '');
const log = (m) => fs.appendFileSync(LOG, m + '\n');

const NOVA_SENHA = 'LogiSystem@2026';

(async () => {
  try {
    const hash = await bcrypt.hash(NOVA_SENHA, 10);
    const r = await p.query(
      `UPDATE logi_usuarios
          SET senha_hash=$1, senha_resetada=true, updated_at=NOW()
        WHERE LOWER(email)='admin@mtrans.com.br'
        RETURNING id, email, senha_resetada`,
      [hash]
    );
    if (!r.rows.length) {
      log('Usuário não encontrado.');
    } else {
      log(`✓ Senha resetada para: ${NOVA_SENHA}`);
      log(`  Email: ${r.rows[0].email}`);
      log(`  senha_resetada: ${r.rows[0].senha_resetada}`);
    }
    process.exit(0);
  } catch (e) {
    log('ERRO: ' + e.message);
    process.exit(1);
  }
})();
