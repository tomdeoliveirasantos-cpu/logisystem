// Apontamento de saída de rota: registrado por quem despacha, no momento da
// saída, para o gestor não depender de aviso por WhatsApp.
require('dotenv').config();
const { Pool } = require('pg');
const p = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });

async function run() {
  try {
    await p.query(`
      CREATE TABLE IF NOT EXISTS logi_saidas_rota (
        id               SERIAL PRIMARY KEY,
        organizacao_id   TEXT NOT NULL,
        data_saida       DATE NOT NULL DEFAULT CURRENT_DATE,
        hora_saida       TIME,
        rota_codigo      VARCHAR(60) NOT NULL,
        motorista_id     TEXT REFERENCES logi_motoristas(id) ON DELETE SET NULL,
        motorista_nome   VARCHAR(200),
        veiculo_id       TEXT REFERENCES logi_veiculos(id) ON DELETE SET NULL,
        placa            VARCHAR(15),
        modelo           VARCHAR(60),
        ajudante_id      TEXT REFERENCES logi_ajudantes(id) ON DELETE SET NULL,
        ajudante_nome    VARCHAR(200),
        regiao           VARCHAR(120),
        qtd_entregas     INTEGER,
        peso_kg          NUMERIC(10,2),
        km_inicial       NUMERIC(10,1),
        km_final         NUMERIC(10,1),
        hora_retorno     TIME,
        observacao       TEXT,
        status           VARCHAR(20) NOT NULL DEFAULT 'em_rota',
        registrado_por   VARCHAR(160),
        criado_em        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        atualizado_em    TIMESTAMPTZ
      )
    `);
    await p.query(`CREATE INDEX IF NOT EXISTS idx_logi_saidas_org_data
                     ON logi_saidas_rota (organizacao_id, data_saida DESC)`);
    // evita lançar a mesma rota duas vezes no mesmo dia
    await p.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_logi_saidas_unica
                     ON logi_saidas_rota (organizacao_id, data_saida, rota_codigo)`);
    console.log('MIGRATION_SAIDAS_OK');
  } catch (err) {
    console.log('ERRO:', err.message);
    process.exitCode = 1;
  } finally {
    await p.end();
  }
}
run();
