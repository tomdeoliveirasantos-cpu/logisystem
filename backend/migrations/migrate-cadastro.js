const { Pool } = require('pg');
const p = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://wsdevsof_dev:wsdevsof_dev@15.235.54.115/wsdevsof_reciclagem',
  ssl: false
});

async function run() {
  try {
    await p.query(`
      CREATE TABLE IF NOT EXISTS logi_cadastro_convites (
        id SERIAL PRIMARY KEY,
        token VARCHAR(64) UNIQUE NOT NULL,
        nome_motorista VARCHAR(200),
        status VARCHAR(20) DEFAULT 'pendente',
        criado_por VARCHAR(100),
        preenchido_em TIMESTAMPTZ,
        expires_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    console.log('1/4 logi_cadastro_convites OK');

    await p.query(`
      CREATE TABLE IF NOT EXISTS logi_motorista_cadastros (
        id SERIAL PRIMARY KEY,
        convite_id INTEGER REFERENCES logi_cadastro_convites(id),
        nome VARCHAR(200), cpf VARCHAR(20), rg VARCHAR(30),
        cnh_numero VARCHAR(30), cnh_categoria VARCHAR(5), cnh_validade DATE,
        endereco VARCHAR(300), bairro VARCHAR(100), cidade VARCHAR(100), estado VARCHAR(2), cep VARCHAR(10),
        telefone VARCHAR(20), email VARCHAR(200),
        razao_social VARCHAR(300), cnpj VARCHAR(25),
        endereco_pj VARCHAR(300), bairro_pj VARCHAR(100), cidade_pj VARCHAR(100), estado_pj VARCHAR(2), cep_pj VARCHAR(10),
        data_abertura DATE,
        veiculo_placa VARCHAR(10), veiculo_modelo VARCHAR(100), veiculo_ano VARCHAR(4), veiculo_rntrc VARCHAR(50),
        banco VARCHAR(100), agencia VARCHAR(20), conta VARCHAR(30), tipo_conta VARCHAR(20), pix VARCHAR(200),
        doc_cnh VARCHAR(500), doc_cnpj_contrato VARCHAR(500), doc_rntrc VARCHAR(500), doc_comprovante_endereco VARCHAR(500),
        assinatura_path VARCHAR(500), assinatura_ip VARCHAR(50),
        check_cnh BOOLEAN DEFAULT false, check_cnpj BOOLEAN DEFAULT false,
        check_rntrc BOOLEAN DEFAULT false, check_endereco BOOLEAN DEFAULT false,
        status VARCHAR(20) DEFAULT 'pendente',
        validado_em TIMESTAMPTZ, validado_por VARCHAR(100),
        created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    console.log('2/4 logi_motorista_cadastros OK');

    await p.query('CREATE INDEX IF NOT EXISTS idx_cadastro_convites_token ON logi_cadastro_convites(token)');
    await p.query('CREATE INDEX IF NOT EXISTS idx_motorista_cadastros_convite ON logi_motorista_cadastros(convite_id)');
    await p.query('CREATE INDEX IF NOT EXISTS idx_motorista_cadastros_status ON logi_motorista_cadastros(status)');
    console.log('3/4 Indexes OK');

    console.log('MIGRATION_COMPLETE');
  } catch(e) {
    console.error('MIGRATION_ERROR:', e.message);
  }
  await p.end();
}
run();
