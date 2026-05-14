const fs = require('fs');
const dir = 'C:\\Desenvolvimento\\logisystem\\frontend\\dist\\assets';
const file = fs.readdirSync(dir).find(f => /^index-.*\.js$/.test(f));
const c = fs.readFileSync(`${dir}\\${file}`, 'utf8');

// Quantas vezes o placeholder do CPF aparece?
const re = /000\.000\.000-00/g;
const matches = c.match(re) || [];
console.log(`Placeholder '000.000.000-00' aparece ${matches.length}x no bundle`);
console.log('Esperado: 2x (1 no form de colaborador admin, 1 na tela login mobile)');

// CPF como label
console.log('\nVerificando se há label CPF no React (procuro pelo padrão de Field):');
// Bundle minifica { label: "CPF" } pra { label:"CPF" } (sem espaço)
console.log("  label:\"CPF\" =>", c.includes('label:"CPF"') ? 'OK' : 'FALTA');
console.log('  "CPF":', (c.match(/"CPF"/g) || []).length, 'ocorrência(s)');

// E o source no servidor?
const src = fs.readFileSync('C:\\Desenvolvimento\\logisystem\\frontend\\src\\pages\\OtherPages.jsx', 'utf8');
console.log('\nSOURCE OtherPages.jsx no servidor:');
console.log('  contém "form.cpf":', src.includes('form.cpf'));
console.log('  contém "label=\\"CPF\\"":', src.includes('label="CPF"'));
console.log('  contém "cpf:row.cpf":', src.includes('cpf:row.cpf'));
