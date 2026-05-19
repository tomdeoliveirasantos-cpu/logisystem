require('dotenv').config({ path: 'C:\\Desenvolvimento\\logisystem\\backend\\.env' });
const { Pool } = require('pg');
const fs = require('fs'); const path = require('path');
const p = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });
const LOG = path.join(__dirname, '..', 'limpar.txt');
fs.writeFileSync(LOG, '');

(async () => {
  try {
    // Achar os 3 convites do João Paulo na Mtrans
    const r = await p.query(
      `SELECT id, token, created_at
       FROM logi_cadastro_convites
       WHERE organizacao_id = 'fcb4f2ec605481cb49c6ee7807db0565'
         AND nome_motorista = 'João Paulo Barbosa Bernardino'
         AND status = 'pendente'
       ORDER BY created_at ASC`
    );

    let s = `Encontrados ${r.rows.length} convites pendentes do João Paulo\n`;
    if (r.rows.length <= 1) {
      s += 'Nada a remover.\n';
    } else {
      // Manter o mais antigo (primeiro), deletar os outros
      const manter = r.rows[0];
      const remover = r.rows.slice(1);
      s += `Mantendo: ${manter.created_at.toISOString()} (id=${manter.id})\n`;
      for (const c of remover) {
        await p.query('DELETE FROM logi_cadastro_convites WHERE id = $1', [c.id]);
        s += `Removido: ${c.created_at.toISOString()} (id=${c.id})\n`;
      }
    }
    fs.writeFileSync(LOG, s);
    process.exit(0);
  } catch (e) {
    fs.writeFileSync(LOG, 'ERRO: ' + e.message);
    process.exit(1);
  }
})();
