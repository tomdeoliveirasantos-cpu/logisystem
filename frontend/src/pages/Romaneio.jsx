import { useState } from 'react';
import { useFetch } from '../hooks/useFetch';
import { api } from '../lib/api';
import { Field, Input, useToast, Toast } from '../components/UI';

const fmtDate = d => d ? new Date(d+'T12:00:00').toLocaleDateString('pt-BR') : '—';

export default function Romaneio() {
  const today = new Date().toISOString().split('T')[0];
  const [data, setData] = useState(today);
  const [rota, setRota] = useState('');
  const [romaneio, setRomaneio] = useState(null);
  const [loading, setLoading] = useState(false);
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

  const imprimir = () => {
    // No mobile, window.print() pode não funcionar direto
    // Usar setTimeout para garantir que o iOS processa
    const content = document.querySelector('.romaneio-content');
    if (!content) return;
    
    // Tentar print nativo primeiro
    try {
      window.print();
    } catch(e) {
      // Fallback: abrir em nova janela
      const win = window.open('', '_blank');
      if (win) {
        win.document.write(`
          <html><head><title>Romaneio</title>
          <style>
            body { font-family: -apple-system, system-ui, sans-serif; padding: 20px; font-size: 12px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { padding: 6px 8px; text-align: left; border-bottom: 1px solid #ddd; }
            th { background: #f5f5f5; font-weight: 600; font-size: 11px; }
            .header { display: flex; justify-content: space-between; margin-bottom: 16px; }
            .rota { font-size: 24px; font-weight: 800; color: #2563EB; }
          </style></head><body>${content.innerHTML}</body></html>
        `);
        win.document.close();
        win.print();
      }
    }
  };

  return (
    <div>
      {/* Header — não aparece na impressão */}
      <div className="page-header no-print">
        <div style={{flex:1}}>
          <div className="page-title">Romaneio de Entregas</div>
          <div className="page-desc">Gerar relatório de rotas para impressão</div>
        </div>
      </div>

      <div className="page-body">
        {/* Filtros — não aparece na impressão */}
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
              <>
                <button className="btn btn-primary" onClick={imprimir}>🖨️ Imprimir / PDF</button>
                <button className="btn btn-ghost" onClick={() => {
                  if (navigator.share) {
                    navigator.share({ title: `Romaneio ${data}`, text: `Romaneio de entregas - ${fmtDate(data)}`, url: window.location.href });
                  } else {
                    window.print();
                  }
                }}>📤 Compartilhar</button>
              </>
            )}
          </div>
        </div>

        {/* Conteúdo do romaneio — aparece na impressão */}
        <div className="romaneio-content">
        {romaneio?.rotas?.map((rotaData, idx) => (
          <div key={idx} className="romaneio-page" style={{marginBottom:24}}>
            {/* Cabeçalho da rota */}
            <div style={{
              display:'flex', justifyContent:'space-between', alignItems:'center',
              padding:'16px 20px', background:'var(--bg2)', border:'1px solid var(--border)',
              borderRadius:'var(--radius) var(--radius) 0 0',
            }}>
              <div>
                <div style={{fontSize:18,fontWeight:700,color:'var(--text)'}}>
                  LogiSystem — Romaneio
                </div>
                <div style={{fontSize:12,color:'var(--text3)',marginTop:2}}>
                  Data: <strong>{fmtDate(romaneio.data)}</strong>
                </div>
              </div>
              <div style={{textAlign:'right'}}>
                <div style={{fontSize:24,fontWeight:800,color:'var(--accent)'}}>
                  Rota {rotaData.rota || '—'}
                </div>
                <div style={{fontSize:12,color:'var(--text3)'}}>
                  {rotaData.motorista} — {rotaData.veiculo}
                </div>
              </div>
            </div>

            {/* Resumo rápido */}
            <div style={{
              display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:0,
              border:'1px solid var(--border)', borderTop:'none',
            }}>
              {[
                {label:'Paradas',val:rotaData.paradas.length},
                {label:'Pendentes',val:rotaData.paradas.filter(p=>p.status==='pendente').length},
                {label:'Entregues',val:rotaData.paradas.filter(p=>p.status==='entregue').length},
                {label:'Devoluções',val:rotaData.paradas.filter(p=>p.status==='devolucao').length},
              ].map(k=>(
                <div key={k.label} style={{padding:'8px 12px',textAlign:'center',borderRight:'1px solid var(--border)'}}>
                  <div style={{fontSize:10,color:'var(--text3)',textTransform:'uppercase'}}>{k.label}</div>
                  <div style={{fontSize:16,fontWeight:700}}>{k.val}</div>
                </div>
              ))}
            </div>

            {/* Tabela de paradas */}
            <div style={{border:'1px solid var(--border)',borderTop:'none',borderRadius:'0 0 var(--radius) var(--radius)',overflow:'hidden'}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                <thead>
                  <tr style={{background:'var(--bg3)'}}>
                    <th style={{padding:'8px 10px',textAlign:'left',fontWeight:600,fontSize:11}}>Seq</th>
                    <th style={{padding:'8px 10px',textAlign:'left',fontWeight:600,fontSize:11}}>Cliente</th>
                    <th style={{padding:'8px 10px',textAlign:'left',fontWeight:600,fontSize:11}}>Região</th>
                    <th style={{padding:'8px 10px',textAlign:'left',fontWeight:600,fontSize:11}}>NF</th>
                    <th style={{padding:'8px 10px',textAlign:'left',fontWeight:600,fontSize:11}}>Peso</th>
                    <th style={{padding:'8px 10px',textAlign:'left',fontWeight:600,fontSize:11}}>Status</th>
                    <th style={{padding:'8px 10px',textAlign:'left',fontWeight:600,fontSize:11}}>Obs</th>
                    <th style={{padding:'8px 10px',textAlign:'center',fontWeight:600,fontSize:11}} className="no-print">Assinatura</th>
                  </tr>
                </thead>
                <tbody>
                  {rotaData.paradas.map((p, i) => (
                    <tr key={p.id} style={{borderTop:'1px solid var(--border)', background: i%2===0?'transparent':'var(--bg3)'}}>
                      <td style={{padding:'8px 10px',fontWeight:600}}>{p.seq || i+1}</td>
                      <td style={{padding:'8px 10px'}}>
                        <div style={{fontWeight:500}}>{p.cliente_nome}</div>
                        {p.logradouro && (
                          <div style={{fontSize:10,color:'var(--text3)'}}>
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
                          background: p.status==='entregue'?'#F0FDF4':p.status==='devolucao'?'#FEF2F2':'#EEF4FF',
                          color: p.status==='entregue'?'#16A34A':p.status==='devolucao'?'#DC2626':'#2563EB',
                        }}>
                          {p.status==='entregue'?'Entregue':p.status==='devolucao'?'Devolução':'Pendente'}
                        </span>
                      </td>
                      <td style={{padding:'8px 10px',fontSize:11,color:'var(--text3)'}}>{p.obs || ''}</td>
                      <td style={{padding:'8px 10px',textAlign:'center',minWidth:120}} className="no-print">
                        <div style={{borderBottom:'1px solid var(--border)',height:24}}></div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Rodapé com assinatura do motorista */}
            <div style={{
              display:'grid', gridTemplateColumns:'1fr 1fr', gap:40,
              marginTop:20, padding:'0 20px',
            }}>
              <div>
                <div style={{borderTop:'1px solid #333',paddingTop:6,fontSize:11,textAlign:'center',color:'var(--text3)'}}>
                  Assinatura do Motorista
                </div>
              </div>
              <div>
                <div style={{borderTop:'1px solid #333',paddingTop:6,fontSize:11,textAlign:'center',color:'var(--text3)'}}>
                  Assinatura do Conferente
                </div>
              </div>
            </div>
          </div>
        ))}
        </div>

        {!romaneio && (
          <div className="card no-print" style={{textAlign:'center',padding:'40px 0',color:'var(--text3)'}}>
            Selecione a data e clique em Buscar para gerar o romaneio.
          </div>
        )}
      </div>

      {/* CSS de impressão */}
      <style>{`
        @media print {
          .no-print, .sidebar, .sidebar-overlay, .mobile-topbar,
          .page-header, nav { display: none !important; }
          .main-content { margin-left: 0 !important; }
          .page-body { padding: 0 !important; }
          .romaneio-page { page-break-after: always; }
          body { background: #fff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          table { font-size: 11px !important; }
        }
      `}</style>
      {toast && <Toast {...toast} />}
    </div>
  );
}
