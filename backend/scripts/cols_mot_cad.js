require('dotenv').config({ path: 'C:\\Desenvolvimento\\logisystem\\backend\\.env' });
const { Pool } = require('pg'); const fs = require('fs'); const path = require('path');
const p = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });
const LOG = path.join(__dirname, '..', 'cols_mc.txt');
fs.writeFileSync(LOG, '');
(async () => {
  try {
    const r = await p.query(
      `SELECT column_name, data_type FROM information_schema.columns
       WHERE table_name = 'logi_motorista_cadastros'
         AND column_name NOT IN ('id','organizacao_id','convite_id','assinatura_path','assinatura_ip',
                                  'check_cnh','check_cnpj','check_rntrc','check_endereco',
                                  'validado_em','validado_por','status','created_at','updated_at',
                                  'doc_cnh','doc_cnpj_contrato','doc_rntrc','doc_comprovante_endereco')
       ORDER BY ordinal_position`
    );
    let s = '';
    r.rows.forEach(c => s += `${c.column_name}\n`);
    fs.writeFileSync(LOG, s);
    process.exit(0);
  } catch (e) { fs.writeFileSync(LOG, 'ERRO: ' + e.message); process.exit(1); }
})();
