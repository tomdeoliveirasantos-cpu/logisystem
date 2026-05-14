const fs = require('fs');
const dir = 'C:\\Desenvolvimento\\logisystem\\frontend\\dist\\assets';
const file = fs.readdirSync(dir).find(f => /^index-.*\.js$/.test(f));
const c = fs.readFileSync(`${dir}\\${file}`, 'utf8');
console.log(`Bundle: ${file} (${(c.length/1024).toFixed(0)} KB)`);
const markers = [
  // CPF na UI:
  '000.000.000-00',          // placeholder do CPF
  'form.cpf',                // referência ao campo cpf no form
  'set(\'cpf\',',            // setter do cpf
  'Preencha e salve o CPF',  // mensagem do bloco acesso
];
for (const m of markers) console.log((c.includes(m) ? 'OK    ' : 'FALTA ') + m);
