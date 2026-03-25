const { Pool } = require('pg');
const pool = new Pool({ host:'15.235.54.115', port:5432, database:'wsdevsof_reciclagem', user:'wsdevsof_dev', password:'ww2018@#New', ssl:false });

const stmts = [
  // 1. Adiciona coluna ajudante_nome na ordem de transporte
  `ALTER TABLE logi_ordens_transporte
   ADD COLUMN IF NOT EXISTS ajudante_nome VARCHAR(150)`,

  // 2. Adiciona coluna tipo_lancamento em contas_pagar
  //    Valores: 'frete_agregado' | 'diaria_motorista' | 'diaria_ajudante'
  `ALTER TABLE logi_contas_pagar
   ADD COLUMN IF NOT EXISTS tipo_lancamento VARCHAR(30)
   DEFAULT 'frete_agregado'`,

  // 3. Adiciona coluna descricao em contas_pagar (para identificar o lançamento)
  `ALTER TABLE logi_contas_pagar
   ADD COLUMN IF NOT EXISTS descricao VARCHAR(200)`,

  // 4. Atualiza registros existentes sem tipo definido
  `UPDATE logi_contas_pagar
   SET tipo_lancamento = 'frete_agregado'
   WHERE tipo_lancamento IS NULL`,
];

async function run() {
  const c = await pool.connect();
  try {
    for (const s of stmts) {
      await c.query(s);
      process.stdout.write('.');
    }
    console.log('\n\n✅ Migration concluída!');
    console.log('  → logi_ordens_transporte: coluna ajudante_nome adicionada');
    console.log('  → logi_contas_pagar: coluna tipo_lancamento adicionada');
    console.log('  → logi_contas_pagar: coluna descricao adicionada');
  } catch (e) {
    console.error('\n❌ Erro:', e.message);
  } finally {
    c.release();
    process.exit(0);
  }
}
run();
