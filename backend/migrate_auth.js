const { Pool } = require('pg');
const pool = new Pool({ host:'15.235.54.115', port:5432, database:'wsdevsof_reciclagem', user:'wsdevsof_dev', password:'ww2018@#New', ssl:false });

const stmts = [
`CREATE TABLE IF NOT EXISTS logi_usuarios (
  id          TEXT PRIMARY KEY DEFAULT md5(random()::text||clock_timestamp()::text),
  nome        VARCHAR(100) NOT NULL,
  email       VARCHAR(120) NOT NULL UNIQUE,
  senha_hash  TEXT NOT NULL,
  perfil      VARCHAR(15) NOT NULL DEFAULT 'operador' CHECK(perfil IN('admin','operador','financeiro')),
  ativo       BOOLEAN NOT NULL DEFAULT TRUE,
  ultimo_login TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
)`,
`CREATE INDEX IF NOT EXISTS idx_logi_usuarios_email ON logi_usuarios(email)`,
// Senha padrão: Admin@123 (bcrypt hash)
`INSERT INTO logi_usuarios (nome, email, senha_hash, perfil) VALUES
  ('Administrador', 'admin@logisystem.com', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin'),
  ('Operador',      'operador@logisystem.com', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'operador'),
  ('Financeiro',    'financeiro@logisystem.com', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'financeiro')
ON CONFLICT DO NOTHING`
];

async function run(){
  const c = await pool.connect();
  try {
    for(const s of stmts){ await c.query(s); process.stdout.write('.'); }
    console.log('\n\n OK Tabela de usuários criada!');
    console.log('\nUsuários criados (senha padrão: password):');
    console.log('  admin@logisystem.com       → Admin');
    console.log('  operador@logisystem.com    → Operador');
    console.log('  financeiro@logisystem.com  → Financeiro');
    console.log('\nTROQUE AS SENHAS após o primeiro login!');
  } catch(e){ console.error('\n Erro:', e.message); }
  finally { c.release(); process.exit(0); }
}
run();
