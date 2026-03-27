import { useState } from 'react';
import { api } from '../lib/api';
import { Field, Input, useToast, Toast } from '../components/UI';

const fmtDate = d => d ? new Date(d+'T12:00:00').toLocaleDateString('pt-BR') : '';

// ════ Função que desenha UMA rota no PDF ═════════════════════════════════════
function desenharRota(pdf, rotaData, dataStr, startNewPage) {
  if (startNewPage) pdf.addPage();

  const pw = 210, margin = 12;
  const usable = pw - margin * 2;
  let y = margin;

  // Cabeçalho
  pdf.setFillColor(248, 249, 252);
  pdf.rect(margin, y, usable, 22, 'F');
  pdf.setDrawColor(226, 232, 240);
  pdf.rect(margin, y, usable, 22, 'S');

  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(14); pdf.setTextColor(26, 39, 64);
  pdf.text('LogiSystem — Romaneio', margin + 4, y + 8);
  pdf.setFontSize(9); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(107, 114, 128);
  pdf.text(`Data: ${fmtDate(dataStr)}`, margin + 4, y + 15);

  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(16); pdf.setTextColor(37, 99, 235);
  pdf.text(`Rota ${rotaData.rota || '—'}`, margin + usable - 4, y + 8, { align: 'right' });
  pdf.setFontSize(8); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(107, 114, 128);
  pdf.text(`${rotaData.motorista || ''} — ${rotaData.veiculo || ''}`, margin + usable - 4, y + 15, { align: 'right' });
  y += 24;

  // Resumo
  const paradas = rotaData.paradas || [];
  const items = [
    { label: 'PARADAS', val: paradas.length },
    { label: 'PENDENTES', val: paradas.filter(p => p.status === 'pendente').length },
    { label: 'ENTREGUES', val: paradas.filter(p => p.status === 'entregue').length },
    { label: 'DEVOLUÇÕES', val: paradas.filter(p => p.status === 'devolucao').length },
  ];
  const cellW = usable / 4;
  items.forEach((item, i) => {
    const x = margin + i * cellW;
    pdf.setDrawColor(226, 232, 240); pdf.rect(x, y, cellW, 12, 'S');
    pdf.setFontSize(7); pdf.setTextColor(107, 114, 128);
    pdf.text(item.label, x + cellW / 2, y + 4, { align: 'center' });
    pdf.setFontSize(12); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(26, 39, 64);
    pdf.text(String(item.val), x + cellW / 2, y + 10, { align: 'center' });
    pdf.setFont('helvetica', 'normal');
  });
  y += 14;

  // Tabela header
  const cols = [
    { label: 'Seq', w: 10 }, { label: 'Cliente', w: 52 }, { label: 'Região', w: 28 },
    { label: 'NF', w: 20 }, { label: 'Peso', w: 18 }, { label: 'Status', w: 18 }, { label: 'Obs', w: 40 },
  ];
  pdf.setFillColor(241, 245, 249); pdf.rect(margin, y, usable, 7, 'F');
  pdf.setDrawColor(226, 232, 240); pdf.rect(margin, y, usable, 7, 'S');
  pdf.setFontSize(7); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(55, 65, 81);
  let cx = margin;
  cols.forEach(col => { pdf.text(col.label, cx + 2, y + 5); cx += col.w; });
  y += 7;

  // Linhas
  paradas.forEach((p, i) => {
    if (y > 265) { pdf.addPage(); y = margin; }
    const rowH = 8;
    if (i % 2 === 1) { pdf.setFillColor(248, 249, 252); pdf.rect(margin, y, usable, rowH, 'F'); }
    pdf.setDrawColor(240, 240, 240); pdf.line(margin, y + rowH, margin + usable, y + rowH);

    pdf.setFontSize(8); pdf.setTextColor(26, 39, 64);
    cx = margin;

    pdf.setFont('helvetica', 'bold');
    pdf.text(String(p.seq || i + 1), cx + 5, y + 5, { align: 'center' }); cx += cols[0].w;

    pdf.setFont('helvetica', 'normal');
    pdf.text((p.cliente_nome || '').substring(0, 30), cx + 2, y + 5); cx += cols[1].w;
    pdf.text((p.regiao || '—').substring(0, 16), cx + 2, y + 5); cx += cols[2].w;

    pdf.setFont('courier', 'normal');
    pdf.text((p.nf || '—').substring(0, 12), cx + 2, y + 5); cx += cols[3].w;

    pdf.setFont('helvetica', 'normal');
    pdf.text(p.peso ? Number(p.peso).toFixed(0) + ' kg' : '—', cx + 2, y + 5); cx += cols[4].w;

    const sLabel = p.status === 'entregue' ? 'Entregue' : p.status === 'devolucao' ? 'Devol.' : 'Pendente';
    const sColor = p.status === 'entregue' ? [22, 163, 74] : p.status === 'devolucao' ? [220, 38, 38] : [37, 99, 235];
    pdf.setTextColor(...sColor); pdf.setFontSize(7);
    pdf.text(sLabel, cx + 2, y + 5); cx += cols[5].w;

    pdf.setTextColor(107, 114, 128); pdf.setFontSize(7);
    pdf.text((p.obs || '').substring(0, 24), cx + 2, y + 5);

    pdf.setTextColor(26, 39, 64);
    y += rowH;
  });

  // Assinaturas
  y += 6;
  if (y > 255) { pdf.addPage(); y = margin; }
  y += 15;
  const sigW = usable / 2 - 10;
  pdf.setDrawColor(51, 51, 51);
  pdf.line(margin, y, margin + sigW, y);
  pdf.line(margin + usable - sigW, y, margin + usable, y);
  pdf.setFontSize(8); pdf.setTextColor(107, 114, 128);
  pdf.text('Assinatura do Motorista', margin + sigW / 2, y + 5, { align: 'center' });
  pdf.text('Assinatura do Conferente', margin + usable - sigW / 2, y + 5, { align: 'center' });
}

// ════ Função que gera o PDF e retorna o blob ═════════════════════════════════
async function criarPDFBlob(romaneio, rotas) {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF('p', 'mm', 'a4');
  rotas.forEach((rotaData, idx) => {
    desenharRota(pdf, rotaData, romaneio.data, idx > 0);
  });
  return pdf.output('blob');
}

// ════ Compartilhar ou baixar PDF ═════════════════════════════════════════════
async function compartilharPDF(blob, nomeArquivo) {
  // Tentar compartilhar como arquivo (só mobile com suporte real)
  try {
    const isMobile = /iPhone|iPad|Android/i.test(navigator.userAgent);
    if (isMobile && navigator.share && navigator.canShare) {
      const file = new File([blob], nomeArquivo, { type: 'application/pdf' });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file] });
        return 'shared';
      }
    }
  } catch(e) {
    if (e.name === 'AbortError') return 'cancelled';
    // Qualquer outro erro → fallback pro download
  }

  // Download direto (desktop e fallback)
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return 'downloaded';
}

// ════ Componente Principal ═══════════════════════════════════════════════════
export default function Romaneio() {
  const today = new Date().toISOString().split('T')[0];
  const [data, setData] = useState(today);
  const [rota, setRota] = useState('');
  const [romaneio, setRomaneio] = useState(null);
  const [loading, setLoading] = useState(false);
  const [gerando, setGerando] = useState('');
  const { toast, showToast } = useToast();

  const buscar = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ data });
      if (rota) params.set('rota', rota);
      const res = await api.get(`/relatorios/romaneio?${params}`);
      setRomaneio(res);
      if (!res.rotas?.length) showToast('Nenhuma rota encontrada', 'error');
    } catch(e) { showToast(e.message, 'error'); }
    finally { setLoading(false); }
  };

  // PDF de uma rota específica
  const gerarPDFRota = async (rotaData) => {
    setGerando(`rota_${rotaData.rota}`);
    try {
      const blob = await criarPDFBlob(romaneio, [rotaData]);
      const nome = `romaneio_${data}_rota_${rotaData.rota || 'sem'}.pdf`;
      const result = await compartilharPDF(blob, nome);
      if (result === 'downloaded') showToast('PDF baixado!');
      else if (result === 'shared') showToast('PDF compartilhado!');
    } catch(e) { showToast('Erro: ' + e.message, 'error'); }
    finally { setGerando(''); }
  };

  // PDF completo (todas as rotas)
  const gerarPDFCompleto = async () => {
    setGerando('completo');
    try {
      const blob = await criarPDFBlob(romaneio, romaneio.rotas);
      const nome = `romaneio_completo_${data}.pdf`;
      const result = await compartilharPDF(blob, nome);
      if (result === 'downloaded') showToast('PDF baixado!');
      else if (result === 'shared') showToast('PDF compartilhado!');
    } catch(e) { showToast('Erro: ' + e.message, 'error'); }
    finally { setGerando(''); }
  };

  return (
    <div>
      <div className="page-header">
        <div style={{flex:1}}>
          <div className="page-title">Romaneio de Entregas</div>
          <div className="page-desc">Gerar PDF das rotas do dia</div>
        </div>
      </div>

      <div className="page-body">
        {/* Filtros */}
        <div className="card mb-16">
          <div style={{display:'flex',gap:10,alignItems:'flex-end',flexWrap:'wrap'}}>
            <div style={{flex:'1 1 150px'}}>
              <Field label="Data *">
                <Input type="date" value={data} onChange={e=>setData(e.target.value)} />
              </Field>
            </div>
            <div style={{flex:'1 1 120px'}}>
              <Field label="Rota (opcional)">
                <Input type="number" value={rota} onChange={e=>setRota(e.target.value)} placeholder="Todas" />
              </Field>
            </div>
            <button className="btn btn-primary" onClick={buscar} disabled={loading}>
              {loading ? 'Buscando...' : 'Buscar'}
            </button>
          </div>
        </div>

        {/* Botão PDF completo */}
        {romaneio?.rotas?.length > 1 && (
          <div style={{marginBottom:16}}>
            <button className="btn btn-primary" onClick={gerarPDFCompleto} disabled={!!gerando}
              style={{background:'#16a34a',boxShadow:'0 2px 8px rgba(22,163,74,.25)'}}>
              {gerando === 'completo' ? 'Gerando...' : `📄 PDF Completo (${romaneio.rotas.length} rotas)`}
            </button>
          </div>
        )}

        {/* Cards por rota */}
        {romaneio?.rotas?.map((rotaData, idx) => (
          <div key={idx} className="card mb-16 fade-up">
            {/* Header da rota */}
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12,flexWrap:'wrap',gap:8}}>
              <div>
                <div style={{fontSize:16,fontWeight:700}}>Rota {rotaData.rota || '—'}</div>
                <div style={{fontSize:12,color:'var(--text3)'}}>
                  {rotaData.motorista} — {rotaData.veiculo} — {fmtDate(romaneio.data)}
                </div>
              </div>
              <div style={{display:'flex',gap:6}}>
                <button className="btn btn-primary btn-sm" onClick={()=>gerarPDFRota(rotaData)}
                  disabled={!!gerando}
                  style={{background:'#16a34a',fontSize:12}}>
                  {gerando === `rota_${rotaData.rota}` ? 'Gerando...' : '📄 PDF desta rota'}
                </button>
              </div>
            </div>

            {/* Resumo */}
            <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:0,marginBottom:12,border:'1px solid var(--border)',borderRadius:'var(--radius)',overflow:'hidden'}}>
              {[
                {label:'Paradas',val:rotaData.paradas.length,color:'var(--text)'},
                {label:'Pendentes',val:rotaData.paradas.filter(p=>p.status==='pendente').length,color:'var(--accent)'},
                {label:'Entregues',val:rotaData.paradas.filter(p=>p.status==='entregue').length,color:'var(--green)'},
                {label:'Devoluções',val:rotaData.paradas.filter(p=>p.status==='devolucao').length,color:'var(--red)'},
              ].map(k=>(
                <div key={k.label} style={{padding:'8px 6px',textAlign:'center',borderRight:'1px solid var(--border)'}}>
                  <div style={{fontSize:9,color:'var(--text3)',textTransform:'uppercase'}}>{k.label}</div>
                  <div style={{fontSize:15,fontWeight:700,color:k.color}}>{k.val}</div>
                </div>
              ))}
            </div>

            {/* Tabela */}
            <div className="table-wrap">
              <table>
                <thead><tr><th>Seq</th><th>Cliente</th><th>Região</th><th>NF</th><th>Peso</th><th>Status</th></tr></thead>
                <tbody>
                  {rotaData.paradas.map((p,i) => (
                    <tr key={p.id}>
                      <td className="fw-600">{p.seq||i+1}</td>
                      <td>
                        <div className="fw-500">{p.cliente_nome}</div>
                        {p.logradouro && <div style={{fontSize:10,color:'var(--text3)'}}>{p.logradouro}{p.cli_numero?', '+p.cli_numero:''}</div>}
                      </td>
                      <td style={{fontSize:12}}>{p.regiao||'—'}</td>
                      <td className="font-mono" style={{fontSize:11}}>{p.nf||'—'}</td>
                      <td style={{fontSize:12}}>{p.peso?Number(p.peso).toFixed(0)+' kg':'—'}</td>
                      <td>
                        <span className={`badge ${p.status==='entregue'?'badge-green':p.status==='devolucao'?'badge-red':'badge-blue'}`}>
                          {p.status==='entregue'?'Entregue':p.status==='devolucao'?'Devolução':'Pendente'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}

        {!romaneio && (
          <div className="card" style={{textAlign:'center',padding:'40px 0',color:'var(--text3)'}}>
            Selecione a data e clique em Buscar para gerar o romaneio.
          </div>
        )}
      </div>
      {toast && <Toast {...toast} />}
    </div>
  );
}
