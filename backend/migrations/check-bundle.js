// Verifica se marcadores do código novo estão no bundle JS minificado
const fs = require('fs');
const path = require('path');
const dir = 'C:\\Desenvolvimento\\logisystem\\frontend\\dist\\assets';
const files = fs.readdirSync(dir).filter(f => /^index-.*\.js$/.test(f));
if (!files.length) { console.log('nenhum bundle index-*.js encontrado'); process.exit(0); }
const file = path.join(dir, files[0]);
const sz = fs.statSync(file).size;
const c = fs.readFileSync(file, 'utf8');
console.log(`Bundle: ${files[0]}  (${(sz/1024).toFixed(0)} KB)`);
const markers = [
  'Acesso ao app do motorista',
  'Gerar senha',
  'ModalMarcarParadaAdmin',
  'paradaMarcacao',
  'Esta tela está descontinuada',
  'Importar Roteasy',
  'Voltar para pendente',
  'tem_senha',
];
for (const m of markers) {
  console.log((c.includes(m) ? 'OK ' : 'FALTA ') + ' ' + m);
}
