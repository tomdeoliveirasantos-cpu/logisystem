require('dotenv').config();
const { Pool } = require('pg');
const p = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });
const CD = 'Rua Lourival Marques dos Santos, 523, Vila Iracema, Barueri - SP, 06422-110';
// coords já validadas do CD (Google): -23.4989809, -46.8478321 (Barueri)
const CD_LAT = -23.4989809, CD_LNG = -46.8478321;
(async () => {
  try {
    const orgs = await p.query('SELECT id, nome FROM logi_organizacoes WHERE ativo = true');
    console.log('orgs:', orgs.rows.map(o=>o.id+'='+o.nome).join(' | '));
    // Configura CD para todas (podem editar depois); RLS/tenant isola o uso
    for (const o of orgs.rows) {
      await p.query(
        `INSERT INTO logi_rotas_config (organizacao_id, cd_endereco, cd_lat, cd_lng, incluir_volta)
         VALUES ($1,$2,$3,$4,true)
         ON CONFLICT (organizacao_id) DO UPDATE SET cd_endereco=$2, cd_lat=$3, cd_lng=$4`,
        [o.id, CD, CD_LAT, CD_LNG]
      );
    }
    // grava o CD no cache também
    await p.query(
      `INSERT INTO logi_geocache (endereco_norm, lat, lng, location_type, provider)
       VALUES ($1,$2,$3,'ROOFTOP','google') ON CONFLICT (endereco_norm) DO NOTHING`,
      [CD, CD_LAT, CD_LNG]
    );
    console.log('CD_OK configurado para', orgs.rows.length, 'orgs');
  } catch (e) { console.log('ERRO:', e.message); }
  finally { await p.end(); }
})();
