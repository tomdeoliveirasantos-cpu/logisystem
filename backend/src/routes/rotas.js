const express = require('express');
const multer = require('multer');
const XLSX = require('xlsx');
const db = require('../db');
const geo = require('../lib/geo');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// Colunas esperadas na aba analítica da planilha ROUTEASY
const COL = {
  data: ['DATA'], rota: ['ROTA'], pedido: ['PEDIDO'], seq: ['SEQ.', 'SEQ', 'SEQUENCIA'],
  cliente: ['CLIENTE'], km: ['KM'], endereco: ['ENDEREÇO', 'ENDERECO'],
  regiao: ['REGIÃO', 'REGIAO'], motorista: ['MOTORISTA'], placa: ['PLACA'], modelo: ['MODELO'],
};
function acharCol(headers, nomes) {
  for (const n of nomes) {
    const i = headers.findIndex((h) => String(h || '').trim().toUpperCase() === n.toUpperCase());
    if (i >= 0) return i;
  }
  return -1;
}

/* -------- Config (CD e política) -------- */
router.get('/config', async (req, res, next) => {
  try {
    const { rows } = await db.query('SELECT * FROM logi_rotas_config WHERE organizacao_id = $1', [req.organizacao_id]);
    const tab = await db.query('SELECT * FROM logi_rotas_tabela_valor WHERE organizacao_id = $1 ORDER BY modelo', [req.organizacao_id]);
    res.json({ config: rows[0] || null, tabela: tab.rows, geocoder: geo.temGoogle() ? 'google' : 'nominatim' });
  } catch (err) { next(err); }
});

router.put('/config', async (req, res, next) => {
  try {
    const { cd_endereco, incluir_volta } = req.body;
    let lat = null; let lng = null;
    if (cd_endereco) {
      const g = await geo.geocode(cd_endereco);
      if (!g.erro) { lat = g.lat; lng = g.lng; }
    }
    const { rows } = await db.query(
      `INSERT INTO logi_rotas_config (organizacao_id, cd_endereco, cd_lat, cd_lng, incluir_volta)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (organizacao_id) DO UPDATE SET cd_endereco=$2, cd_lat=$3, cd_lng=$4, incluir_volta=$5
       RETURNING *`,
      [req.organizacao_id, cd_endereco || null, lat, lng, incluir_volta !== false]
    );
    res.json(rows[0]);
  } catch (err) { next(err); }
});

/* -------- Tabela de valores por modelo -------- */
router.put('/tabela', async (req, res, next) => {
  try {
    const { itens } = req.body; // [{modelo, valor_km, valor_fixo}]
    if (!Array.isArray(itens)) return res.status(400).json({ error: 'itens inválido' });
    for (const it of itens) {
      if (!it.modelo) continue;
      await db.query(
        `INSERT INTO logi_rotas_tabela_valor (organizacao_id, modelo, valor_km, valor_fixo)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT (organizacao_id, modelo) DO UPDATE SET valor_km=$3, valor_fixo=$4`,
        [req.organizacao_id, it.modelo, Number(it.valor_km) || 0, Number(it.valor_fixo) || 0]
      );
    }
    const { rows } = await db.query('SELECT * FROM logi_rotas_tabela_valor WHERE organizacao_id = $1 ORDER BY modelo', [req.organizacao_id]);
    res.json(rows);
  } catch (err) { next(err); }
});

/* -------- Importar planilha -------- */
router.post('/importar', upload.single('arquivo'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Envie a planilha' });

    // Data de referência identifica a que período a planilha se refere.
    // Obrigatória para não misturar/sobrescrever importações de dias diferentes.
    const dataRef = (req.body.data_referencia || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dataRef)) {
      return res.status(400).json({ error: 'Informe a data de referência da planilha' });
    }
    const corteIni = /^\d{4}-\d{2}-\d{2}$/.test(req.body.data_corte_ini || '') ? req.body.data_corte_ini : null;
    const corteFim = /^\d{4}-\d{2}-\d{2}$/.test(req.body.data_corte_fim || '') ? req.body.data_corte_fim : null;
    const substituir = String(req.body.substituir) === 'true';

    // Já existe importação para essa data de referência?
    const jaTem = await db.query(
      'SELECT id, arquivo_nome, total_rotas FROM logi_rotas_importacoes WHERE organizacao_id = $1 AND data_referencia = $2',
      [req.organizacao_id, dataRef]
    );
    if (jaTem.rows[0] && !substituir) {
      return res.status(409).json({
        error: 'ja_importado',
        mensagem: `Já existe uma importação para ${dataRef.split('-').reverse().join('/')} `
          + `("${jaTem.rows[0].arquivo_nome}", ${jaTem.rows[0].total_rotas} rotas).`,
        importacao_id: jaTem.rows[0].id,
      });
    }
    if (jaTem.rows[0] && substituir) {
      // remove a anterior (cascade apaga rotas e paradas)
      await db.query('DELETE FROM logi_rotas_importacoes WHERE id = $1', [jaTem.rows[0].id]);
    }
    const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
    // aba analítica: a que tem ENDEREÇO e ROTA por linha
    let aba = wb.SheetNames.find((n) => /anal[ií]tico|routeasy/i.test(n));
    if (!aba) aba = wb.SheetNames[0];
    const linhas = XLSX.utils.sheet_to_json(wb.Sheets[aba], { header: 1, defval: null });
    if (!linhas.length) return res.status(400).json({ error: 'Planilha vazia' });

    const headers = linhas[0];
    const idx = {};
    for (const [k, nomes] of Object.entries(COL)) idx[k] = acharCol(headers, nomes);
    if (idx.rota < 0 || idx.endereco < 0) {
      return res.status(400).json({ error: 'Planilha sem colunas ROTA/ENDEREÇO reconhecíveis' });
    }

    function parseDataAux(v) {
      if (!v) return null;
      if (typeof v === 'number') {
        const d = XLSX.SSF.parse_date_code(v);
        return d ? `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}` : null;
      }
      const s2 = String(v);
      const m = s2.match(/(\d{4})-(\d{2})-(\d{2})/) || s2.match(/(\d{2})\/(\d{2})\/(\d{4})/);
      if (!m) return null;
      return m[1].length === 4 ? `${m[1]}-${m[2]}-${m[3]}` : `${m[3]}-${m[2]}-${m[1]}`;
    }

    // agrupa por (data, rota)
    const grupos = new Map();
    let ignoradas = 0;
    for (let i = 1; i < linhas.length; i++) {
      const row = linhas[i];
      const rota = row[idx.rota];
      if (!rota) continue;
      const dataVal = idx.data >= 0 ? row[idx.data] : null;

      // Corte por período: linhas fora da janela não entram
      if (corteIni || corteFim) {
        const d = parseDataAux(dataVal);
        if (!d || (corteIni && d < corteIni) || (corteFim && d > corteFim)) { ignoradas += 1; continue; }
      }
      const chave = `${dataVal}||${rota}`;
      if (!grupos.has(chave)) {
        grupos.set(chave, {
          data: dataVal, rota,
          motorista: idx.motorista >= 0 ? row[idx.motorista] : null,
          placa: idx.placa >= 0 ? row[idx.placa] : null,
          modelo: idx.modelo >= 0 ? row[idx.modelo] : null,
          regiao: idx.regiao >= 0 ? row[idx.regiao] : null,
          km_planilha: idx.km >= 0 ? row[idx.km] : null,
          paradas: [],
        });
      }
      grupos.get(chave).paradas.push({
        seq: idx.seq >= 0 ? row[idx.seq] : grupos.get(chave).paradas.length + 1,
        endereco: row[idx.endereco],
        cliente: idx.cliente >= 0 ? row[idx.cliente] : null,
        pedido: idx.pedido >= 0 ? row[idx.pedido] : null,
      });
    }

    if (grupos.size === 0) {
      return res.status(400).json({ error: 'Nenhuma linha da planilha está dentro do período informado.' });
    }

    const imp = await db.query(
      `INSERT INTO logi_rotas_importacoes
         (organizacao_id, arquivo_nome, total_rotas, total_paradas, criado_por,
          data_referencia, data_corte_ini, data_corte_fim, linhas_ignoradas)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [req.organizacao_id, req.file.originalname,
       grupos.size, [...grupos.values()].reduce((s, g) => s + g.paradas.length, 0),
       req.usuario?.nome || req.usuario?.email || null,
       dataRef, corteIni, corteFim, ignoradas]
    );
    const importacaoId = imp.rows[0].id;

    function parseData(v) {
      if (!v) return null;
      if (typeof v === 'number') { const d = XLSX.SSF.parse_date_code(v); return d ? `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}` : null; }
      const s = String(v);
      const m = s.match(/(\d{4})-(\d{2})-(\d{2})/) || s.match(/(\d{2})\/(\d{2})\/(\d{4})/);
      if (m) return m[1].length === 4 ? `${m[1]}-${m[2]}-${m[3]}` : `${m[3]}-${m[2]}-${m[1]}`;
      return null;
    }
    function numBR(v) {
      if (v == null || v === '') return null;
      if (typeof v === 'number') return v;
      const n = parseFloat(String(v).replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.'));
      return Number.isFinite(n) ? n : null;
    }

    for (const g of grupos.values()) {
      const rota = await db.query(
        `INSERT INTO logi_rotas
           (organizacao_id, importacao_id, data_rota, rota_codigo, motorista, placa, modelo, regiao, qtd_paradas, km_planilha)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
        [req.organizacao_id, importacaoId, parseData(g.data), String(g.rota),
         g.motorista, g.placa, g.modelo, g.regiao, g.paradas.length, numBR(g.km_planilha)]
      );
      const rotaId = rota.rows[0].id;
      g.paradas.sort((a, b) => (Number(a.seq) || 0) - (Number(b.seq) || 0));
      for (const p of g.paradas) {
        await db.query(
          `INSERT INTO logi_rotas_paradas (rota_id, seq, endereco, cliente, pedido)
           VALUES ($1,$2,$3,$4,$5)`,
          [rotaId, Number(p.seq) || null, p.endereco, p.cliente, p.pedido ? String(p.pedido) : null]
        );
      }
    }

    res.status(201).json({ importacao_id: importacaoId, rotas: grupos.size, ignoradas });
  } catch (err) { next(err); }
});

/* -------- Listar importações e rotas -------- */
router.get('/importacoes', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT i.*,
              (SELECT COUNT(*) FROM logi_rotas r WHERE r.importacao_id = i.id AND r.status_calculo = 'ok')::int AS calculadas
         FROM logi_rotas_importacoes i
        WHERE i.organizacao_id = $1 ORDER BY i.created_at DESC LIMIT 50`,
      [req.organizacao_id]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

router.get('/importacoes/:id/rotas', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT * FROM logi_rotas WHERE organizacao_id = $1 AND importacao_id = $2 ORDER BY data_rota, rota_codigo`,
      [req.organizacao_id, req.params.id]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

/* -------- Calcular KM de uma importação -------- */
router.post('/importacoes/:id/calcular', async (req, res, next) => {
  try {
    const cfg = await db.query('SELECT * FROM logi_rotas_config WHERE organizacao_id = $1', [req.organizacao_id]);
    const config = cfg.rows[0];
    if (!config || config.cd_lat == null) {
      return res.status(400).json({ error: 'Configure o endereço do CD antes de calcular (aba Configuração).' });
    }
    const tab = await db.query('SELECT modelo, valor_km, valor_fixo FROM logi_rotas_tabela_valor WHERE organizacao_id = $1 AND ativo', [req.organizacao_id]);
    const valorPorModelo = {};
    tab.rows.forEach((t) => { valorPorModelo[String(t.modelo).toUpperCase()] = t; });

    const rotas = await db.query(
      `SELECT id, modelo FROM logi_rotas WHERE organizacao_id = $1 AND importacao_id = $2 AND status_calculo <> 'ok'`,
      [req.organizacao_id, req.params.id]
    );

    let processadas = 0; let comFalha = 0;
    for (const r of rotas.rows) {
      const paradas = await db.query('SELECT * FROM logi_rotas_paradas WHERE rota_id = $1 ORDER BY seq', [r.id]);
      const pontos = [{ lat: config.cd_lat, lng: config.cd_lng }];
      let falhas = 0;
      for (const p of paradas.rows) {
        if (p.lat == null) {
          const g = await geo.geocode(p.endereco);
          if (!g.erro) {
            await db.query('UPDATE logi_rotas_paradas SET lat=$1, lng=$2, geo_ok=true WHERE id=$3', [g.lat, g.lng, p.id]);
            pontos.push({ lat: g.lat, lng: g.lng });
          } else { falhas += 1; }
        } else {
          pontos.push({ lat: p.lat, lng: p.lng });
        }
      }

      // Sem nenhuma parada localizada sobra só o CD: "CD -> CD" daria 0 km e
      // pagaria o valor fixo indevidamente. Nesse caso não há rota a calcular.
      const temParadas = pontos.length >= 2;
      const kmIda = temParadas ? await geo.rotaOSRM(pontos) : null;
      const kmTotal = temParadas
        ? await geo.rotaOSRM([...pontos, { lat: config.cd_lat, lng: config.cd_lng }])
        : null;

      const vm = valorPorModelo[String(r.modelo || '').toUpperCase()] || null;
      const kmParaPagar = config.incluir_volta ? kmTotal : kmIda;
      const valorPago = vm && kmParaPagar != null && kmParaPagar > 0
        ? Math.round((Number(vm.valor_fixo) + kmParaPagar * Number(vm.valor_km)) * 100) / 100
        : null;

      const obs = !temParadas
        ? 'Sem endereço de entrega na planilha'
        : (falhas ? `${falhas} endereço(s) não localizados` : null);

      await db.query(
        `UPDATE logi_rotas SET km_calculado_ida=$1, km_calculado_total=$2, valor_km=$3, valor_fixo=$4,
                valor_pago=$5, status_calculo=$6, obs=$7 WHERE id=$8`,
        [kmIda, kmTotal, vm ? vm.valor_km : null, vm ? vm.valor_fixo : null, valorPago,
         (kmIda != null && falhas === 0) ? 'ok' : (kmIda != null ? 'parcial' : 'falha'),
         obs, r.id]
      );
      processadas += 1;
      if (falhas || kmIda == null) comFalha += 1;
      await geo.sleep(250); // respiro para não estourar o rate limit do OSRM público
    }
    res.json({ processadas, com_falha: comFalha, geocoder: geo.temGoogle() ? 'google' : 'nominatim' });
  } catch (err) { next(err); }
});

/* -------- Mapa de uma rota (conferência do KM contado) -------- */
router.get('/rota/:id/mapa', async (req, res, next) => {
  try {
    const rota = await db.query(
      'SELECT * FROM logi_rotas WHERE id = $1 AND organizacao_id = $2',
      [req.params.id, req.organizacao_id]
    );
    if (!rota.rows[0]) return res.status(404).json({ error: 'Rota não encontrada' });

    const cfg = await db.query('SELECT * FROM logi_rotas_config WHERE organizacao_id = $1', [req.organizacao_id]);
    const config = cfg.rows[0];
    if (!config || config.cd_lat == null) {
      return res.status(400).json({ error: 'CD não configurado' });
    }

    const paradas = await db.query(
      'SELECT seq, endereco, cliente, lat, lng, geo_ok FROM logi_rotas_paradas WHERE rota_id = $1 ORDER BY seq',
      [req.params.id]
    );
    const comGeo = paradas.rows.filter((p) => p.lat != null);
    const cd = { lat: config.cd_lat, lng: config.cd_lng, endereco: config.cd_endereco };

    // Traçado exatamente como o KM é contado: CD -> paradas -> CD (ou até a última, se a política for só ida)
    const pontosIda = [cd, ...comGeo];
    const pontos = config.incluir_volta ? [...pontosIda, cd] : pontosIda;
    const rotaGeo = await geo.rotaOSRMComTracado(pontos);

    res.json({
      rota: rota.rows[0],
      cd,
      paradas: paradas.rows,
      paradas_sem_geo: paradas.rows.length - comGeo.length,
      incluir_volta: config.incluir_volta,
      tracado: rotaGeo ? rotaGeo.tracado : null,
      km_tracado: rotaGeo ? rotaGeo.km : null,
      minutos: rotaGeo ? rotaGeo.minutos : null,
    });
  } catch (err) { next(err); }
});

module.exports = router;
