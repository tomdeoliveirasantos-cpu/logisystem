require('dotenv').config({ path: 'C:\\Desenvolvimento\\logisystem\\backend\\.env' });
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const p = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });

async function run() {
  const log = [];
  const append = (msg) => { console.log(msg); log.push(msg); };

  try {
    append('=== Configurando parâmetros de visibilidade dos campos da OT ===\n');

    // Campos que SAEM da OT (foram para paradas)
    const ocultar = ['nf', 'peso', 'remessa', 'pedido', 'seq', 'ajudante_nome'];
    for (const campo of ocultar) {
      await p.query(
        `INSERT INTO logi_parametros (chave, valor) VALUES ($1, 'oculto')
         ON CONFLICT (chave) DO UPDATE SET valor='oculto', updated_at=NOW()`,
        [`ordem_campo_${campo}`]
      );
      append(`  ✓ ordem_campo_${campo} = oculto`);
    }

    // Campos novos que devem aparecer
    const opcional = ['tipo_frota', 'quant_entregas', 'ajudante_extra', 'numero_rota', 'ajuda_diesel', 'taxa_descarga', 'obs', 'anexo'];
    for (const campo of opcional) {
      await p.query(
        `INSERT INTO logi_parametros (chave, valor) VALUES ($1, 'opcional')
         ON CONFLICT (chave) DO NOTHING`,
        [`ordem_campo_${campo}`]
      );
    }
    append(`  ✓ ${opcional.length} campos opcionais garantidos`);

    // tipo_frota e numero_rota são essenciais → obrigatorios
    await p.query(
      `UPDATE logi_parametros SET valor='obrigatorio' WHERE chave IN ('ordem_campo_tipo_frota','ordem_campo_numero_rota')`
    );
    append('  ✓ tipo_frota e numero_rota = obrigatorio');

    append('\n--- Estado atual ---');
    const { rows } = await p.query(
      `SELECT chave, valor FROM logi_parametros WHERE chave LIKE 'ordem_campo_%' ORDER BY chave`
    );
    rows.forEach(r => append(`  ${r.chave}: ${r.valor}`));

    append('\n=== PARAMS_COMPLETE ===');
  } catch (e) {
    append(`ERRO: ${e.message}`);
  } finally {
    await p.end();
    fs.writeFileSync(path.join(__dirname, 'config-params.log'), log.join('\n'));
    process.exit(0);
  }
}
run();
