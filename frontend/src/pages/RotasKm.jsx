import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import { useToast, Toast } from '../components/UI';
import MapaRota from '../components/MapaRota';

const fmt = (v) => (v !== null && v !== undefined
  ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v) : '—');
const fmtKm = (v) => (v !== null && v !== undefined ? `${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km` : '—');
const fmtData = (d) => (d ? String(d).substring(0, 10).split('-').reverse().join('/') : '—');

const BADGE = {
  ok: { txt: 'Calculada', cor: '#1a7f4b', bg: '#e7f6ee' },
  parcial: { txt: 'Parcial', cor: '#b7791f', bg: '#fef3e2' },
  falha: { txt: 'Falha', cor: '#c0392b', bg: '#fdecec' },
  pendente: { txt: 'Pendente', cor: '#667', bg: '#eef0f6' },
};

export default function RotasKm() {
  const { toast, showToast } = useToast();
  const [aba, setAba] = useState('importacoes');
  const [config, setConfig] = useState(null);
  const [tabela, setTabela] = useState([]);
  const [geocoder, setGeocoder] = useState('');
  const [importacoes, setImportacoes] = useState([]);
  const [selecao, setSelecao] = useState(null);
  const [rotas, setRotas] = useState([]);
  const [enviando, setEnviando] = useState(false);
  const [calculando, setCalculando] = useState(false);
  const [mapaRotaId, setMapaRotaId] = useState(null);
  const hoje = new Date().toISOString().substring(0, 10);
  const [dataRef, setDataRef] = useState(hoje);
  const [corteFim, setCorteFim] = useState('');

  const carregarConfig = useCallback(async () => {
    try {
      const d = await api.get('/rotas/config');
      setConfig(d.config || { cd_endereco: '', incluir_volta: true });
      setTabela(d.tabela.length ? d.tabela : []);
      setGeocoder(d.geocoder);
    } catch (e) { showToast(e.message); }
  }, []);

  const carregarImportacoes = useCallback(async () => {
    try {
      const lista = await api.get('/rotas/importacoes');
      setImportacoes(lista);
      // Abre automaticamente a importação mais recente — resultado direto na tela
      if (lista.length && !selecao) {
        const recente = lista[0];
        setSelecao(recente);
        setRotas(await api.get(`/rotas/importacoes/${recente.id}/rotas`));
      }
    } catch (e) { showToast(e.message); }
  }, [selecao]);

  useEffect(() => { carregarConfig(); carregarImportacoes(); }, [carregarConfig]);

  async function abrirImportacao(imp) {
    setSelecao(imp);
    try { setRotas(await api.get(`/rotas/importacoes/${imp.id}/rotas`)); } catch (e) { showToast(e.message); }
  }

  async function enviarPlanilha(e) {
    const arquivo = e.target.files[0];
    if (!arquivo) return;
    if (!dataRef) { showToast('Informe a data de referência da planilha'); e.target.value = ''; return; }
    await subirArquivo(arquivo, false);
    e.target.value = '';
  }

  async function subirArquivo(arquivo, substituir) {
    setEnviando(true);
    try {
      const fd = new FormData();
      fd.append('arquivo', arquivo);
      fd.append('data_referencia', dataRef);
      if (corteFim) fd.append('data_corte_fim', corteFim);
      if (substituir) fd.append('substituir', 'true');
      const r = await api.post('/rotas/importar', fd);
      showToast(`Planilha importada: ${r.rotas} rotas${r.ignoradas ? ` · ${r.ignoradas} linha(s) fora do período` : ''}`);
      setSelecao(null);
      await carregarImportacoes();
    } catch (err) {
      // já existe importação para essa data de referência
      const msg = String(err.message || '');
      if (msg.includes('ja_importado') || msg.includes('Já existe uma importação')) {
        const ok = window.confirm(
          `${msg}\n\nDeseja SUBSTITUIR a importação dessa data? A anterior será apagada.`
        );
        if (ok) { await subirArquivo(arquivo, true); return; }
        showToast('Importação cancelada — escolha outra data de referência');
      } else {
        showToast(msg);
      }
    } finally { setEnviando(false); }
  }

  async function calcular(imp) {
    if (!config?.cd_lat && !config?.cd_endereco) {
      showToast('Configure o endereço do CD primeiro (aba Configuração)');
      setAba('config');
      return;
    }
    setCalculando(true);
    try {
      const r = await api.post(`/rotas/importacoes/${imp.id}/calcular`);
      showToast(`Cálculo concluído: ${r.processadas} rotas${r.com_falha ? `, ${r.com_falha} com pendência` : ''}`);
      await abrirImportacao(imp);
      await carregarImportacoes();
    } catch (err) { showToast(err.message); } finally { setCalculando(false); }
  }

  async function salvarConfig() {
    try {
      const salvo = await api.put('/rotas/config', {
        cd_endereco: config.cd_endereco,
        incluir_volta: config.incluir_volta,
      });
      setConfig(salvo);
      showToast('Configuração salva' + (salvo.cd_lat ? ' e CD localizado ✓' : ' (CD não localizado — revise o endereço)'));
    } catch (e) { showToast(e.message); }
  }

  async function salvarTabela() {
    try {
      const salvo = await api.put('/rotas/tabela', { itens: tabela });
      setTabela(salvo);
      showToast('Tabela de valores salva');
    } catch (e) { showToast(e.message); }
  }

  function addModelo() {
    setTabela([...tabela, { modelo: '', valor_km: 0, valor_fixo: 0, _novo: true }]);
  }

  function exportarCSV() {
    if (!rotas.length) return;
    const head = ['Data', 'Rota', 'Motorista', 'Placa', 'Modelo', 'Paradas', 'KM planilha', 'KM ida', 'KM ida+volta', 'Valor pago', 'Status'];
    const linhas = rotas.map((r) => [
      fmtData(r.data_rota), r.rota_codigo, r.motorista || '', r.placa || '', r.modelo || '',
      r.qtd_paradas, r.km_planilha ?? '', r.km_calculado_ida ?? '', r.km_calculado_total ?? '',
      r.valor_pago ?? '', BADGE[r.status_calculo]?.txt || r.status_calculo,
    ]);
    const csv = [head, ...linhas].map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `rotas-km-${selecao?.id || ''}.csv`;
    a.click();
  }

  const pendentes = rotas.filter((r) => r.status_calculo === 'pendente').length;
  const semEndereco = rotas.filter((r) => r.status_calculo === 'falha').length;

  // Enquanto houver rotas na fila, atualiza sozinho a cada 10s
  useEffect(() => {
    if (!selecao || pendentes === 0) return undefined;
    const t = setInterval(async () => {
      try { setRotas(await api.get(`/rotas/importacoes/${selecao.id}/rotas`)); } catch { /* silencioso */ }
    }, 10000);
    return () => clearInterval(t);
  }, [selecao, pendentes]);

  const totalPago = rotas.reduce((s, r) => s + (Number(r.valor_pago) || 0), 0);
  const totalKm = rotas.reduce((s, r) => s + (Number(config?.incluir_volta ? r.km_calculado_total : r.km_calculado_ida) || 0), 0);

  return (
    <div className="page">
      {toast && <Toast msg={toast} />}
      {mapaRotaId && <MapaRota rotaId={mapaRotaId} onFechar={() => setMapaRotaId(null)} />}
      <div className="page-head">
        <h1>Rotas &amp; KM</h1>
        <span className="geo-tag" title="Geocodificador ativo">
          {geocoder === 'google' ? '📍 Google Maps' : '📍 OpenStreetMap (grátis)'}
        </span>
      </div>

      {rotas.length > 0 && (
        <div className="totais-destaque">
          <div className="total-card">
            <span className="total-num">{rotas.length}</span>
            <span className="total-lbl">rotas na planilha</span>
          </div>
          <div className="total-card ok">
            <span className="total-num">{rotas.filter((r) => r.status_calculo === 'ok').length}</span>
            <span className="total-lbl">calculadas{pendentes > 0 ? ` · ${pendentes} na fila` : ''}</span>
          </div>
          <div className="total-card">
            <span className="total-num">{fmtKm(totalKm)}</span>
            <span className="total-lbl">KM total {config?.incluir_volta ? '(ida+volta)' : '(só ida)'}</span>
          </div>
          <div className="total-card valor">
            <span className="total-num">{fmt(totalPago)}</span>
            <span className="total-lbl">total a pagar</span>
          </div>
        </div>
      )}

      <div className="tabs">
        {[['importacoes', 'Importações'], ['config', 'Configuração']].map(([id, lbl]) => (
          <button key={id} className={`tab ${aba === id ? 'active' : ''}`} onClick={() => setAba(id)}>{lbl}</button>
        ))}
      </div>

      {aba === 'importacoes' && (
        <>
          <div className="card upload-card">
            <div className="upload-txt">
              <strong>Importar planilha de entregas</strong>
              <p className="muted">Arquivo .xlsx (aba "Dados Analíticos - ROUTEASY"). Agrupamos por rota e calculamos o KM real.</p>
            </div>

            <div className="upload-datas">
              <label className="field-inline obrigatorio">
                <span>Data de referência *</span>
                <input type="date" value={dataRef} onChange={(ev) => setDataRef(ev.target.value)} />
                <small>Identifica a que dia/período a planilha se refere</small>
              </label>
              <label className="field-inline">
                <span>Data de corte</span>
                <input type="date" value={corteFim} onChange={(ev) => setCorteFim(ev.target.value)} />
                <small>Opcional — ignora entregas depois desta data</small>
              </label>
            </div>

            <label className={`btn btn-primary ${!dataRef ? 'btn-off' : ''}`}>
              {enviando ? 'Enviando…' : 'Escolher planilha'}
              <input type="file" accept=".xlsx,.xls" hidden onChange={enviarPlanilha} disabled={enviando || !dataRef} />
            </label>
          </div>

          <div className="split">
            <div className="card">
              <h3>Importações</h3>
              {importacoes.length === 0 && <p className="muted">Nenhuma planilha importada ainda.</p>}
              <ul className="lista-imp">
                {importacoes.map((imp) => (
                  <li key={imp.id} className={selecao?.id === imp.id ? 'sel' : ''} onClick={() => abrirImportacao(imp)}>
                    <div>
                      <strong>
                        {imp.data_referencia
                          ? String(imp.data_referencia).substring(0, 10).split('-').reverse().join('/')
                          : (imp.arquivo_nome || `Importação #${imp.id}`)}
                      </strong>
                      <span className="muted">{imp.total_rotas} rotas · {imp.total_paradas} paradas · {imp.calculadas} calculadas</span>
                      {imp.data_referencia && <span className="muted mini-arq">{imp.arquivo_nome}</span>}
                    </div>
                    <button className="btn btn-sm" disabled={calculando}
                      onClick={(e) => { e.stopPropagation(); calcular(imp); }}>
                      {calculando ? '...' : 'Calcular KM'}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div className="card">
              <div className="row-between">
                <h3>{selecao ? `Rotas de ${selecao.arquivo_nome || '#' + selecao.id}` : 'Selecione uma importação'}</h3>
                {rotas.length > 0 && <button className="btn btn-sm" onClick={exportarCSV}>Exportar CSV</button>}
              </div>
              {rotas.length > 0 && (
                <div className="resumo-linha">
                  <span>Total KM: <strong>{fmtKm(totalKm)}</strong></span>
                  <span>Total a pagar: <strong>{fmt(totalPago)}</strong></span>
                </div>
              )}
              {pendentes > 0 && (
                <p className="aviso processando">
                  Calculando… {pendentes} rota(s) na fila. A tela atualiza sozinha — pode sair e voltar depois.
                </p>
              )}
              {pendentes === 0 && semEndereco > 0 && (
                <p className="aviso">
                  {semEndereco} rota(s) sem endereço de entrega na planilha — não é possível calcular o KM delas.
                </p>
              )}
              <div className="tabela-scroll">
                <table className="tabela">
                  <thead>
                    <tr><th>Data</th><th>Rota</th><th>Motorista</th><th>Modelo</th><th>Par.</th><th>KM ida</th><th>KM +volta</th><th>Valor</th><th>Status</th><th>Mapa</th></tr>
                  </thead>
                  <tbody>
                    {rotas.map((r) => {
                      const b = BADGE[r.status_calculo] || BADGE.pendente;
                      return (
                        <tr key={r.id}>
                          <td>{fmtData(r.data_rota)}</td>
                          <td>{r.rota_codigo}</td>
                          <td title={r.motorista}>{(r.motorista || '—').split(' ').slice(0, 2).join(' ')}</td>
                          <td>{r.modelo || '—'}</td>
                          <td>{r.qtd_paradas}</td>
                          <td>{fmtKm(r.km_calculado_ida)}</td>
                          <td>{fmtKm(r.km_calculado_total)}</td>
                          <td>{fmt(r.valor_pago)}</td>
                          <td><span className="badge" style={{ color: b.cor, background: b.bg }}>{b.txt}</span></td>
                          <td>
                            {r.km_calculado_ida != null && (
                              <button className="btn-mapa" title="Ver no mapa o trajeto contado"
                                onClick={() => setMapaRotaId(r.id)}>🗺️</button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {!rotas.length && selecao && <tr><td colSpan={10} className="muted center">Sem rotas nesta importação.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}

      {aba === 'config' && config && (
        <div className="split">
          <div className="card">
            <h3>Centro de Distribuição (ponto de partida)</h3>
            <p className="muted">Todas as rotas partem (e retornam) deste endereço.</p>
            <label className="field">
              <span>Endereço do CD</span>
              <input value={config.cd_endereco || ''} onChange={(e) => setConfig({ ...config, cd_endereco: e.target.value })}
                placeholder="Rua, número, bairro, cidade - UF, CEP" />
            </label>
            <label className="check">
              <input type="checkbox" checked={config.incluir_volta !== false}
                onChange={(e) => setConfig({ ...config, incluir_volta: e.target.checked })} />
              <span>Incluir o retorno ao CD no KM pago (ida e volta)</span>
            </label>
            {config.cd_lat != null && <p className="muted ok-txt">✓ CD localizado no mapa</p>}
            <button className="btn btn-primary" onClick={salvarConfig}>Salvar configuração</button>
          </div>

          <div className="card">
            <div className="row-between">
              <h3>Valores por modelo (pagamento por KM)</h3>
              <button className="btn btn-sm" onClick={addModelo}>+ Modelo</button>
            </div>
            <p className="muted">Valor pago = valor fixo + (KM × valor por KM), conforme o modelo do veículo da rota.</p>
            <table className="tabela">
              <thead><tr><th>Modelo</th><th>Valor por KM</th><th>Valor fixo</th></tr></thead>
              <tbody>
                {tabela.map((t, i) => (
                  <tr key={i}>
                    <td><input className="mini" value={t.modelo} onChange={(e) => { const c = [...tabela]; c[i] = { ...t, modelo: e.target.value }; setTabela(c); }} placeholder="HR, IVECO, TOCO…" /></td>
                    <td><input className="mini" type="number" step="0.0001" value={t.valor_km} onChange={(e) => { const c = [...tabela]; c[i] = { ...t, valor_km: e.target.value }; setTabela(c); }} /></td>
                    <td><input className="mini" type="number" step="0.01" value={t.valor_fixo} onChange={(e) => { const c = [...tabela]; c[i] = { ...t, valor_fixo: e.target.value }; setTabela(c); }} /></td>
                  </tr>
                ))}
                {!tabela.length && <tr><td colSpan={3} className="muted center">Nenhum modelo. Clique "+ Modelo".</td></tr>}
              </tbody>
            </table>
            <button className="btn btn-primary" onClick={salvarTabela}>Salvar valores</button>
          </div>
        </div>
      )}

      <style>{`
        .page-head{display:flex;align-items:center;gap:12px;justify-content:space-between;flex-wrap:wrap}
        .totais-destaque{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:14px 0 4px}
        @media(max-width:640px){.totais-destaque{grid-template-columns:repeat(2,1fr)}}
        .total-card{background:#fff;border:1px solid #e2e5ee;border-radius:12px;padding:14px 16px;display:grid;gap:2px}
        .total-card.ok{border-color:#b6e2c8;background:#f3fbf6}
        .total-card.valor{border-color:#c9942e;background:#fdf8ef}
        .total-num{font-size:24px;font-weight:800;color:#1a2b5c;line-height:1.1}
        .total-card.valor .total-num{color:#a06a12}
        .total-lbl{font-size:12px;color:#667}
        .aviso{font-size:12.5px;color:#8a6d3b;background:#fdf8ef;border:1px solid #f0e0c0;border-radius:8px;padding:8px 10px;margin:6px 0}
        .aviso.processando{color:#1a4f8a;background:#eef4fd;border-color:#cfe0f7}
        .geo-tag{font-size:12px;background:#eef0f6;color:#445;padding:4px 10px;border-radius:999px}
        .tabs{display:flex;gap:4px;border-bottom:1px solid #e2e5ee;margin:12px 0 16px}
        .tab{background:none;border:none;border-bottom:2px solid transparent;padding:8px 14px;cursor:pointer;color:#667;font-weight:500}
        .tab.active{color:#1a2b5c;border-bottom-color:#c9942e;font-weight:700}
        .upload-card{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:12px}
        .upload-txt{flex:1 1 240px}
        .upload-datas{display:flex;gap:10px;flex-wrap:wrap}
        .field-inline{display:grid;gap:3px}
        .field-inline span{font-size:12px;color:#667;font-weight:600}
        .field-inline small{font-size:10.5px;color:#99a}
        .field-inline input{border:1px solid #d5d9e6;border-radius:6px;padding:7px 9px;font:inherit;font-size:13px}
        .field-inline.obrigatorio input{border-color:#c9942e}
        .btn-off{opacity:.5;pointer-events:none}
        .mini-arq{font-size:10.5px;opacity:.75}
        .btn-mapa{background:none;border:none;cursor:pointer;font-size:16px;padding:2px 4px;border-radius:6px}
        .btn-mapa:hover{background:#eef0f6}
        .split{display:grid;grid-template-columns:minmax(280px,380px) 1fr;gap:12px}
        @media(max-width:880px){.split{grid-template-columns:1fr}}
        .lista-imp{list-style:none;margin:0;padding:0;display:grid;gap:6px}
        .lista-imp li{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:10px;border:1px solid #e2e5ee;border-radius:8px;cursor:pointer}
        .lista-imp li.sel{border-color:#2547e8;background:#f5f7ff}
        .lista-imp li div{display:grid}
        .resumo-linha{display:flex;gap:20px;padding:8px 0;font-size:14px}
        .tabela-scroll{overflow-x:auto}
        .tabela{width:100%;border-collapse:collapse;font-size:13px}
        .tabela th,.tabela td{text-align:left;padding:7px 8px;border-bottom:1px solid #eef0f6;white-space:nowrap}
        .tabela th{color:#667;font-weight:600;font-size:12px}
        .badge{font-size:11px;font-weight:600;padding:2px 8px;border-radius:999px}
        .field{display:grid;gap:4px;margin:10px 0}
        .field input,.mini{border:1px solid #d5d9e6;border-radius:6px;padding:8px 10px;font:inherit}
        .mini{width:100%}
        .check{display:flex;align-items:center;gap:8px;margin:10px 0}
        .muted{color:#889;font-size:13px;margin:2px 0}
        .ok-txt{color:#1a7f4b}
        .center{text-align:center}
        .row-between{display:flex;justify-content:space-between;align-items:center;gap:8px}
        .btn{border:1px solid #d5d9e6;background:#fff;border-radius:8px;padding:9px 14px;cursor:pointer;font:inherit;font-weight:500}
        .btn-primary{background:#2547e8;color:#fff;border-color:#2547e8}
        .btn-sm{padding:6px 10px;font-size:13px}
        .card{background:#fff;border:1px solid #e2e5ee;border-radius:12px;padding:16px}
      `}</style>
    </div>
  );
}
