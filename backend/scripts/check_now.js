require('dotenv').config({ path: 'C:\\Desenvolvimento\\logisystem\\backend\\.env' });
const { Pool } = require('pg');
const fs = require('fs'); const path = require('path');
const p = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });
const LOG = path.join(__dirname, '..', 'now.txt');
fs.writeFileSync(LOG, '');
(async () => {
  try {
    // Convites pendentes por org com mesmo nome (deveria ser 0)
    const dup = await p.query(`
      SELECT organizacao_id, LOWER(TRIM(nome_motorista)) AS n, COUNT(*) AS c
      FROM logi_cadastro_convites
      WHERE status = 'pendente' AND nome_motorista IS NOT NULL
      GROUP BY organizacao_id, LOWER(TRIM(nome_motorista))
      HAVING COUNT(*) > 1
    `);
    let s = `Duplicidades pendentes: ${dup.rows.length}\n`;
    dup.rows.forEach(d => s += `  org=${d.organizacao_id.substring(0,8)} nome="${d.n}" qt=${d.c}\n`);

    // Verifica que UNIQUE INDEX existe
    const idx = await p.query(`SELECT indexname, indexdef FROM pg_indexes WHERE indexname = 'uq_convites_pendentes_nome'`);
    s += `\nUNIQUE INDEX existe: ${idx.rows.length > 0 ? 'SIM' : 'NÃO'}\n`;
    
    // Total convites por status
    const stt = await p.query(`SELECT status, COUNT(*) AS qt FROM logi_cadastro_convites GROUP BY status`);
    s += `\nConvites por status:\n`;
    stt.rows.forEach(r => s += `  ${r.status}: ${r.qt}\n`);

    fs.writeFileSync(LOG, s);
    process.exit(0);
  } catch (e) { fs.writeFileSync(LOG, 'ERRO: ' + e.message); process.exit(1); }
})();
