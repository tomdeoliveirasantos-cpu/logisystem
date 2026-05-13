require('dotenv').config({ path: 'C:\\Desenvolvimento\\logisystem\\backend\\.env' });
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const p = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });

(async () => {
  const log = [];
  const out = (m) => { console.log(m); log.push(m); };
  const client = await p.connect();
  try {
    out('=== Estorno do pagamento de Rodrigo Siqueira ===');
    // Localiza a CP paga do Rodrigo na rota 5028
    const q = await client.query(`
      SELECT cp.id, cp.valor, cp.status, cp.data_pagamento, m.nome AS motorista, o.numero_rota
        FROM logi_contas_pagar cp
        LEFT JOIN logi_motoristas m ON m.id = cp.motorista_id
        LEFT JOIN logi_ordens_transporte o ON o.id = cp.ordem_id
       WHERE cp.status = 'pago'
         AND m.nome ILIKE '%RODRIGO%SIQUEIRA%'
       ORDER BY cp.data_pagamento DESC
    `);
    out(`Encontradas ${q.rows.length} CPs pagas do Rodrigo:`);
    q.rows.forEach(r => out(`  id=${r.id}  rota=${r.numero_rota}  valor=${r.valor}  pago_em=${r.data_pagamento}`));

    if (!q.rows.length) {
      out('Nenhuma encontrada. Nada a fazer.');
      return;
    }
    // Estorna a primeira (mais recente)
    const cp = q.rows[0];
    await client.query('BEGIN');
    // Reverte adtos vinculados (caso haja)
    const adt = await client.query(`SELECT id FROM logi_adiantamentos WHERE cp_acerto_id = $1`, [cp.id]);
    for (const a of adt.rows) {
      await client.query(`UPDATE logi_adiantamentos SET valor_descontado=0, status='pendente', cp_acerto_id=NULL WHERE id=$1`, [a.id]);
    }
    out(`  ${adt.rows.length} adiantamento(s) revertido(s)`);
    // Reverte a CP
    await client.query(`UPDATE logi_contas_pagar SET status='pendente', data_pagamento=NULL, valor_pago=NULL, valor_adiantamentos=0 WHERE id=$1`, [cp.id]);
    await client.query('COMMIT');
    out(`✓ CP ${cp.id} estornada (R$ ${cp.valor})`);
  } catch (e) {
    await client.query('ROLLBACK').catch(()=>{});
    out('ERRO: ' + e.message);
  } finally {
    client.release();
    await p.end();
    fs.writeFileSync(path.join(__dirname, 'estorno_rodrigo.log'), log.join('\n'));
    process.exit(0);
  }
})();
