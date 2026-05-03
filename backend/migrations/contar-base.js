require('dotenv').config({ path: 'C:\\Desenvolvimento\\logisystem\\backend\\.env' });
const { Pool } = require('pg');
const fs = require('fs');
const p = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });
async function run() {
  const log = [];
  const tabelas = [
    'logi_ordens_transporte',
    'logi_historico_ordens',
    'logi_motoristas',
    'logi_motorista_cadastros',
    'logi_cadastro_convites',
  ];
  try {
    for (const t of tabelas) {
      try {
        const { rows } = await p.query(`SELECT COUNT(*)::int AS c FROM ${t}`);
        log.push(`${t}: ${rows[0].c}`);
      } catch (e) {
        log.push(`${t}: ERRO ${e.message}`);
      }
    }
    // CAP/CAR vinculados a OT
    try {
      const cap = await p.query(`SELECT COUNT(*)::int c FROM logi_contas_pagar WHERE ordem_id IS NOT NULL`);
      const car = await p.query(`SELECT COUNT(*)::int c FROM logi_contas_receber WHERE ordem_id IS NOT NULL`);
      log.push(`logi_contas_pagar (com ordem_id): ${cap.rows[0].c}`);
      log.push(`logi_contas_receber (com ordem_id): ${car.rows[0].c}`);
    } catch(e) { log.push(`CAP/CAR: ${e.message}`); }
    // Vínculos preserváveis
    try {
      const v = await p.query(`SELECT COUNT(*)::int c FROM logi_veiculos WHERE motorista_id IS NOT NULL`);
      log.push(`veiculos com motorista: ${v.rows[0].c}`);
    } catch(e) { log.push(`veiculos: ${e.message}`); }
    try {
      const m = await p.query(`SELECT COUNT(*)::int c FROM logi_multas WHERE motorista_id IS NOT NULL`);
      log.push(`multas com motorista: ${m.rows[0].c}`);
    } catch(e) { log.push(`multas: ${e.message}`); }
    try {
      const mt = await p.query(`SELECT COUNT(*)::int c FROM logi_manutencoes WHERE motorista_id IS NOT NULL`);
      log.push(`manutencoes com motorista: ${mt.rows[0].c}`);
    } catch(e) { log.push(`manutencoes: ${e.message}`); }
  } catch(e) {
    log.push(`FATAL: ${e.message}`);
  }
  fs.writeFileSync('C:\\Desenvolvimento\\logisystem\\backend\\migrations\\contar-base.log', log.join('\n'));
  await p.end();
  process.exit(0);
}
run();
