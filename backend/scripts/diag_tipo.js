require('dotenv').config({ path: 'C:\\Desenvolvimento\\logisystem\\backend\\.env' });
const { Pool } = require('pg');
const fs = require('fs'); const path = require('path');
const p = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });
const LOG = path.join(__dirname, '..', 'diag.txt');
fs.writeFileSync(LOG, '');

(async () => {
  try {
    let s = '';

    // 1. Estado do tipo_colaborador em todos os cadastros recentes da Mtrans
    s += '=== TIPO_COLABORADOR DOS CADASTROS DA MTRANS ===\n';
    const r = await p.query(
      `SELECT id, nome, status, tipo_colaborador, created_at
         FROM logi_motorista_cadastros
        WHERE organizacao_id = 'fcb4f2ec605481cb49c6ee7807db0565'
        ORDER BY created_at DESC LIMIT 15`
    );
    r.rows.forEach(c => {
      s += `id=${c.id} | "${c.nome}" | status=${c.status} | tipo="${c.tipo_colaborador || '(NULL)'}"\n`;
    });

    // 2. Pegar o cadastro mais recente preenchido pra ver TODOS os campos
    const ultPreench = await p.query(
      `SELECT * FROM logi_motorista_cadastros
        WHERE organizacao_id = 'fcb4f2ec605481cb49c6ee7807db0565'
          AND status IN ('pendente','aprovado','reprovado')
        ORDER BY created_at DESC LIMIT 1`
    );
    if (ultPreench.rows.length) {
      s += '\n=== ÚLTIMO CADASTRO PREENCHIDO (campos chave) ===\n';
      const u = ultPreench.rows[0];
      s += `id=${u.id} | nome="${u.nome}"\n`;
      s += `tipo_colaborador = "${u.tipo_colaborador || '(NULL/vazio)'}"\n`;
      s += `cnh_categoria = "${u.cnh_categoria || '(NULL/vazio)'}"\n`;
      s += `veiculo_placa = "${u.veiculo_placa || '(NULL/vazio)'}"\n`;
    }

    // 3. Configuração de "tipo_colaborador" nos parâmetros da Mtrans
    s += '\n=== PARÂMETRO tipo_colaborador NA MTRANS ===\n';
    const params = await p.query(
      `SELECT parametros->'tipo_colaborador' AS estado
         FROM logi_parametros_cadastro_publico
        WHERE organizacao_id = 'fcb4f2ec605481cb49c6ee7807db0565'`
    );
    s += `Estado configurado: ${JSON.stringify(params.rows[0]?.estado) || '(não configurado, usa default)'}\n`;

    fs.writeFileSync(LOG, s);
    process.exit(0);
  } catch (e) {
    fs.writeFileSync(LOG, 'ERRO: ' + e.message);
    process.exit(1);
  }
})();
