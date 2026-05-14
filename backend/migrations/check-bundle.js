const fs = require('fs');
const path = require('path');
const dir = 'C:\\Desenvolvimento\\logisystem\\frontend\\dist\\assets';
const files = fs.readdirSync(dir).filter(f => /^index-.*\.js$/.test(f));
const file = path.join(dir, files[0]);
const c = fs.readFileSync(file, 'utf8');
console.log(`Bundle: ${files[0]} (${(c.length/1024).toFixed(0)} KB)`);
const markers = [
  'Acesso ao app do motorista',
  'Gerar senha',
  'Esta tela está descontinuada',
  'Voltar para pendente',
  'Ver entregas desta OT',     // título do botão 📦 na coluna Ação
  '/entregas?ot_id=',          // URL do link
  'Marcar entrega',            // título do popup
  'tem_senha',
];
for (const m of markers) console.log((c.includes(m) ? 'OK    ' : 'FALTA ') + m);
