require('dotenv').config();
const db = require('./src/db');
db.query('SELECT id, nome, doc_cnh, doc_cnpj_contrato, doc_rntrc, doc_comprovante_endereco, assinatura_path FROM logi_motorista_cadastros')
  .then(r => { console.log(JSON.stringify(r.rows, null, 2)); process.exit(); })
  .catch(e => { console.error(e.message); process.exit(1); });
