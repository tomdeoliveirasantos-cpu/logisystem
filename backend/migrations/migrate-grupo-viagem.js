require('dotenv').config();
const { Pool } = require('pg');
const p = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });

async function run() {
  try {
    await p.query(`ALTER TABLE logi_ordens_transporte ADD COLUMN IF NOT EXISTS grupo_viagem VARCHAR(20) DEFAULT NULL`);
    console.log('1/3 coluna grupo_viagem em ordens OK');

    await p.query(`ALTER TABLE logi_contas_pagar ADD COLUMN IF NOT EXISTS grupo_viagem VARCHAR(20) DEFAULT NULL`);
    console.log('2/3 coluna grupo_viagem em contas_pagar OK');

    await p.query('CREATE INDEX IF NOT EXISTS idx_ordens_grupo_viagem ON logi_ordens_transporte(grupo_viagem)');
    console.log('3/3 índice OK');

    console.log('MIGRATION_COMPLETE');
  } catch(e) {
    console.error('MIGRATION_ERROR:', e.message);
  }
  await p.end();
  process.exit(0);
}
run();
