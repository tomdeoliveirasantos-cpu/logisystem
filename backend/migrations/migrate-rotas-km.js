// Migration: módulo Rotas & KM (cálculo de km percorrido e pagamento por km)
require('dotenv').config();
const { Pool } = require('pg');
const p = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });

async function run() {
  try {
    // Parâmetros do módulo por organização (endereço do CD, política de volta)
    await p.query(`
      CREATE TABLE IF NOT EXISTS logi_rotas_config (
        id SERIAL PRIMARY KEY,
        organizacao_id INTEGER NOT NULL,
        cd_endereco VARCHAR(400),
        cd_lat DOUBLE PRECISION,
        cd_lng DOUBLE PRECISION,
        incluir_volta BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE (organizacao_id)
      )
    `);
    console.log('1/5 logi_rotas_config OK');

    // Cache de geocodificação: endereço -> coordenada (evita pagar 2x o mesmo)
    await p.query(`
      CREATE TABLE IF NOT EXISTS logi_geocache (
        id SERIAL PRIMARY KEY,
        endereco_norm VARCHAR(500) UNIQUE NOT NULL,
        lat DOUBLE PRECISION,
        lng DOUBLE PRECISION,
        location_type VARCHAR(30),
        provider VARCHAR(20),
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    console.log('2/5 logi_geocache OK');

    // Importação (cada upload de planilha)
    await p.query(`
      CREATE TABLE IF NOT EXISTS logi_rotas_importacoes (
        id SERIAL PRIMARY KEY,
        organizacao_id INTEGER NOT NULL,
        arquivo_nome VARCHAR(300),
        total_rotas INTEGER DEFAULT 0,
        total_paradas INTEGER DEFAULT 0,
        status VARCHAR(20) DEFAULT 'importado',
        criado_por VARCHAR(120),
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    console.log('3/5 logi_rotas_importacoes OK');

    // Rotas calculadas
    await p.query(`
      CREATE TABLE IF NOT EXISTS logi_rotas (
        id SERIAL PRIMARY KEY,
        organizacao_id INTEGER NOT NULL,
        importacao_id INTEGER REFERENCES logi_rotas_importacoes(id) ON DELETE CASCADE,
        data_rota DATE,
        rota_codigo VARCHAR(60),
        motorista VARCHAR(200),
        placa VARCHAR(15),
        modelo VARCHAR(60),
        regiao VARCHAR(120),
        qtd_paradas INTEGER DEFAULT 0,
        km_planilha NUMERIC(10,2),
        km_calculado_ida NUMERIC(10,2),
        km_calculado_total NUMERIC(10,2),
        valor_km NUMERIC(10,4),
        valor_fixo NUMERIC(10,2),
        valor_pago NUMERIC(12,2),
        status_calculo VARCHAR(20) DEFAULT 'pendente',
        obs TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await p.query(`CREATE INDEX IF NOT EXISTS idx_logi_rotas_org ON logi_rotas (organizacao_id, importacao_id)`);
    console.log('4/5 logi_rotas OK');

    // Paradas de cada rota (na sequência de entrega)
    await p.query(`
      CREATE TABLE IF NOT EXISTS logi_rotas_paradas (
        id SERIAL PRIMARY KEY,
        rota_id INTEGER NOT NULL REFERENCES logi_rotas(id) ON DELETE CASCADE,
        seq INTEGER,
        endereco VARCHAR(500),
        cliente VARCHAR(200),
        pedido VARCHAR(60),
        lat DOUBLE PRECISION,
        lng DOUBLE PRECISION,
        geo_ok BOOLEAN DEFAULT false
      )
    `);
    await p.query(`CREATE INDEX IF NOT EXISTS idx_logi_paradas_rota ON logi_rotas_paradas (rota_id, seq)`);
    console.log('5/5 logi_rotas_paradas OK');

    // Tabela de valores por modelo (pagamento por km) — parte da "Nova Política"
    await p.query(`
      CREATE TABLE IF NOT EXISTS logi_rotas_tabela_valor (
        id SERIAL PRIMARY KEY,
        organizacao_id INTEGER NOT NULL,
        modelo VARCHAR(60) NOT NULL,
        valor_km NUMERIC(10,4) NOT NULL DEFAULT 0,
        valor_fixo NUMERIC(10,2) NOT NULL DEFAULT 0,
        ativo BOOLEAN DEFAULT true,
        UNIQUE (organizacao_id, modelo)
      )
    `);
    console.log('6/6 logi_rotas_tabela_valor OK');

    console.log('MIGRATION_ROTAS_OK');
  } catch (err) {
    console.error('ERRO:', err.message);
    process.exitCode = 1;
  } finally {
    await p.end();
  }
}
run();
