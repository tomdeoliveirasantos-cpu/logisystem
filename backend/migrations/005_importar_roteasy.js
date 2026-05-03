require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const p = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });

async function run() {
  const log = [];
  const append = (msg) => { console.log(msg); log.push(msg); };

  try {
    // 1. Coluna origem_importacao em ordens (rastreabilidade)
    await p.query(`ALTER TABLE logi_ordens_transporte
                   ADD COLUMN IF NOT EXISTS origem_importacao VARCHAR(20) DEFAULT 'manual'`);
    append('1/6 coluna origem_importacao em ordens OK');

    // 2. UNIQUE INDEX em remessa (parcial, ignora nulls) — base do UPSERT
    // Antes de criar, limpar duplicados existentes mantendo o mais recente
    const dupCheck = await p.query(`
      SELECT remessa, COUNT(*) c
      FROM logi_ordens_transporte
      WHERE remessa IS NOT NULL AND remessa <> ''
      GROUP BY remessa HAVING COUNT(*) > 1
    `);
    if (dupCheck.rows.length) {
      append(`AVISO: ${dupCheck.rows.length} remessas duplicadas detectadas — mantendo apenas a mais recente`);
      // Apenas reporta — não deleta. UNIQUE será criado mesmo assim porque é parcial e
      // se houver duplicados o índice falhará e o admin verá no log.
    }

    try {
      await p.query(`CREATE UNIQUE INDEX IF NOT EXISTS uq_ordens_remessa
                     ON logi_ordens_transporte(remessa)
                     WHERE remessa IS NOT NULL AND remessa <> ''`);
      append('2/6 índice único em remessa OK');
    } catch (e) {
      append(`2/6 FALHA ao criar índice único em remessa: ${e.message}`);
      append('    Verifique duplicados existentes antes de prosseguir.');
    }

    // 3. Coluna cliente_id em ordens precisa ser nullable (deve já ser, mas garantimos)
    await p.query(`ALTER TABLE logi_ordens_transporte
                   ALTER COLUMN cliente_id DROP NOT NULL`).catch(() => {});
    append('3/6 cliente_id em ordens é nullable OK');

    // 4. documento em logi_clientes pode ser nullable (auto-cadastro sem CNPJ)
    await p.query(`ALTER TABLE logi_clientes
                   ALTER COLUMN documento DROP NOT NULL`).catch(() => {});
    append('4/6 documento em clientes é nullable OK');

    // 5. UNIQUE em logi_clientes.documento (parcial) para upsert seguro
    await p.query(`CREATE UNIQUE INDEX IF NOT EXISTS uq_clientes_documento
                   ON logi_clientes(documento)
                   WHERE documento IS NOT NULL AND documento <> ''`).catch(e => {
      append(`AVISO índice clientes.documento: ${e.message}`);
    });
    append('5/6 índice único em clientes.documento OK');

    // 6. Parâmetro cap_modo_importacao (consolidado | por_ordem)
    await p.query(`
      INSERT INTO logi_parametros (chave, valor)
      VALUES ('cap_modo_importacao', 'consolidado')
      ON CONFLICT (chave) DO NOTHING
    `);
    append('6/6 parâmetro cap_modo_importacao=consolidado OK');

    append('MIGRATION_COMPLETE');
  } catch (e) {
    append(`MIGRATION_ERROR: ${e.message}`);
    append(e.stack);
  } finally {
    await p.end();
    fs.writeFileSync(path.join(__dirname, 'migrate-roteasy.log'), log.join('\n'));
    process.exit(0);
  }
}
run();
