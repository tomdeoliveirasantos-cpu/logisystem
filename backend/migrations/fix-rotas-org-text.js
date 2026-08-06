require('dotenv').config();
const { Pool } = require('pg');
const p = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });
(async () => {
  try {
    const tabelas = ['logi_rotas_config','logi_geocache','logi_rotas_importacoes','logi_rotas','logi_rotas_paradas','logi_rotas_tabela_valor'];
    // logi_geocache e logi_rotas_paradas não têm organizacao_id direto? geocache não tem; paradas não tem. só as com org.
    const comOrg = ['logi_rotas_config','logi_rotas_importacoes','logi_rotas','logi_rotas_tabela_valor'];
    for (const t of comOrg) {
      await p.query(`ALTER TABLE ${t} ALTER COLUMN organizacao_id TYPE TEXT USING organizacao_id::text`);
      console.log('  ' + t + ' organizacao_id -> TEXT');
    }
    console.log('FIX_OK');
  } catch (e) { console.log('ERRO:', e.message); }
  finally { await p.end(); }
})();
