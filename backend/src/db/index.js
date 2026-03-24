const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false, max: 10, idleTimeoutMillis: 30000, connectionTimeoutMillis: 5000 });
pool.on('connect', () => console.log('✓ Conectado ao PostgreSQL em 15.235.54.115'));
pool.on('error', (err) => console.error('✗ Erro no pool:', err.message));
async function testConnection() { try { const client = await pool.connect(); const { rows } = await client.query('SELECT NOW() AS agora, current_database() AS banco'); console.log(`✓ Banco: ${rows[0].banco} | Servidor: ${rows[0].agora}`); client.release(); return true; } catch (err) { console.error('✗ Falha ao conectar:', err.message); return false; } }
module.exports = { query: (text, params) => pool.query(text, params), pool, testConnection };
