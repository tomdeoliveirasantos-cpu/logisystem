require('dotenv').config();
const { Pool } = require('pg');
const p = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });
const VALORES = [
  { modelo: 'HR',    valor_km: 2.016, valor_fixo: 477.10 },
  { modelo: 'IVECO', valor_km: 2.830, valor_fixo: 513.71 },
  { modelo: '3.4',   valor_km: 3.340, valor_fixo: 650.82 },
  { modelo: 'TOCO',  valor_km: 3.840, valor_fixo: 883.13 },
];
async function run() {
  try {
    // todas as organizações ativas recebem a tabela padrão (podem editar depois)
    const orgs = await p.query('SELECT id FROM logi_organizacoes WHERE ativo = true');
    let n = 0;
    for (const o of orgs.rows) {
      for (const v of VALORES) {
        await p.query(
          `INSERT INTO logi_rotas_tabela_valor (organizacao_id, modelo, valor_km, valor_fixo)
           VALUES ($1,$2,$3,$4)
           ON CONFLICT (organizacao_id, modelo) DO NOTHING`,
          [o.id, v.modelo, v.valor_km, v.valor_fixo]
        );
        n++;
      }
    }
    console.log('SEED_OK orgs=' + orgs.rows.length + ' inserts=' + n);
  } catch (e) { console.log('ERRO:', e.message); }
  finally { await p.end(); }
}
run();
