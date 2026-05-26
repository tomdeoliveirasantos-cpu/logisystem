require('dotenv').config({ path: 'C:\\Desenvolvimento\\logisystem\\backend\\.env' });
const { Pool } = require('pg'); const fs = require('fs'); const path = require('path');
const p = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });
const LOG = path.join(__dirname, '..', 'params.txt');
fs.writeFileSync(LOG, '');
(async () => {
  try {
    const r = await p.query(
      `SELECT organizacao_id, parametros, updated_at, updated_by
         FROM logi_parametros_cadastro_publico
        WHERE organizacao_id IN ('fcb4f2ec605481cb49c6ee7807db0565','8d15631f97045237b0866eb1efe7d0d7')`
    );
    let s = `Total registros: ${r.rows.length}\n\n`;
    r.rows.forEach(row => {
      const orgNome = row.organizacao_id.startsWith('fcb4') ? 'Mtrans' : 'Léo';
      s += `=== ${orgNome} (atualizado em ${row.updated_at?.toISOString?.()||'-'} por ${row.updated_by||'-'}) ===\n`;
      const params = row.parametros || {};
      // Filtrar campos de veículo
      ['veiculo_placa','veiculo_modelo','veiculo_ano','veiculo_rntrc'].forEach(c => {
        s += `  ${c.padEnd(20)} = ${params[c] || '(não definido, usa default)'}\n`;
      });
      // Mostrar TOTAL de campos customizados pra contexto
      s += `  TOTAL de chaves customizadas: ${Object.keys(params).length}\n`;
    });
    fs.writeFileSync(LOG, s);
    process.exit(0);
  } catch (e) { fs.writeFileSync(LOG, 'ERRO: ' + e.message); process.exit(1); }
})();
