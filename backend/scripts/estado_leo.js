require('dotenv').config({ path: 'C:\\Desenvolvimento\\logisystem\\backend\\.env' });
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false, max: 1 });
const LOG = path.join(__dirname, '..', 'estado_leo.txt');
fs.writeFileSync(LOG, '');
const log = (m) => fs.appendFileSync(LOG, m + '\n');

(async () => {
  try {
    // Como super_admin para ver tudo
    await pool.query("SELECT set_config('app.current_org_id', 'super_admin', false)");
    const tables = [
      'logi_clientes', 'logi_transportadoras', 'logi_veiculos', 'logi_motoristas',
      'logi_ajudantes', 'logi_fornecedores', 'logi_ordens_transporte',
      'logi_ordem_paradas', 'logi_ordem_anexos',
      'logi_manutencoes', 'logi_contas_pagar', 'logi_contas_receber',
      'logi_tabela_fretes', 'logi_tabela_frete_recebido', 'logi_reajustes_frete',
      'logi_historico_ordens', 'logi_cadastro_convites',
    ];
    log('=== ESTADO LÉO (deve continuar intacta) ===');
    for (const t of tables) {
      const r = await pool.query(`
        SELECT COALESCE(o.nome,'(sem org)') AS org, COUNT(*) AS qtd
        FROM ${t} x LEFT JOIN logi_organizacoes o ON o.id = x.organizacao_id
        GROUP BY o.nome ORDER BY o.nome
      `);
      const linhas = r.rows.map(x => `${x.org}=${x.qtd}`).join(' | ');
      log(`${t.padEnd(30)} ${linhas}`);
    }
    process.exit(0);
  } catch (e) {
    log('ERRO: ' + e.message);
    process.exit(1);
  }
})();
