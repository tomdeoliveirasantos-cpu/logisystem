require('dotenv').config({ path: 'C:\\Desenvolvimento\\logisystem\\backend\\.env' });
const { Pool } = require('pg'); const fs = require('fs'); const path = require('path');
const p = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });
const LOG = path.join(__dirname, '..', 'diag2.txt');
fs.writeFileSync(LOG, '');
(async () => {
  try {
    // Achar os cadastros tipo "administrativo" para entender o caso
    const r = await p.query(
      `SELECT id, nome, tipo_colaborador, cnh_numero, cnh_categoria, cnh_validade,
              cpf, rg, telefone, email,
              veiculo_placa, veiculo_modelo, veiculo_ano
         FROM logi_motorista_cadastros
        WHERE organizacao_id = 'fcb4f2ec605481cb49c6ee7807db0565'
          AND tipo_colaborador = 'administrativo'
        ORDER BY created_at DESC LIMIT 5`
    );
    let s = `Cadastros administrativos: ${r.rows.length}\n\n`;
    r.rows.forEach(c => {
      s += `=== id=${c.id} "${c.nome}" ===\n`;
      s += `  tipo: ${c.tipo_colaborador}\n`;
      s += `  CPF: ${c.cpf || '(vazio)'}, RG: ${c.rg || '(vazio)'}, Tel: ${c.telefone || '(vazio)'}\n`;
      s += `  CNH: nº=${c.cnh_numero||'(vazio)'} categoria=${c.cnh_categoria||'(vazio)'} val=${c.cnh_validade||'(vazio)'}\n`;
      s += `  Veículo: placa=${c.veiculo_placa||'(vazio)'} modelo=${c.veiculo_modelo||'(vazio)'} ano=${c.veiculo_ano||'(vazio)'}\n`;
    });
    fs.writeFileSync(LOG, s);
    process.exit(0);
  } catch (e) { fs.writeFileSync(LOG, 'ERRO: ' + e.message); process.exit(1); }
})();
