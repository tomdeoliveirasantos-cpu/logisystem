import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { api } from '../lib/api';

const fmtKm = (v) => (v != null ? `${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km` : '—');

/**
 * Mostra no mapa exatamente o trajeto que está sendo contado para o KM:
 * CD -> paradas na sequência de entrega -> CD (quando a política inclui a volta).
 * Serve para o cliente conferir se o KM cobrado corresponde ao caminho real.
 */
export default function MapaRota({ rotaId, onFechar }) {
  const divRef = useRef(null);
  const mapRef = useRef(null);
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const d = await api.get(`/rotas/rota/${rotaId}/mapa`);
        if (vivo) setDados(d);
      } catch (e) { if (vivo) setErro(e.message); }
    })();
    return () => { vivo = false; };
  }, [rotaId]);

  useEffect(() => {
    if (!dados || !divRef.current || mapRef.current) return;

    const mapa = L.map(divRef.current, { scrollWheelZoom: true });
    mapRef.current = mapa;
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 19,
    }).addTo(mapa);

    const pontos = [];

    // Traçado real por ruas (o mesmo usado no cálculo do KM)
    if (dados.tracado?.coordinates?.length) {
      const linha = dados.tracado.coordinates.map(([lng, lat]) => [lat, lng]);
      L.polyline(linha, { color: '#2547e8', weight: 4, opacity: 0.75 }).addTo(mapa);
      pontos.push(...linha);
    }

    // CD (partida e chegada)
    const iconeCD = L.divIcon({
      className: '',
      html: '<div style="background:#1a7f4b;color:#fff;width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)">CD</div>',
      iconSize: [30, 30], iconAnchor: [15, 15],
    });
    L.marker([dados.cd.lat, dados.cd.lng], { icon: iconeCD })
      .addTo(mapa)
      .bindPopup(`<strong>Centro de Distribuição</strong><br>${dados.cd.endereco || ''}`);
    pontos.push([dados.cd.lat, dados.cd.lng]);

    // Paradas numeradas na ordem de entrega
    dados.paradas.filter((p) => p.lat != null).forEach((p, i) => {
      const icone = L.divIcon({
        className: '',
        html: `<div style="background:#c9942e;color:#fff;width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35)">${i + 1}</div>`,
        iconSize: [26, 26], iconAnchor: [13, 13],
      });
      L.marker([p.lat, p.lng], { icon: icone })
        .addTo(mapa)
        .bindPopup(`<strong>Parada ${i + 1}</strong><br>${p.cliente || ''}<br><small>${p.endereco || ''}</small>`);
      pontos.push([p.lat, p.lng]);
    });

    if (pontos.length) mapa.fitBounds(L.latLngBounds(pontos), { padding: [30, 30] });

    return () => { mapa.remove(); mapRef.current = null; };
  }, [dados]);

  const r = dados?.rota;

  return (
    <div className="mapa-overlay" onClick={onFechar}>
      <div className="mapa-modal" onClick={(e) => e.stopPropagation()}>
        <div className="mapa-head">
          <div>
            <strong>Rota {r?.rota_codigo || ''}</strong>
            <span className="mapa-sub">
              {r?.motorista || ''} {r?.modelo ? `· ${r.modelo}` : ''}
              {r?.data_rota ? ` · ${String(r.data_rota).substring(0, 10).split('-').reverse().join('/')}` : ''}
            </span>
          </div>
          <button className="mapa-fechar" onClick={onFechar} aria-label="Fechar">✕</button>
        </div>

        {erro && <p className="mapa-erro">{erro}</p>}
        {!dados && !erro && <p className="mapa-carregando">Carregando trajeto…</p>}

        {dados && (
          <>
            <div className="mapa-resumo">
              <span>Paradas: <strong>{dados.paradas.length}</strong></span>
              <span>KM ida: <strong>{fmtKm(r?.km_calculado_ida)}</strong></span>
              <span>KM ida+volta: <strong>{fmtKm(r?.km_calculado_total)}</strong></span>
              <span className="mapa-contado">
                Contado: <strong>{fmtKm(dados.incluir_volta ? r?.km_calculado_total : r?.km_calculado_ida)}</strong>
                {dados.incluir_volta ? ' (com retorno ao CD)' : ' (só ida)'}
              </span>
            </div>
            {dados.paradas_sem_geo > 0 && (
              <p className="mapa-aviso">
                {dados.paradas_sem_geo} parada(s) sem endereço localizado não entram no trajeto nem no KM.
              </p>
            )}
          </>
        )}

        <div ref={divRef} className="mapa-canvas" />

        <div className="mapa-legenda">
          <span><i className="leg cd" />CD (partida/chegada)</span>
          <span><i className="leg parada" />Paradas na ordem de entrega</span>
          <span><i className="leg linha" />Trajeto contado no KM</span>
        </div>
      </div>

      <style>{`
        .mapa-overlay{position:fixed;inset:0;background:rgba(15,20,40,.55);display:flex;align-items:center;justify-content:center;z-index:1000;padding:16px}
        .mapa-modal{background:#fff;border-radius:14px;width:min(940px,100%);max-height:92vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 12px 40px rgba(0,0,0,.3)}
        .mapa-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;padding:14px 16px;border-bottom:1px solid #e2e5ee}
        .mapa-head strong{display:block;font-size:16px;color:#1a2b5c}
        .mapa-sub{font-size:12.5px;color:#667}
        .mapa-fechar{background:none;border:none;font-size:18px;cursor:pointer;color:#667;line-height:1;padding:4px}
        .mapa-resumo{display:flex;flex-wrap:wrap;gap:14px;padding:10px 16px;font-size:13px;background:#f7f8fc}
        .mapa-resumo strong{color:#1a2b5c}
        .mapa-contado{color:#a06a12}
        .mapa-contado strong{color:#a06a12}
        .mapa-aviso{margin:0;padding:8px 16px;font-size:12.5px;color:#8a6d3b;background:#fdf8ef}
        .mapa-erro{padding:16px;color:#c0392b}
        .mapa-carregando{padding:16px;color:#667}
        .mapa-canvas{flex:1;min-height:380px;height:52vh}
        .mapa-legenda{display:flex;flex-wrap:wrap;gap:16px;padding:10px 16px;font-size:12px;color:#667;border-top:1px solid #e2e5ee}
        .mapa-legenda span{display:flex;align-items:center;gap:6px}
        .leg{width:12px;height:12px;border-radius:50%;display:inline-block}
        .leg.cd{background:#1a7f4b}
        .leg.parada{background:#c9942e}
        .leg.linha{width:18px;height:3px;border-radius:2px;background:#2547e8}
        @media(max-width:640px){.mapa-canvas{height:46vh;min-height:300px}.mapa-resumo{gap:10px;font-size:12px}}
      `}</style>
    </div>
  );
}
