require('dotenv').config({ path: 'C:\\Desenvolvimento\\logisystem\\backend\\.env' });
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const p = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });
const LOG = path.join(__dirname, '..', 'has_org.txt');
fs.writeFileSync(LOG, '');

(async () => {
  try {
    const tables = [
      'logi_ordens_transporte', 'logi_ordem_paradas', 'logi_ordem_ajudantes',
      'logi_ordem_anexos', 'logi_historico_ordens',
      'logi_contas_pagar', 'logi_contas_receber',
      'logi_adiantamentos', 'logi_tabela_fretes', 'logi_tabela_frete_recebido',
      'logi_reajustes_frete',
    ];
    let s = '';
    for (const t of tables) {
      const r = await p.query(
        `SELECT column_name, data_type FROM information_schema.columns
         WHERE table_schema='public' AND table_name=$1
           AND column_name IN ('id','organizacao_id')
         ORDER BY column_name`,
        [t]
      );
      s += `${t}:\n`;
      r.rows.forEach(c => s += `  ${c.column_name} (${c.data_type})\n`);
      // Contagem de linhas por org
      const c = await p.query(
        `SELECT COALESCE(o.nome,'(sem org)') AS org, COUNT(*) AS qtd
         FROM ${t} x LEFT JOIN logi_organizacoes o ON o.id = x.organizacao_id
         GROUP BY o.nome ORDER BY o.nome`
      );
      c.rows.forEach(x => s += `  → ${x.org}: ${x.qtd}\n`);
      s += '\n';
    }
    fs.writeFileSync(LOG, s);
    process.exit(0);
  } catch (e) {
    fs.writeFileSync(LOG, 'ERRO: ' + e.message);
    process.exit(1);
  }
})();
