// Datas da importação: referência (identifica a planilha) e corte (filtro de período).
require('dotenv').config();
const { Pool } = require('pg');
const p = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });
(async () => {
  try {
    await p.query(`ALTER TABLE logi_rotas_importacoes ADD COLUMN IF NOT EXISTS data_referencia DATE`);
    await p.query(`ALTER TABLE logi_rotas_importacoes ADD COLUMN IF NOT EXISTS data_corte_ini DATE`);
    await p.query(`ALTER TABLE logi_rotas_importacoes ADD COLUMN IF NOT EXISTS data_corte_fim DATE`);
    await p.query(`ALTER TABLE logi_rotas_importacoes ADD COLUMN IF NOT EXISTS linhas_ignoradas INTEGER DEFAULT 0`);
    console.log('colunas de data OK');

    // importações antigas ficam com a data da rota mais recente como referência
    await p.query(`
      UPDATE logi_rotas_importacoes i
         SET data_referencia = COALESCE(i.data_referencia,
             (SELECT MAX(r.data_rota) FROM logi_rotas r WHERE r.importacao_id = i.id))
       WHERE i.data_referencia IS NULL`);
    console.log('MIGRATION_DATAS_OK');
  } catch (e) { console.log('ERRO:', e.message); }
  finally { await p.end(); }
})();
