require('dotenv').config();
const { Pool } = require('pg');
const p = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });
(async () => {
  try {
    await p.query('ALTER TABLE logi_rotas_paradas ADD COLUMN IF NOT EXISTS km_trecho NUMERIC(10,2)');
    console.log('KM_TRECHO_OK');
  } catch (e) { console.log('ERRO:', e.message); }
  finally { await p.end(); }
})();
