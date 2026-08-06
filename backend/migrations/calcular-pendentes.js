// Calcula km das rotas pendentes/falha de uma importação, direto no servidor.
require('dotenv').config();
const http = require('http');
const https = require('https');
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false, max: 3 });
const KEY = process.env.GOOGLE_MAPS_KEY || '';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function httpJson(url, client) {
  return new Promise((resolve, reject) => {
    const req = (client || https).get(url, { headers: { 'User-Agent': 'logi/1.0' } }, (res) => {
      let d = ''; res.on('data', (c) => { d += c; }); res.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { reject(e); } });
    });
    req.on('error', reject); req.setTimeout(20000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}
function norm(e) {
  return String(e || '').split(',').map((x) => x.trim()).filter((x) => x && !/receber/i.test(x)).join(', ').replace(/\s+/g, ' ').trim();
}
async function geocode(endBruto) {
  const n = norm(endBruto);
  if (!n || n === 'None') return null;
  const c = await pool.query('SELECT lat,lng FROM logi_geocache WHERE endereco_norm=$1', [n]);
  if (c.rows[0]) return { lat: c.rows[0].lat, lng: c.rows[0].lng };
  if (!KEY) return null;
  try {
    const r = await httpJson(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(n + ', Brasil')}&region=br&key=${KEY}`);
    if (r.status === 'OK' && r.results[0]) {
      const loc = r.results[0].geometry.location;
      await pool.query('INSERT INTO logi_geocache (endereco_norm,lat,lng,location_type,provider) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (endereco_norm) DO NOTHING',
        [n, loc.lat, loc.lng, r.results[0].geometry.location_type, 'google']);
      return { lat: loc.lat, lng: loc.lng };
    }
  } catch (e) { /* segue */ }
  return null;
}
async function osrm(pontos, tent = 3) {
  const v = pontos.filter((p) => p && p.lat != null);
  if (v.length < 2) return null;
  const coords = v.map((p) => `${p.lng},${p.lat}`).join(';');
  for (let t = 0; t < tent; t++) {
    try {
      const r = await httpJson(`http://router.project-osrm.org/route/v1/driving/${coords}?overview=false`, http);
      if (r.code === 'Ok' && r.routes[0]) return Math.round((r.routes[0].distance / 1000) * 100) / 100;
    } catch (e) { /* retry */ }
    await sleep(400 * (t + 1));
  }
  return null;
}

async function main() {
  const impId = process.argv[2];
  const cfgQ = await pool.query('SELECT c.* FROM logi_rotas_config c JOIN logi_rotas_importacoes i ON i.organizacao_id=c.organizacao_id WHERE i.id=$1', [impId]);
  const CD = cfgQ.rows[0];
  const tab = await pool.query('SELECT modelo,valor_km,valor_fixo FROM logi_rotas_tabela_valor WHERE organizacao_id=$1', [CD.organizacao_id]);
  const vpm = {}; tab.rows.forEach((t) => { vpm[String(t.modelo).toUpperCase().trim()] = t; });

  const rotas = await pool.query("SELECT id, modelo FROM logi_rotas WHERE importacao_id=$1 AND (status_calculo <> 'ok' OR valor_pago IS NULL)", [impId]);
  console.log('A CALCULAR=' + rotas.rows.length);
  let ok = 0, semEnd = 0;
  for (let i = 0; i < rotas.rows.length; i++) {
    const r = rotas.rows[i];
    const paradas = await pool.query('SELECT id, endereco, lat, lng FROM logi_rotas_paradas WHERE rota_id=$1 ORDER BY seq', [r.id]);
    const pontos = [{ lat: CD.cd_lat, lng: CD.cd_lng }];
    let falhas = 0;
    for (const p of paradas.rows) {
      if (p.lat != null) { pontos.push({ lat: p.lat, lng: p.lng }); continue; }
      const g = await geocode(p.endereco);
      if (g) {
        await pool.query('UPDATE logi_rotas_paradas SET lat=$1,lng=$2,geo_ok=true WHERE id=$3', [g.lat, g.lng, p.id]);
        pontos.push(g);
      } else falhas++;
    }
    const temParadas = pontos.length >= 2;
    const kmIda = temParadas ? await osrm(pontos) : null;
    const kmTot = temParadas ? await osrm([...pontos, { lat: CD.cd_lat, lng: CD.cd_lng }]) : null;
    const vm = vpm[String(r.modelo || '').toUpperCase().trim()];
    const kmPag = CD.incluir_volta ? kmTot : kmIda;
    const valor = (vm && kmPag != null && kmPag > 0) ? Math.round((Number(vm.valor_fixo) + kmPag * Number(vm.valor_km)) * 100) / 100 : null;
    const status = (kmIda != null && falhas === 0) ? 'ok' : (kmIda != null ? 'parcial' : 'falha');
    const obs = !temParadas ? 'Sem endereço de entrega na planilha' : (falhas ? `${falhas} endereço(s) não localizados` : null);
    await pool.query(
      'UPDATE logi_rotas SET km_calculado_ida=$1,km_calculado_total=$2,valor_km=$3,valor_fixo=$4,valor_pago=$5,status_calculo=$6,obs=$7 WHERE id=$8',
      [kmIda, kmTot, vm ? vm.valor_km : null, vm ? vm.valor_fixo : null, valor, status, obs, r.id]
    );
    if (status === 'ok') ok++; if (!temParadas) semEnd++;
    if ((i + 1) % 50 === 0) console.log(`  ${i + 1}/${rotas.rows.length} (ok=${ok})`);
    await sleep(120);
  }
  const t = await pool.query("SELECT COUNT(*) FILTER(WHERE status_calculo='ok')::int ok, COUNT(*) FILTER(WHERE status_calculo='falha')::int falha, ROUND(SUM(valor_pago)::numeric,2) total, ROUND(SUM(km_calculado_total)::numeric,0) km FROM logi_rotas WHERE importacao_id=$1", [impId]);
  console.log(`CALC_OK ok=${t.rows[0].ok} falha=${t.rows[0].falha} km=${t.rows[0].km} total=R$${t.rows[0].total}`);
  await pool.end();
}
main().catch((e) => { console.log('ERRO_FATAL:', e.message); pool.end().catch(() => {}); });
