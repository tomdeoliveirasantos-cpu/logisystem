require('dotenv').config({ path: 'C:\\Desenvolvimento\\logisystem\\backend\\.env' });
const { Pool } = require('pg');
const fs = require('fs'); const path = require('path');
const p = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });
const LOG = path.join(__dirname, '..', 'patricia.txt');
fs.writeFileSync(LOG, '');

(async () => {
  try {
    const r = await p.query(
      `SELECT id, nome, cpf, status, doc_cnh, doc_cnpj_contrato, doc_rntrc, doc_comprovante_endereco
       FROM logi_motorista_cadastros
       WHERE organizacao_id = 'fcb4f2ec605481cb49c6ee7807db0565'
         AND nome ILIKE '%PATRICIA%'
       ORDER BY created_at DESC LIMIT 3`
    );
    let s = `Cadastros da Patricia: ${r.rows.length}\n`;
    r.rows.forEach(c => {
      s += `\nID: ${c.id} | Nome: ${c.nome} | Status: ${c.status}\n`;
      s += `  CNH: ${c.doc_cnh || '(vazio)'}\n`;
      s += `  CNPJ: ${c.doc_cnpj_contrato || '(vazio)'}\n`;
      s += `  RNTRC: ${c.doc_rntrc || '(vazio)'}\n`;
      s += `  Comprov: ${c.doc_comprovante_endereco || '(vazio)'}\n`;
    });
    fs.writeFileSync(LOG, s);
    process.exit(0);
  } catch (e) {
    fs.writeFileSync(LOG, 'ERRO: ' + e.message);
    process.exit(1);
  }
})();
