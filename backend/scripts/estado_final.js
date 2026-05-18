require('dotenv').config({ path: 'C:\\Desenvolvimento\\logisystem\\backend\\.env' });
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const p = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });
const LOG = path.join(__dirname, '..', 'estado_final.txt');
fs.writeFileSync(LOG, '');
const log = (m) => fs.appendFileSync(LOG, m + '\n');

(async () => {
  try {
    // 1. Limpar convite teste da Mtrans
    const del = await p.query(
      `DELETE FROM logi_cadastro_convites
       WHERE nome_motorista = 'Teste Mtrans'
         AND organizacao_id = 'fcb4f2ec605481cb49c6ee7807db0565'`
    );
    log(`Convites Mtrans de teste removidos: ${del.rowCount}`);

    // 2. Estado final consolidado por org em todas as tabelas tenant
    log('\n=== ESTADO FINAL DA BASE — FIM DA FASE 4 ===\n');
    const tables = [
      'logi_clientes','logi_transportadoras','logi_veiculos','logi_motoristas',
      'logi_ajudantes','logi_fornecedores','logi_ordens_transporte','logi_ordem_paradas',
      'logi_ordem_ajudantes','logi_ordem_anexos','logi_manutencoes','logi_multas',
      'logi_contas_pagar','logi_contas_receber','logi_adiantamentos',
      'logi_tabela_fretes','logi_tabela_frete_recebido','logi_reajustes_frete',
      'logi_historico_ordens','logi_cadastro_convites','logi_motorista_cadastros',
    ];
    for (const t of tables) {
      try {
        const r = await p.query(`
          SELECT COALESCE(o.nome,'(sem org)') AS org, COUNT(*) AS qtd
          FROM ${t} x LEFT JOIN logi_organizacoes o ON o.id = x.organizacao_id
          GROUP BY o.nome ORDER BY o.nome
        `);
        const linhas = r.rows.map(x => `${x.org}=${x.qtd}`).join(' | ');
        log(`${t.padEnd(30)} ${linhas || '(vazia)'}`);
      } catch (e) {
        log(`${t}: ERRO ${e.message}`);
      }
    }
    process.exit(0);
  } catch (e) {
    log('ERRO: ' + e.message);
    process.exit(1);
  }
})();
