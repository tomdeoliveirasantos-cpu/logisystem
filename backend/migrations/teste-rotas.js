require('dotenv').config();
const { Pool } = require('pg');
const p = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });
(async () => {
  try {
    // cache populado?
    const cache = await p.query('SELECT COUNT(*)::int c, COUNT(*) FILTER (WHERE location_type=$1)::int rooftop FROM logi_geocache', ['ROOFTOP']);
    console.log('cache:', cache.rows[0].c, 'endereços |', cache.rows[0].rooftop, 'ROOFTOP');
    // tabela de valores populada?
    const tab = await p.query("SELECT modelo, valor_km, valor_fixo FROM logi_rotas_tabela_valor ORDER BY organizacao_id, modelo LIMIT 4");
    console.log('valores (amostra):', tab.rows.map(r=>`${r.modelo}=${r.valor_km}/km+${r.valor_fixo}`).join(' · '));
    // orgs com config de CD
    const cfg = await p.query('SELECT organizacao_id, cd_endereco, cd_lat FROM logi_rotas_config');
    console.log('CDs configurados:', cfg.rows.length);
    console.log('TESTE_OK');
  } catch (e) { console.log('ERRO:', e.message); }
  finally { await p.end(); }
})();
