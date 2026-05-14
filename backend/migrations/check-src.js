const fs = require('fs');
const src = fs.readFileSync('C:\\Desenvolvimento\\logisystem\\frontend\\src\\pages\\Ordens.jsx', 'utf8');
const bundleDir = 'C:\\Desenvolvimento\\logisystem\\frontend\\dist\\assets';
const bundleFile = fs.readdirSync(bundleDir).find(f => /^index-.*\.js$/.test(f));
const bundle = fs.readFileSync(`${bundleDir}\\${bundleFile}`, 'utf8');

const srcStat = fs.statSync('C:\\Desenvolvimento\\logisystem\\frontend\\src\\pages\\Ordens.jsx');
const bundleStat = fs.statSync(`${bundleDir}\\${bundleFile}`);

console.log('=== Datas ===');
console.log('Source Ordens.jsx:', srcStat.mtime.toISOString());
console.log('Bundle ' + bundleFile + ':', bundleStat.mtime.toISOString());

console.log('\n=== Source Ordens.jsx no servidor TEM os marcadores? ===');
for (const m of ['Ver entregas desta OT', 'Marcar entrega', 'ModalMarcarParadaAdmin', 'paradaMarcacao', 'recarregarParadas']) {
  console.log((src.includes(m) ? 'OK    ' : 'FALTA ') + m);
}

console.log('\n=== Bundle TEM os mesmos marcadores? ===');
for (const m of ['Ver entregas desta OT', 'Marcar entrega', 'Voltar para pendente', '/entregas?ot_id=']) {
  console.log((bundle.includes(m) ? 'OK    ' : 'FALTA ') + m);
}

console.log('\n=== Tamanhos ===');
console.log('Source:', src.length, 'chars,', src.split('\n').length, 'linhas');
console.log('Bundle:', bundle.length, 'chars');
