/**
 * Completa o cadastro de veículos e motoristas usados no apontamento de saída.
 * Só insere o que falta (compara placa normalizada e nome), então pode rodar
 * mais de uma vez sem duplicar.
 */
require('dotenv').config();
const { Pool } = require('pg');
const p = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });

const ORG = process.argv[2]; // id da organização

const VEICULOS = [
  { placa: 'FDB5C22', tipo: 'IVECO' },
  { placa: 'EVL1I34', tipo: 'IVECO' },
  { placa: 'BPB4D10', tipo: 'TOCO' },
  { placa: 'HGH2D38', tipo: 'TOCO' },
  { placa: 'FMP3C90', tipo: 'IVECO' },
  { placa: 'BYB3J54', tipo: 'IVECO' },
  { placa: 'OLI7G64', tipo: 'IVECO' },
  { placa: 'LUH8D61', tipo: 'IVECO' },
  { placa: 'JJI8F78', tipo: 'IVECO' },
  { placa: 'JAI4A92', tipo: 'IVECO' },
  { placa: 'FHG7D90', tipo: 'IVECO' },
  { placa: 'DMN3127', tipo: 'TOCO' },
];

const MOTORISTAS = [
  'Adenilton Mendes Rodrigues',
  'Edison Peres Pinheiro Junior',
  'Guilherme do Nascimento Silva',
  'Henrique Cesar Dos Santos',
  'João Victor Ferraz da Silva',
  'Jose Felipe de Oliveira',
  'Marcio Kendy Moreira de Godoy',
  'Michel Felipe Policante Santos',
  'Oswaldo Schwerz GOI',
  'Paulo Henrique Sousa Tavares',
  'Rafael Nunes Pinheiro',
  'Rodrigo De Godoi Pires',
  'Rodrigo Siqueira de Jesus',
  'Ronaldo Andrade Lourenço',
];

const soLetras = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
// compara nomes ignorando acento, caixa e espaços extras
const chaveNome = (s) => String(s || '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toUpperCase().replace(/\s+/g, ' ').trim();

async function main() {
  if (!ORG) { console.log('ERRO: informe o id da organizacao'); return; }

  // usa a mesma transportadora dos veículos já cadastrados na org
  const ref = await p.query(
    'SELECT transportadora_id FROM logi_veiculos WHERE organizacao_id = $1 AND transportadora_id IS NOT NULL LIMIT 1',
    [ORG]
  );
  const transportadoraId = ref.rows[0] ? ref.rows[0].transportadora_id : null;

  const vExist = await p.query('SELECT placa FROM logi_veiculos WHERE organizacao_id = $1', [ORG]);
  const placasExistentes = new Set(vExist.rows.map((r) => soLetras(r.placa)));

  let vNovos = 0;
  for (const v of VEICULOS) {
    if (placasExistentes.has(soLetras(v.placa))) continue;
    await p.query(
      `INSERT INTO logi_veiculos (organizacao_id, transportadora_id, placa, modelo, tipo, ativo, status_cadastro)
       VALUES ($1,$2,$3,$4,$5,true,'completo')`,
      [ORG, transportadoraId, v.placa, v.tipo, v.tipo]
    );
    vNovos += 1;
  }

  const mExist = await p.query('SELECT nome FROM logi_motoristas WHERE organizacao_id = $1', [ORG]);
  const nomesExistentes = new Set(mExist.rows.map((r) => chaveNome(r.nome)));

  let mNovos = 0;
  for (const nome of MOTORISTAS) {
    if (nomesExistentes.has(chaveNome(nome))) continue;
    // evita duplicar quem já existe com nome ligeiramente diferente
    const primeiro = chaveNome(nome).split(' ')[0];
    const ultimo = chaveNome(nome).split(' ').slice(-1)[0];
    const parecido = [...nomesExistentes].some((n) => n.includes(primeiro) && n.includes(ultimo));
    if (parecido) continue;

    await p.query(
      `INSERT INTO logi_motoristas (organizacao_id, transportadora_id, nome, ativo, status_cadastro)
       VALUES ($1,$2,$3,true,'completo')`,
      [ORG, transportadoraId, nome]
    );
    mNovos += 1;
  }

  const totV = await p.query('SELECT COUNT(*)::int c FROM logi_veiculos WHERE organizacao_id = $1 AND ativo', [ORG]);
  const totM = await p.query('SELECT COUNT(*)::int c FROM logi_motoristas WHERE organizacao_id = $1 AND ativo', [ORG]);
  console.log(`SEED_OK veiculos_novos=${vNovos} motoristas_novos=${mNovos} | total_veiculos=${totV.rows[0].c} total_motoristas=${totM.rows[0].c}`);
  await p.end();
}
main().catch((e) => { console.log('ERRO:', e.message); p.end().catch(() => {}); });
