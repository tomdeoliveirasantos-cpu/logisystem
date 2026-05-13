require('dotenv').config({ path: 'C:\\Desenvolvimento\\logisystem\\backend\\.env' });
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const p = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });

async function run() {
  const log = [];
  const append = (msg) => { console.log(msg); log.push(msg); };
  try {
    const tabs = ['logi_motoristas', 'logi_veiculos', 'logi_ordens_transporte', 'logi_contas_pagar', 'logi_usuarios', 'logi_ajudantes', 'logi_adiantamentos'];
    for (const t of tabs) {
      append(`\n=== ${t} ===`);
      const r = await p.query(
        `SELECT column_name, data_type, udt_name, is_nullable
           FROM information_schema.columns
          WHERE table_schema='public' AND table_name=$1
            AND column_name IN ('id','motorista_id','veiculo_id','ordem_id','ajudante_id','conta_pagar_id','cp_acerto_id','criado_por','usuario_id')
          ORDER BY column_name`, [t]
      );
      if (r.rows.length === 0) { append('  (tabela não existe)'); continue; }
      r.rows.forEach(c => append(`  ${c.column_name.padEnd(20)} ${c.data_type} / ${c.udt_name} ${c.is_nullable === 'YES' ? '(null)' : '(not null)'}`));
    }
  } catch (e) {
    append(`!!! ERRO: ${e.message}`);
  } finally {
    await p.end();
    fs.writeFileSync(path.join(__dirname, 'inspect-types-011.log'), log.join('\n'));
    process.exit(0);
  }
}
run();
