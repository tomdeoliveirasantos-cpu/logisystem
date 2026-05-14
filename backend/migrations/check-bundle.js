const fs = require('fs');
const dir = 'C:\\Desenvolvimento\\logisystem\\frontend\\dist\\assets';
const file = fs.readdirSync(dir).find(f => /^index-.*\.js$/.test(f));
const c = fs.readFileSync(`${dir}\\${file}`, 'utf8');
console.log(`Bundle: ${file} (${(c.length/1024).toFixed(0)} KB)`);
// Marcadores menos sensíveis a mangling: strings literais, placeholders
const markers = [
  ['Placeholder CPF (form colaborador OU login motorista)',  '000.000.000-00'],
  ['Mensagem do bloco "Acesso ao app"',                       'Preencha e salve o CPF'],
  ['Label "CPF" no bloco vínculos',                           '>CPF</'],
  ['Mensagem do bloco quando tem senha',                      'tem senha cadastrada'],
  ['Header da tela motorista mobile',                         'LogiSystem'],
  ['Ver entregas desta OT (botão 📦 na coluna Ação)',          'Ver entregas desta OT'],
  ['Marcar entrega (popup admin)',                            'Marcar entrega'],
  ['Aviso da página deprecada de Importar Planilha',          'Esta tela está descontinuada'],
];
for (const [desc, m] of markers) console.log((c.includes(m) ? 'OK    ' : 'FALTA ') + desc + ' — "' + m + '"');
