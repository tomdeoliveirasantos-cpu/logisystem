require('dotenv').config();
const fs = require('fs');
const zlib = require('zlib');
const { Pool } = require('pg');
const p = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });
(async () => {
  try {
    const b64 = fs.readFileSync('imp.b64', 'utf8').replace(/[\r\n\s]/g, '');
    const sql = zlib.gunzipSync(Buffer.from(b64, 'base64')).toString('utf8');
    await p.query(sql);
    const r = await p.query("SELECT id, total_rotas FROM logi_rotas_importacoes ORDER BY created_at DESC LIMIT 1");
    const rotas = await p.query("SELECT COUNT(*) FILTER (WHERE status_calculo='ok')::int ok, COUNT(*) FILTER (WHERE status_calculo='parcial')::int parcial, COUNT(*) FILTER (WHERE status_calculo='falha')::int falha, SUM(valor_pago)::numeric total FROM logi_rotas WHERE importacao_id=$1", [r.rows[0].id]);
    console.log('APLICADO importacao=' + r.rows[0].id + ' ok=' + rotas.rows[0].ok + ' parcial=' + rotas.rows[0].parcial + ' falha=' + rotas.rows[0].falha + ' total=R$' + rotas.rows[0].total);
  } catch (e) { console.log('ERRO:', e.message.slice(0, 150)); }
  finally { await p.end(); }
})();
