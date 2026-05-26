require('dotenv').config({ path: 'C:\\Desenvolvimento\\logisystem\\backend\\.env' });
const { Pool } = require('pg'); const fs = require('fs'); const path = require('path');
const p = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });
const LOG = path.join(__dirname, '..', 'upd.txt');
fs.writeFileSync(LOG, '');
(async () => {
  try {
    const ORG_MTRANS = 'fcb4f2ec605481cb49c6ee7807db0565';
    const { rows } = await p.query(
      `SELECT parametros FROM logi_parametros_cadastro_publico WHERE organizacao_id = $1`,
      [ORG_MTRANS]
    );
    if (!rows.length) {
      fs.writeFileSync(LOG, 'Mtrans não tem registro de parâmetros'); process.exit(1);
    }
    const params = rows[0].parametros || {};
    let s = '=== ANTES ===\n';
    ['veiculo_placa','veiculo_modelo','veiculo_ano','veiculo_rntrc'].forEach(c => {
      s += `  ${c} = ${params[c]}\n`;
    });

    // Tornar opcionais
    params.veiculo_placa  = 'opcional';
    params.veiculo_modelo = 'opcional';
    params.veiculo_ano    = 'opcional';
    // veiculo_rntrc já é opcional, mantém

    const updated = await p.query(
      `UPDATE logi_parametros_cadastro_publico
          SET parametros = $1, updated_at = NOW(), updated_by = 'sistema (auto opcionalização)'
        WHERE organizacao_id = $2
        RETURNING parametros`,
      [params, ORG_MTRANS]
    );
    const novo = updated.rows[0].parametros;
    s += '\n=== DEPOIS ===\n';
    ['veiculo_placa','veiculo_modelo','veiculo_ano','veiculo_rntrc'].forEach(c => {
      s += `  ${c} = ${novo[c]}\n`;
    });
    fs.writeFileSync(LOG, s);
    process.exit(0);
  } catch (e) { fs.writeFileSync(LOG, 'ERRO: ' + e.message); process.exit(1); }
})();
