require('dotenv').config();
const fs = require('fs');
const zlib = require('zlib');
const { Pool } = require('pg');
const p = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });
(async () => {
  try {
    const b64 = fs.readFileSync('gc.b64', 'utf8').replace(/[\r\n\s]/g, '');
    const sql = zlib.gunzipSync(Buffer.from(b64, 'base64')).toString('utf8');
    const antes = await p.query('SELECT COUNT(*)::int c FROM logi_geocache');
    await p.query(sql);
    const depois = await p.query('SELECT COUNT(*)::int c FROM logi_geocache');
    console.log('CACHE_OK antes=' + antes.rows[0].c + ' depois=' + depois.rows[0].c);
  } catch (e) { console.log('ERRO:', e.message.slice(0, 120)); }
  finally { await p.end(); }
})();
