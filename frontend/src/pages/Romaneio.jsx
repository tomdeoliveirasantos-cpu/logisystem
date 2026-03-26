import { useState, useRef } from 'react';
import { api } from '../lib/api';
import { Field, Input, useToast, Toast } from '../components/UI';

const fmtDate = d => d ? new Date(d+'T12:00:00').toLocaleDateString('pt-BR') : '—';

export default function Romaneio() {
  const today = new Date().toISOString().split('T')[0];
  const [data, setData] = useState(today);
  const [rota, setRota] = useState('');
  const [romaneio, setRomaneio] = useState(null);
  const [loading, setLoading] = useState(false);
  const [gerando, setGerando] = useState(false);
  const { toast, showToast } = useToast();
  const printRef = useRef(null);

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
    if (!printRef.current) return;
    setGerando(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');

      const element = printRef.current;
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
      });

      const imgData = canvas.toDataURL('image/png');
      const imgWidth = 210;
      const pageHeight = 297;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      const pdf = new jsPDF('p', 'mm', 'a4');
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      const nomeArquivo = `romaneio_${data}${rota ? '_rota_'+rota : ''}.pdf`;

      // Mobile: compartilhar como arquivo PDF
      if (navigator.share && navigator.canShare) {
        const blob = pdf.output('blob');
        const file = new File([blob], nomeArquivo, { type: 'application/pdf' });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: `Romaneio ${fmtDate(data)}`,
            files: [file],
          });
          setGerando(false);
          return;
        }
      }

      // Desktop: download direto
      pdf.save(nomeArquivo);
      showToast('PDF gerado!');
    } catch(e) {
      console.error('Erro PDF:', e);
      showToast('Erro ao gerar PDF: ' + e.message, 'error');
    }
    finally { setGerando(false); }
  };

  return (
    <div>
      <div className="page-header no-print">
        <div style={{flex:1}}>
          <div className="page-title">Romaneio de Entregas</div>
          <div className="page-desc">Gerar PDF das rotas do dia</div>
        </div>
      </div>

      <div className="page-body">
        {/* Filtros */}
        <div className="card mb-16 no-print">
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

        {/* Conteúdo renderizado para captura */}
        <div ref={printRef} style={{background:'#fff'}}>
          {romaneio?.rotas?.map((rotaData, idx) => (
            <div key={idx} style={{marginBottom:24,padding:4}}>
              {/* Cabeçalho */}
              <div style={{
                display:'flex', justifyContent:'space-between', alignItems:'center',
                padding:'16px 20px', background:'#f8f9fc', border:'1px solid #e2e8f0',
                borderRadius:'8px 8px 0 0',
              }}>
                <div>
                  <div style={{fontSize:18,fontWeight:700,color:'#1a2740'}}>LogiSystem — Romaneio</div>
                  <div style={{fontSize:12,color:'#6b7280',marginTop:2}}>
                    Data: <strong>{fmtDate(romaneio.data)}</strong>
                  </div>
                </div>
                <div style={{textAlign:'right'}}>
                  <div style={{fontSize:24,fontWeight:800,color:'#2563eb'}}>Rota {rotaData.rota || '—'}</div>
                  <div style={{fontSize:12,color:'#6b7280'}}>{rotaData.motorista} — {rotaData.veiculo}</div>
                </div>
              </div>

              {/* Resumo */}
              <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',border:'1px solid #e2e8f0',borderTop:'none'}}>
                {[
                  {label:'Paradas',val:rotaData.paradas.length},
                  {label:'Pendentes',val:rotaData.paradas.filter(p=>p.status==='pendente').length},
                  {label:'Entregues',val:rotaData.paradas.filter(p=>p.status==='entregue').length},
                  {label:'Devoluções',val:rotaData.paradas.filter(p=>p.status==='devolucao').length},
                ].map(k=>(
                  <div key={k.label} style={{padding:'8px 12px',textAlign:'center',borderRight:'1px solid #e2e8f0'}}>
                    <div style={{fontSize:10,color:'#6b7280',textTransform:'uppercase'}}>{k.label}</div>
                    <div style={{fontSize:16,fontWeight:700,color:'#1a2740'}}>{k.val}</div>
                  </div>
                ))}
              </div>

              {/* Tabela */}
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:12,border:'1px solid #e2e8f0',borderTop:'none'}}>
                <thead>
                  <tr style={{background:'#f1f5f9'}}>
                    {['Seq','Cliente','Região','NF','Peso','Status','Obs'].map(h=>(
                      <th key={h} style={{padding:'8px 10px',textAlign:'left',fontWeight:600,fontSize:11,borderBottom:'1px solid #e2e8f0'}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rotaData.paradas.map((p, i) => (
                    <tr key={p.id} style={{borderBottom:'1px solid #e2e8f0', background: i%2===0?'#fff':'#f8f9fc'}}>
                      <td style={{padding:'8px 10px',fontWeight:600}}>{p.seq || i+1}</td>
                      <td style={{padding:'8px 10px'}}>
                        <div style={{fontWeight:500}}>{p.cliente_nome}</div>
                        {p.logradouro && (
                          <div style={{fontSize:10,color:'#6b7280'}}>
                            {p.logradouro}{p.cli_numero ? ', '+p.cli_numero : ''} — {p.bairro || ''} {p.cidade || ''}
                          </div>
                        )}
                      </td>
                      <td style={{padding:'8px 10px'}}>{p.regiao || '—'}</td>
                      <td style={{padding:'8px 10px',fontFamily:'monospace'}}>{p.nf || '—'}</td>
                      <td style={{padding:'8px 10px'}}>{p.peso ? Number(p.peso).toLocaleString('pt-BR')+' kg' : '—'}</td>
                      <td style={{padding:'8px 10px'}}>
                        <span style={{
                          padding:'2px 8px', borderRadius:99, fontSize:10, fontWeight:600,
                          background: p.status==='entregue'?'#dcfce7':p.status==='devolucao'?'#fee2e2':'#dbeafe',
                          color: p.status==='entregue'?'#16a34a':p.status==='devolucao'?'#dc2626':'#2563eb',
                        }}>
                          {p.status==='entregue'?'Entregue':p.status==='devolucao'?'Devolução':'Pendente'}
                        </span>
                      </td>
                      <td style={{padding:'8px 10px',fontSize:11,color:'#6b7280'}}>{p.obs || ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Assinaturas */}
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:40,marginTop:30,padding:'0 20px'}}>
                <div><div style={{borderTop:'1px solid #333',paddingTop:6,fontSize:11,textAlign:'center',color:'#6b7280'}}>Assinatura do Motorista</div></div>
                <div><div style={{borderTop:'1px solid #333',paddingTop:6,fontSize:11,textAlign:'center',color:'#6b7280'}}>Assinatura do Conferente</div></div>
              </div>
            </div>
          ))}
        </div>

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
