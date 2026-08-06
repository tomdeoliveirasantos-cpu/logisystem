// Geocodificação + roteirização para o módulo Rotas & KM.
// - Geocode: Google (se GOOGLE_MAPS_KEY setada) com fallback Nominatim (grátis).
// - Cache em logi_geocache: endereço normalizado nunca é geocodificado 2x.
// - Rota real: OSRM público (grátis), somando trechos na ordem das paradas.
const https = require('https');
const http = require('http');
const db = require('../db');

const GOOGLE_KEY = process.env.GOOGLE_MAPS_KEY || '';

function httpJson(url, { timeout = 15000, client = https } = {}) {
  return new Promise((resolve, reject) => {
    const req = client.get(url, { headers: { 'User-Agent': 'logisystem-rotas/1.0' } }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { reject(new Error('resposta inválida')); }
      });
    });
    req.on('error', reject);
    req.setTimeout(timeout, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

// Normaliza o endereço p/ cache e p/ melhorar a geocodificação
function normalizar(endereco) {
  return String(endereco || '')
    .split(',')
    .map((p) => p.trim())
    .filter((p) => p && !/receber|não receber|nao receber|obs|observ/i.test(p))
    .join(', ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function geocodeGoogle(endereco) {
  const url = 'https://maps.googleapis.com/maps/api/geocode/json'
    + `?address=${encodeURIComponent(endereco + ', Brasil')}&region=br&key=${GOOGLE_KEY}`;
  const r = await httpJson(url);
  if (r.status === 'OK' && r.results && r.results[0]) {
    const loc = r.results[0].geometry.location;
    return { lat: loc.lat, lng: loc.lng, location_type: r.results[0].geometry.location_type, provider: 'google' };
  }
  return { erro: r.status, msg: r.error_message };
}

async function geocodeNominatim(endereco) {
  const url = 'https://nominatim.openstreetmap.org/search'
    + `?q=${encodeURIComponent(endereco + ', Brasil')}&format=json&limit=1`;
  const r = await httpJson(url);
  if (Array.isArray(r) && r[0]) {
    return { lat: parseFloat(r[0].lat), lng: parseFloat(r[0].lon), location_type: 'nominatim', provider: 'nominatim' };
  }
  return { erro: 'ZERO_RESULTS' };
}

// Geocodifica com cache. Retorna {lat,lng,provider} ou {erro}.
async function geocode(enderecoBruto) {
  const norm = normalizar(enderecoBruto);
  if (!norm) return { erro: 'ENDERECO_VAZIO' };

  const cache = await db.query('SELECT lat, lng, provider FROM logi_geocache WHERE endereco_norm = $1', [norm]);
  if (cache.rows[0] && cache.rows[0].lat != null) {
    return { lat: cache.rows[0].lat, lng: cache.rows[0].lng, provider: cache.rows[0].provider, cache: true };
  }

  let res = null;
  if (GOOGLE_KEY) {
    res = await geocodeGoogle(norm);
    if (res.erro && /billing|not activated|denied/i.test(res.msg || res.erro)) {
      // Google não disponível → tenta grátis
      res = await geocodeNominatim(norm);
    }
  } else {
    res = await geocodeNominatim(norm);
  }

  if (!res.erro) {
    await db.query(
      `INSERT INTO logi_geocache (endereco_norm, lat, lng, location_type, provider)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (endereco_norm) DO UPDATE SET lat=$2, lng=$3, location_type=$4, provider=$5`,
      [norm, res.lat, res.lng, res.location_type, res.provider]
    );
  }
  return res;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Distância real por ruas entre pontos [{lat,lng}], em km, via OSRM.
// Com retry: o OSRM público limita rajadas, então tentamos algumas vezes.
async function rotaOSRM(pontos, tentativas = 3) {
  const validos = pontos.filter((p) => p && p.lat != null && p.lng != null);
  if (validos.length < 2) return null;
  const coords = validos.map((p) => `${p.lng},${p.lat}`).join(';');
  const url = `http://router.project-osrm.org/route/v1/driving/${coords}?overview=false`;
  for (let t = 0; t < tentativas; t++) {
    try {
      const r = await httpJson(url, { client: http });
      if (r.code === 'Ok' && r.routes && r.routes[0]) {
        return Math.round((r.routes[0].distance / 1000) * 100) / 100;
      }
    } catch (e) { /* retry */ }
    await sleep(400 * (t + 1));
  }
  return null;
}

module.exports = { geocode, rotaOSRM, normalizar, sleep, temGoogle: () => !!GOOGLE_KEY };
