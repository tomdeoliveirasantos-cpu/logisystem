import { useState } from 'react';
import { api } from '../lib/api';
import { Field, Input, useToast, Toast } from '../components/UI';

const fmtDate = d => d ? new Date(d+'T12:00:00').toLocaleDateString('pt-BR') : '';

export default function Romaneio() {
  const today = new Date().toISOString().split('T')[0];
  const [data, setData] = useState(today);
  const [rota, setRota] = useState('');
  const [romaneio, setRomaneio] = useState(null);
  const [loading, setLoading] = useState(false);
  const [gerando, setGerando] = useState(false);
  const { toast, showToast } = useToast();

  const buscar = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ data });
      if (rota) params.set('rota', rota);
      const res = await api.get(`/relatorios/romaneio?${params}`);
      setRomaneio(res);
      if (!res.rotas?.length) showToast('Nenhuma rota encontrada para esta data', 'error');
    } catch(e) { showToast(e.message, 'error'); }
    finally { setLoading(false); }
  };

  const gerarPDF = async () => {
    if (!romaneio?.rotas?.length) return;
    setGerando(true);
    try {
      const { jsPDF } = await import('jspdf');

      const pdf = new jsPDF('p', 'mm', 'a4');
      const pw = 210, margin = 12;
      const usable = pw - margin * 2;

      romaneio.rotas.forEach((rotaData, idx) => {
        if (idx > 0) pdf.addPage();
        let y = margin;

        // ── Cabeçalho ──
        pdf.setFillColor(248, 249, 252);
        pdf.rect(margin, y, usable, 22, 'F');
        pdf.setDrawColor(226, 232, 240);
        pdf.rect(margin, y, usable, 22, 'S');

        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(14);
        pdf.setTextColor(26, 39, 64);
        pdf.text('LogiSystem — Romaneio', margin + 4, y + 8);

        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(107, 114, 128);
        pdf.text(`Data: ${fmtDate(romaneio.data)}`, margin + 4, y + 15);

        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(16);
        pdf.setTextColor(37, 99, 235);
        pdf.text(`Rota ${rotaData.rota || '—'}`, margin + usable - 4, y + 8, { align: 'right' });

        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(107, 114, 128);
        pdf.text(`${rotaData.motorista || ''} — ${rotaData.veiculo || ''}`, margin + usable - 4, y + 15, { align: 'right' });

        y += 24;

        // ── Resumo ──
        const paradas = rotaData.paradas || [];
        const pendentes = paradas.filter(p => p.status === 'pendente').length;
        const entregues = paradas.filter(p => p.status === 'entregue').length;
        const devolucoes = paradas.filter(p => p.status === 'devolucao').length;
        const resumoItems = [
          { label: 'PARADAS', val: paradas.length },
          { label: 'PENDENTES', val: pendentes },
          { label: 'ENTREGUES', val: entregues },
          { label: 'DEVOLUÇÕES', val: devolucoes },
        ];
        const cellW = usable / 4;
        resumoItems.forEach((item, i) => {
          const x = margin + i * cellW;
          pdf.setDrawColor(226, 232, 240);
          pdf.rect(x, y, cellW, 12, 'S');
          pdf.setFontSize(7);
          pdf.setTextColor(107, 114, 128);
          pdf.text(item.label, x + cellW / 2, y + 4, { align: 'center' });
          pdf.setFontSize(12);
          pdf.setFont('helvetica', 'bold');
          pdf.setTextColor(26, 39, 64);
          pdf.text(String(item.val), x + cellW / 2, y + 10, { align: 'center' });
          pdf.setFont('helvetica', 'normal');
        });
        y += 14;

        // ── Tabela ──
        const cols = [
          { label: 'Seq', w: 10, align: 'center' },
          { label: 'Cliente', w: 52 },
          { label: 'Região', w: 28 },
          { label: 'NF', w: 20 },
          { label: 'Peso', w: 18 },
          { label: 'Status', w: 18 },
          { label: 'Obs', w: 40 },
        ];

        // Header
        pdf.setFillColor(241, 245, 249);
        pdf.rect(margin, y, usable, 7, 'F');
        pdf.setDrawColor(226, 232, 240);
        pdf.rect(margin, y, usable, 7, 'S');
        pdf.setFontSize(7);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(55, 65, 81);
        let cx = margin;
        cols.forEach(col => {
          pdf.text(col.label, cx + 2, y + 5);
          cx += col.w;
        });
        y += 7;

        // Rows
        paradas.forEach((p, i) => {
          // Verificar se precisa de nova página
          if (y > 265) {
            pdf.addPage();
            y = margin;
          }

          const rowH = 8;
          if (i % 2 === 1) {
            pdf.setFillColor(248, 249, 252);
            pdf.rect(margin, y, usable, rowH, 'F');
          }
          pdf.setDrawColor(240, 240, 240);
          pdf.line(margin, y + rowH, margin + usable, y + rowH);

          pdf.setFontSize(8);
          pdf.setFont('helvetica', 'normal');
          pdf.setTextColor(26, 39, 64);

          cx = margin;
          // Seq
          pdf.setFont('helvetica', 'bold');
          pdf.text(String(p.seq || i + 1), cx + 5, y + 5, { align: 'center' });
          cx += cols[0].w;

          // Cliente
          pdf.setFont('helvetica', 'normal');
          const clienteTxt = (p.cliente_nome || '').substring(0, 30);
          pdf.text(clienteTxt, cx + 2, y + 5);
          cx += cols[1].w;

          // Região
          pdf.text((p.regiao || '—').substring(0, 16), cx + 2, y + 5);
          cx += cols[2].w;

          // NF
          pdf.setFont('courier', 'normal');
          pdf.text((p.nf || '—').substring(0, 12), cx + 2, y + 5);
          cx += cols[3].w;

          // Peso
          pdf.setFont('helvetica', 'normal');
          pdf.text(p.peso ? Number(p.peso).toFixed(0) + ' kg' : '—', cx + 2, y + 5);
          cx += cols[4].w;

          // Status
          const statusLabel = p.status === 'entregue' ? 'Entregue' : p.status === 'devolucao' ? 'Devol.' : 'Pendente';
          const statusColor = p.status === 'entregue' ? [22, 163, 74] : p.status === 'devolucao' ? [220, 38, 38] : [37, 99, 235];
          pdf.setTextColor(...statusColor);
          pdf.setFontSize(7);
          pdf.text(statusLabel, cx + 2, y + 5);
          cx += cols[5].w;

          // Obs
          pdf.setTextColor(107, 114, 128);
          pdf.setFontSize(7);
          pdf.text((p.obs || '').substring(0, 24), cx + 2, y + 5);

          pdf.setTextColor(26, 39, 64);
          y += rowH;
        });

        y += 6;

        // ── Assinaturas ──
        if (y > 255) { pdf.addPage(); y = margin; }
        y += 15;
        const sigW = usable / 2 - 10;

        pdf.setDrawColor(51, 51, 51);
        pdf.line(margin, y, margin + sigW, y);
        pdf.line(margin + usable - sigW, y, margin + usable, y);

        pdf.setFontSize(8);
        pdf.setTextColor(107, 114, 128);
        pdf.text('Assinatura do Motorista', margin + sigW / 2, y + 5, { align: 'center' });
        pdf.text('Assinatura do Conferente', margin + usable - sigW / 2, y + 5, { align: 'center' });
      });

      // Gerar e abrir
      const blob = pdf.output('blob');
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      showToast('PDF gerado!');
    } catch(e) {
      console.error('Erro PDF:', e);
      showToast('Erro: ' + e.message, 'error');
    }
    finally { setGerando(false); }
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
            {romaneio?.rotas?.length > 0 && (
              <button className="btn btn-primary" onClick={gerarPDF} disabled={gerando}
                style={{background:'#16a34a',boxShadow:'0 2px 8px rgba(22,163,74,.25)'}}>
                {gerando ? 'Gerando...' : '📄 Gerar PDF'}
              </button>
            )}
          </div>
        </div>

        {/* Preview na tela */}
        {romaneio?.rotas?.map((rotaData, idx) => (
          <div key={idx} className="card mb-16 fade-up">
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
              <div>
                <div style={{fontSize:16,fontWeight:700}}>Rota {rotaData.rota || '—'}</div>
                <div style={{fontSize:12,color:'var(--text3)'}}>{rotaData.motorista} — {rotaData.veiculo}</div>
              </div>
              <div style={{textAlign:'right'}}>
                <div style={{fontSize:12,color:'var(--text3)'}}>{fmtDate(romaneio.data)}</div>
                <div style={{fontSize:13,fontWeight:600}}>{rotaData.paradas.length} paradas</div>
              </div>
            </div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Seq</th><th>Cliente</th><th>Região</th><th>NF</th><th>Peso</th><th>Status</th></tr></thead>
                <tbody>
                  {rotaData.paradas.map((p,i) => (
                    <tr key={p.id}>
                      <td className="fw-600">{p.seq||i+1}</td>
                      <td className="fw-500">{p.cliente_nome}</td>
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
