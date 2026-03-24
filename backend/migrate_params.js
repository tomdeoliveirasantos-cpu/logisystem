const { Pool } = require('pg');
const pool = new Pool({ host:'15.235.54.115', port:5432, database:'wsdevsof_reciclagem', user:'wsdevsof_dev', password:'ww2018@#New', ssl:false });

const stmts = [
`CREATE TABLE IF NOT EXISTS logi_parametros (
  id          TEXT PRIMARY KEY DEFAULT md5(random()::text||clock_timestamp()::text),
  chave       VARCHAR(80) NOT NULL UNIQUE,
  valor       TEXT NOT NULL,
  descricao   VARCHAR(200),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
)`,
`INSERT INTO logi_parametros (chave, valor, descricao) VALUES
  ('ordem_campo_seq',           'opcional', 'Campo Sequência na ordem de transporte'),
  ('ordem_campo_numero_rota',   'obrigatorio', 'Campo Número da Rota na ordem de transporte'),
  ('ordem_campo_nf',            'opcional', 'Campo NF na ordem de transporte'),
  ('ordem_campo_peso',          'opcional', 'Campo Peso na ordem de transporte'),
  ('ordem_campo_remessa',       'opcional', 'Campo Remessa na ordem de transporte'),
  ('ordem_campo_tarifa',        'opcional', 'Campo Tarifa aplicada na ordem de transporte'),
  ('ordem_campo_ajuda_diesel',  'opcional', 'Campo Ajuda Diesel na ordem de transporte'),
  ('ordem_campo_taxa_descarga', 'opcional', 'Campo Taxa Descarga na ordem de transporte'),
  ('ordem_campo_obs',           'opcional', 'Campo Observações na ordem de transporte'),
  ('ordem_campo_anexo',         'opcional', 'Campo Anexo na ordem de transporte')
ON CONFLICT (chave) DO NOTHING`
];

async function run(){
  const c = await pool.connect();
  try {
    for(const s of stmts){ await c.query(s); process.stdout.write('.'); }
    console.log('\n\n OK Tabela de parâmetros criada!');
  } catch(e){ console.error('\n Erro:', e.message); }
  finally { c.release(); process.exit(0); }
}
run();
