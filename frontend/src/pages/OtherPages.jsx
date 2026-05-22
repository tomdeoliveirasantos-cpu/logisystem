import { useState, useEffect } from 'react';
import { useFetch } from '../hooks/useFetch';
import { api } from '../lib/api';
import { StatusBadge, Modal, Field, Input, Select, SelectAdd, Textarea, useToast, Toast, ExportBtn } from '../components/UI';

const fmt = v => v!==null ? new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v) : '—';
const fmtDate = d => {
  if (!d) return '—';
  const s = String(d).substring(0, 10); // pegar só YYYY-MM-DD
  const dt = new Date(s + 'T12:00:00');
  return isNaN(dt) ? '—' : dt.toLocaleDateString('pt-BR');
};

function xlsBtn(label, rows, cols) {
  return <button className="btn btn-ghost btn-sm" onClick={()=>{
    if(!rows.length) return alert('Nenhum dado');
    const data=[cols.map(c=>c.l),...rows.map(r=>cols.map(c=>c.f?c.f(r[c.k],r):(r[c.k]||'')))];
    const ws=window.XLSX.utils.aoa_to_sheet(data);ws['!cols']=cols.map(()=>({wch:18}));
    const wb=window.XLSX.utils.book_new();window.XLSX.utils.book_append_sheet(wb,ws,label);
    window.XLSX.writeFile(wb,`${label.toLowerCase()}_${new Date().toLocaleDateString('pt-BR').replace(/\//g,'-')}.xlsx`);
  }}>⬇ Excel</button>;
}

export function ContasReceber() {
  const { data, loading, refetch } = useFetch('/financeiro/receber');
  const { toast, showToast } = useToast();
  const rows = (data||[]).filter(r => r.status !== 'cancelado');
  const marcarRecebido = async (id) => { try { await api.patch(`/financeiro/receber/${id}/receber`,{}); showToast('Marcado como recebido!'); refetch(); } catch(e) { showToast(e.message,'error'); } };
  const excluir = async (id) => {
    if (!confirm('Excluir este lançamento permanentemente?')) return;
    try { await api.delete(`/financeiro/receber/${id}`); showToast('Lançamento excluído!'); refetch(); }
    catch(e) { showToast(e.message,'error'); }
  };
  const total=rows.reduce((s,r)=>s+ +r.valor,0), emAberto=rows.filter(r=>r.status==='pendente').reduce((s,r)=>s+ +r.valor,0), recebido=rows.filter(r=>r.status==='recebido').reduce((s,r)=>s+ +r.valor,0);
  const cols=[{k:'numero_rota',l:'Rota'},{k:'cliente',l:'Cliente'},{k:'regiao',l:'Região'},{k:'valor',l:'Valor (R$)',f:v=>v?Number(v).toFixed(2):''},{k:'vencimento',l:'Vencimento',f:v=>fmtDate(v)},{k:'data_pagamento',l:'Dt. Pgto',f:v=>fmtDate(v)},{k:'status',l:'Status'},{k:'obs',l:'Obs'}];
  return (
    <div>
      <div className="page-header"><div><div className="page-title">Contas a Receber</div><div className="page-desc">Fretes cobrados dos clientes</div></div>
        <div style={{display:'flex',gap:8}}>
          <ExportBtn rows={rows} filename="contas_receber" columns={cols.map(c=>({key:c.k,label:c.l,fmt:c.f}))} />
        </div>
      </div>
      <div className="page-body">
        <div className="metrics-grid cols-3 mb-16 fade-up">
          <div className="metric-card"><div className="metric-label">Total</div><div className="metric-value">{fmt(total)}</div></div>
          <div className="metric-card amber"><div className="metric-label">Em aberto</div><div className="metric-value" style={{color:'var(--amber)'}}>{fmt(emAberto)}</div></div>
          <div className="metric-card green"><div className="metric-label">Recebido</div><div className="metric-value" style={{color:'var(--green)'}}>{fmt(recebido)}</div></div>
        </div>
        <div className="card fade-up fade-up-1"><div className="table-wrap"><table>
          <thead><tr><th>Rota</th><th>Cliente</th><th>Região</th><th>Valor</th><th>Vencimento</th><th>Pgto.</th><th>Status</th><th>Ação</th></tr></thead>
          <tbody>
            {loading && Array.from({length:4}).map((_,i)=>(<tr key={i}>{Array.from({length:8}).map((_,j)=>(<td key={j}><div style={{height:12,background:'var(--bg3)',borderRadius:4,width:'60%'}}/></td>))}</tr>))}
            {!loading&&!rows.length&&<tr><td colSpan={8} style={{textAlign:'center',color:'var(--text3)',padding:'32px 0'}}>Nenhum lançamento encontrado</td></tr>}
            {rows.map(r=>(
              <tr key={r.id}>
                <td className="font-mono fw-600" style={{color:'var(--accent)',fontSize:12}}>{r.numero_rota||'—'}</td>
                <td className="fw-500">{r.cliente}</td>
                <td style={{fontSize:12}}>{r.regiao||'—'}</td>
                <td className="fw-600">{fmt(r.valor)}</td>
                <td style={{fontSize:12}}>{fmtDate(r.vencimento)}</td>
                <td style={{fontSize:12}}>{fmtDate(r.data_pagamento)}</td>
                <td><StatusBadge status={r.status}/></td>
                <td style={{whiteSpace:'nowrap'}}>
                  {r.status==='pendente'&&<button className="btn btn-ghost btn-sm" onClick={()=>marcarRecebido(r.id)}>Receber</button>}
                  <button className="btn btn-ghost btn-sm" onClick={()=>excluir(r.id)} style={{color:'#DC2626'}} title="Excluir lançamento">🗑️</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table></div></div>
      </div>
      {toast&&<Toast {...toast}/>}
    </div>
  );
}

const TIPO_LANCAMENTO_LABEL = {
  frete_terceiro:   { label: 'Frete Terceiro', badge: 'badge-blue' },
  diaria_motorista: { label: 'Diária Motorista', badge: 'badge-teal' },
  diaria_ajudante:  { label: 'Diária Ajudante', badge: 'badge-amber' },
  adiantamento:     { label: 'Adiantamento', badge: 'badge-gray' },
};

export function ContasPagar() {
  const [filtroTipo, setFiltroTipo] = useState('');
  const { data, loading, refetch } = useFetch('/financeiro/pagar');
  const { toast, showToast } = useToast();
  const [acertoCp, setAcertoCp] = useState(null); // CP em fluxo de pagamento (com adtos)
  const [confirmCp, setConfirmCp] = useState(null); // CP em fluxo de pagamento simples (sem adtos)

  const rows = (data||[])
    .filter(r => r.status !== 'cancelado')
    .filter(r => !filtroTipo || r.tipo_lancamento === filtroTipo);

  const excluir = async (id) => {
    if (!confirm('Excluir este lançamento permanentemente?')) return;
    try { await api.delete(`/financeiro/pagar/${id}`); showToast('Lançamento excluído!'); refetch(); }
    catch(e) { showToast(e.message,'error'); }
  };

  // Estorna o pagamento de uma CP, devolvendo adtos abatidos para pendente
  const estornar = async (cp) => {
    if (!confirm(`Estornar este pagamento?\n\nA CP voltará para pendente${Number(cp.valor_adiantamentos||0) > 0 ? ' e os adiantamentos abatidos serão reabertos' : ''}.`)) return;
    try {
      await api.patch(`/financeiro/pagar/${cp.id}/estornar`, {});
      showToast('Pagamento estornado!');
      refetch();
    } catch(e) { showToast(e.message,'error'); }
  };

  // Verifica se a CP tem adtos pendentes; se sim, abre modal de acerto, senão modal de confirmação
  const iniciarPagamento = async (cp) => {
    if (cp.tipo_lancamento === 'adiantamento') return;
    try {
      const r = await api.get(`/financeiro/pagar/${cp.id}/elegiveis`);
      if (r && r.elegiveis && r.elegiveis.length > 0) {
        setAcertoCp({ cp, elegiveis: r.elegiveis, total_pendente: r.total_pendente });
      } else {
        // Sem adtos: abre modal de confirmação com data editável
        setConfirmCp(cp);
      }
    } catch(e) { showToast(e.message,'error'); }
  };

  const confirmarPagamentoSimples = async (cpId, dataPgto) => {
    try {
      await api.patch(`/financeiro/pagar/${cpId}/pagar`, { data_pagamento: dataPgto });
      showToast('Marcado como pago!');
      setConfirmCp(null);
      refetch();
    } catch(e) { showToast(e.message,'error'); }
  };

  const total=rows.reduce((s,r)=>s+ +r.valor,0), emAberto=rows.filter(r=>r.status==='pendente').reduce((s,r)=>s+ +r.valor,0), pago=rows.filter(r=>r.status==='pago').reduce((s,r)=>s+ +r.valor,0);

  const cols=[
    {k:'numero_rota',l:'Rota'},
    {k:'tipo_lancamento',l:'Tipo',f:v=>TIPO_LANCAMENTO_LABEL[v]?.label||v||''},
    {k:'descricao',l:'Descrição'},
    {k:'transportadora_nome',l:'Transportadora'},
    {k:'motorista_nome',l:'Motorista'},
    {k:'veiculo_placa',l:'Placa'},
    {k:'valor',l:'Valor (R$)',f:v=>v?Number(v).toFixed(2):''},
    {k:'valor_adiantamentos',l:'Adto abatido',f:v=>v?Number(v).toFixed(2):''},
    {k:'valor_pago',l:'Pago líquido',f:v=>v?Number(v).toFixed(2):''},
    {k:'vencimento',l:'Vencimento',f:v=>fmtDate(v)},
    {k:'status',l:'Status'},
  ];

  return (
    <div>
      <div className="page-header">
        <div><div className="page-title">Contas a Pagar</div><div className="page-desc">Fretes de terceiros e diárias da frota própria</div></div>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          <select className="form-select" style={{width:190}} value={filtroTipo} onChange={e=>setFiltroTipo(e.target.value)}>
            <option value="">Todos os tipos</option>
            <option value="frete_terceiro">Frete Terceiro</option>
            <option value="diaria_motorista">Diária Motorista</option>
            <option value="diaria_ajudante">Diária Ajudante</option>
            <option value="adiantamento">Adiantamento</option>
          </select>
          <ExportBtn rows={rows} filename="contas_pagar" columns={cols.map(c=>({key:c.k,label:c.l,fmt:c.f}))} />
        </div>
      </div>
      <div className="page-body">
        <div className="metrics-grid cols-4 mb-16 fade-up">
          <div className="metric-card"><div className="metric-label">Total</div><div className="metric-value">{fmt(total)}</div></div>
          <div className="metric-card amber"><div className="metric-label">Em aberto</div><div className="metric-value" style={{color:'var(--amber)'}}>{fmt(emAberto)}</div></div>
          <div className="metric-card green"><div className="metric-label">Pago</div><div className="metric-value" style={{color:'var(--green)'}}>{fmt(pago)}</div></div>
          <div className="metric-card"><div className="metric-label">Lançamentos</div><div className="metric-value">{rows.length}</div></div>
        </div>
        <div className="card fade-up fade-up-1"><div className="table-wrap"><table>
          <thead><tr><th>Rota</th><th>Tipo</th><th>Descrição</th><th>Benef. / Motorista</th><th>Placa</th><th>Valor</th><th>Adto</th><th>Pago líq.</th><th>Vencimento</th><th>Status</th><th>Ação</th></tr></thead>
          <tbody>
            {loading && Array.from({length:4}).map((_,i)=>(<tr key={i}>{Array.from({length:11}).map((_,j)=>(<td key={j}><div style={{height:12,background:'var(--bg3)',borderRadius:4,width:'60%'}}/></td>))}</tr>))}
            {!loading&&!rows.length&&<tr><td colSpan={11} style={{textAlign:'center',color:'var(--text3)',padding:'32px 0'}}>Nenhum lançamento encontrado</td></tr>}
            {rows.map(r=>{
              const tipoInfo = TIPO_LANCAMENTO_LABEL[r.tipo_lancamento] || {label: r.tipo_lancamento||'—', badge:'badge-gray'};
              const podeAcerto = r.status === 'pendente' && r.tipo_lancamento !== 'adiantamento';
              return (
                <tr key={r.id}>
                  <td className="font-mono fw-600" style={{color:'var(--accent)',fontSize:12}}>{r.numero_rota||'—'}</td>
                  <td><span className={`badge ${tipoInfo.badge}`}>{tipoInfo.label}</span></td>
                  <td style={{fontSize:12,color:'var(--text2)',maxWidth:200}}>
                    <div className="truncate">{r.descricao || '—'}</div>
                    {r.regiao && <div style={{fontSize:11,color:'var(--text3)'}}>{r.regiao}</div>}
                  </td>
                  <td>
                    {r.transportadora_nome && <div className="fw-500">{r.transportadora_nome}</div>}
                    {r.motorista_nome && <div style={{fontSize:11,color:'var(--text3)'}}>{r.motorista_nome}</div>}
                    {r.ajudante_nome && <div style={{fontSize:11,color:'var(--text3)'}}>👤 {r.ajudante_nome}</div>}
                    {!r.transportadora_nome && !r.motorista_nome && !r.ajudante_nome && <span style={{color:'var(--text3)'}}>—</span>}
                  </td>
                  <td className="font-mono" style={{fontSize:12}}>{r.veiculo_placa || '—'}</td>
                  <td className="fw-600">{fmt(r.valor)}</td>
                  <td style={{fontSize:12,color: r.valor_adiantamentos > 0 ? 'var(--amber)' : 'var(--text3)'}}>
                    {Number(r.valor_adiantamentos||0) > 0 ? fmt(r.valor_adiantamentos) : '—'}
                  </td>
                  <td className="fw-500" style={{color: r.valor_pago > 0 ? 'var(--green)' : 'var(--text3)'}}>
                    {Number(r.valor_pago||0) > 0 ? fmt(r.valor_pago) : '—'}
                  </td>
                  <td style={{fontSize:12}}>{fmtDate(r.vencimento)}</td>
                  <td><StatusBadge status={r.status}/></td>
                  <td style={{whiteSpace:'nowrap'}}>
                    {podeAcerto && <button className="btn btn-ghost btn-sm" onClick={()=>iniciarPagamento(r)}>Pagar</button>}
                    {r.status === 'pago' && r.tipo_lancamento !== 'adiantamento' && (
                      <button className="btn btn-ghost btn-sm" onClick={()=>estornar(r)} title="Estornar pagamento" style={{color:'var(--amber)'}}>↺ Estornar</button>
                    )}
                    <button className="btn btn-ghost btn-sm" onClick={()=>excluir(r.id)} style={{color:'#DC2626'}} title="Excluir lançamento">🗑️</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table></div></div>
      </div>

      {confirmCp && (
        <ConfirmaPagamentoModal
          cp={confirmCp}
          onClose={()=>setConfirmCp(null)}
          onConfirm={confirmarPagamentoSimples}
        />
      )}

      {acertoCp && (
        <ModalAcertoPagamento
          cp={acertoCp.cp}
          elegiveis={acertoCp.elegiveis}
          totalPendente={acertoCp.total_pendente}
          onClose={()=>setAcertoCp(null)}
          onSaved={()=>{ setAcertoCp(null); refetch(); showToast('Pagamento registrado com abatimento!'); }}
          onError={(m)=>showToast(m,'error')}
        />
      )}

      {toast&&<Toast {...toast}/>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Modal de acerto/pagamento com abatimento de adiantamentos
// ─────────────────────────────────────────────────────────────────────────────
function ModalAcertoPagamento({ cp, elegiveis, totalPendente, onClose, onSaved, onError }) {
  // Estado: { [adto_id]: { selecionado: bool, valor: '' } }
  const [linhas, setLinhas] = useState(() => {
    const o = {};
    elegiveis.forEach(e => {
      o[e.id] = { selecionado: true, valor: Number(e.saldo).toFixed(2) };
    });
    return o;
  });
  const [dataPgto, setDataPgto] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  const totalAbater = Object.entries(linhas)
    .filter(([_, l]) => l.selecionado)
    .reduce((s, [_, l]) => s + (Number(l.valor) || 0), 0);

  const valorBruto = Number(cp.valor);
  const valorLiquido = Math.max(0, valorBruto - totalAbater);
  const excesso = totalAbater > valorBruto + 0.005;

  // Auto-ajuste: se total a abater excede o frete, reduz proporcionalmente
  useEffect(() => {
    // Apenas informativo; não força. Decisão do usuário.
  }, [totalAbater]);

  const toggle = (id) => {
    setLinhas(l => ({ ...l, [id]: { ...l[id], selecionado: !l[id].selecionado } }));
  };
  const setValor = (id, v) => {
    setLinhas(l => ({ ...l, [id]: { ...l[id], valor: v } }));
  };

  const confirmar = async () => {
    if (excesso) {
      return onError(`Adiantamentos somam ${fmt(totalAbater)}, mais que o frete (${fmt(valorBruto)})`);
    }
    const abates = Object.entries(linhas)
      .filter(([_, l]) => l.selecionado && Number(l.valor) > 0)
      .map(([id, l]) => ({ id, valor: Number(l.valor) }));
    setSaving(true);
    try {
      await api.patch(`/financeiro/pagar/${cp.id}/pagar`, { adiantamentos_a_abater: abates, data_pagamento: dataPgto });
      onSaved();
    } catch (e) {
      onError(e.message || 'Erro ao confirmar pagamento');
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={e=>e.target===e.currentTarget && onClose()}>
      <div className="modal" style={{maxWidth:720}}>
        <div className="modal-header">
          <span className="modal-title">Pagamento com abatimento de adiantamentos</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div style={{background:'rgba(37,99,235,0.06)',padding:'10px 14px',borderRadius:8,marginBottom:14,fontSize:13}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div>
                <div style={{fontWeight:600}}>Conta a pagar — {cp.descricao || cp.tipo_lancamento}</div>
                <div style={{fontSize:11,color:'var(--text3)',marginTop:2}}>
                  {cp.motorista_nome && `${cp.motorista_nome} • `}
                  {cp.veiculo_placa && `🚛 ${cp.veiculo_placa} • `}
                  {cp.ajudante_nome && `👤 ${cp.ajudante_nome} • `}
                  {cp.numero_rota && `Rota ${cp.numero_rota}`}
                </div>
              </div>
              <div style={{fontSize:20,fontWeight:700}}>{fmt(valorBruto)}</div>
            </div>
          </div>

          <div style={{marginBottom:12,display:'flex',gap:12,alignItems:'center'}}>
            <label style={{fontSize:13,fontWeight:500}}>Data do pagamento:</label>
            <input type="date" value={dataPgto} onChange={e=>setDataPgto(e.target.value)}
              style={{padding:'6px 10px',border:'1px solid var(--border)',borderRadius:6,fontSize:13}} />
          </div>

          <div style={{fontSize:13,fontWeight:600,marginBottom:6}}>
            Adiantamentos pendentes ({elegiveis.length}) — total: {fmt(totalPendente)}
          </div>
          <div className="table-wrap" style={{maxHeight:280,overflowY:'auto',border:'1px solid var(--border)',borderRadius:8}}>
            <table>
              <thead>
                <tr>
                  <th style={{width:30}}></th>
                  <th>Data</th>
                  <th>Beneficiário / Forma</th>
                  <th>Saldo</th>
                  <th>Valor a abater</th>
                </tr>
              </thead>
              <tbody>
                {elegiveis.map(e => {
                  const l = linhas[e.id];
                  const benef = e.motorista_nome || e.ajudante_nome || '—';
                  return (
                    <tr key={e.id}>
                      <td><input type="checkbox" checked={l.selecionado} onChange={()=>toggle(e.id)} /></td>
                      <td style={{fontSize:12}}>{fmtDate(e.data_adiantamento)}</td>
                      <td>
                        <div style={{fontSize:12,fontWeight:500}}>{benef}</div>
                        {e.veiculo_placa && <div style={{fontSize:11,color:'var(--text3)'}}>🚛 {e.veiculo_placa}</div>}
                        {e.forma_pagamento && <div style={{fontSize:11,color:'var(--text3)'}}>{e.forma_pagamento}</div>}
                      </td>
                      <td className="fw-500">{fmt(e.saldo)}</td>
                      <td>
                        <input
                          type="number" step="0.01" min="0" max={e.saldo}
                          value={l.valor}
                          onChange={ev=>setValor(e.id, ev.target.value)}
                          disabled={!l.selecionado}
                          style={{width:110,padding:'4px 8px',border:'1px solid var(--border)',borderRadius:6,fontSize:13}}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div style={{marginTop:16,padding:'14px 16px',background:'var(--bg2)',borderRadius:8,border:'1px solid var(--border)'}}>
            <div style={{display:'flex',justifyContent:'space-between',fontSize:13,marginBottom:6}}>
              <span>Valor bruto</span>
              <span className="fw-500">{fmt(valorBruto)}</span>
            </div>
            <div style={{display:'flex',justifyContent:'space-between',fontSize:13,marginBottom:6,color:'var(--amber)'}}>
              <span>(−) Adiantamentos</span>
              <span className="fw-500">{fmt(totalAbater)}</span>
            </div>
            <div style={{height:1,background:'var(--border)',margin:'8px 0'}}/>
            <div style={{display:'flex',justifyContent:'space-between',fontSize:15,fontWeight:700,color: excesso ? '#DC2626' : 'var(--green)'}}>
              <span>{excesso ? '⚠ Excede o frete' : 'Valor a pagar'}</span>
              <span>{fmt(valorLiquido)}</span>
            </div>
            {excesso && (
              <div style={{fontSize:12,color:'#DC2626',marginTop:6}}>
                Reduza o valor de algum adiantamento. O abatimento não pode exceder o frete.
              </div>
            )}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancelar</button>
          <button className="btn btn-primary" onClick={confirmar} disabled={saving || excesso}>
            {saving ? 'Salvando...' : `Confirmar pagamento de ${fmt(valorLiquido)}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Modal de confirmação de pagamento simples (sem adiantamentos)
// ─────────────────────────────────────────────────────────────────────────────
function ConfirmaPagamentoModal({ cp, onClose, onConfirm }) {
  const [dataPgto, setDataPgto] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  const confirmar = async () => {
    setSaving(true);
    try {
      await onConfirm(cp.id, dataPgto);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={e=>e.target===e.currentTarget && onClose()}>
      <div className="modal" style={{maxWidth:480}}>
        <div className="modal-header">
          <span className="modal-title">Confirmar pagamento</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div style={{background:'rgba(37,99,235,0.06)',padding:'12px 14px',borderRadius:8,marginBottom:14,fontSize:13}}>
            <div style={{fontWeight:600,marginBottom:4}}>{cp.descricao || cp.tipo_lancamento}</div>
            <div style={{fontSize:11,color:'var(--text3)',marginBottom:8}}>
              {cp.motorista_nome && `${cp.motorista_nome} • `}
              {cp.veiculo_placa && `🚛 ${cp.veiculo_placa} • `}
              {cp.numero_rota && `Rota ${cp.numero_rota}`}
            </div>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:8}}>
              <span style={{fontSize:13,color:'var(--text2)'}}>Valor a pagar:</span>
              <span style={{fontSize:20,fontWeight:700,color:'var(--green)'}}>{fmt(cp.valor)}</span>
            </div>
          </div>

          <Field label="Data do pagamento *">
            <Input type="date" value={dataPgto} onChange={e=>setDataPgto(e.target.value)} />
          </Field>

          <div style={{marginTop:12,padding:'8px 12px',background:'rgba(251,191,36,0.08)',borderRadius:6,fontSize:12,color:'var(--text2)'}}>
            💡 Após confirmar, você pode usar o botão <strong>Estornar</strong> caso precise desfazer.
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancelar</button>
          <button className="btn btn-primary" onClick={confirmar} disabled={saving}>
            {saving ? 'Salvando...' : `Confirmar pagamento de ${fmt(cp.valor)}`}
          </button>
        </div>
      </div>
    </div>
  );
}

export function Manutencoes() {
  const { data, loading, refetch } = useFetch('/manutencoes');
  const { data: veiculos } = useFetch('/veiculos');
  const { data: fornecedores, refetch: refetchFornec } = useFetch('/fornecedores');
  const [modal, setModal] = useState(false);
  const [form, setForm]   = useState({});
  const { toast, showToast } = useToast();
  const set = (k,v)=>setForm(f=>({...f,[k]:v}));
  const [arquivo, setArquivo] = useState(null);
  const save = async () => {
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k,v]) => { if (v !== '' && v != null) fd.append(k, v); });
      if (arquivo) fd.append('orcamento_anexo', arquivo);
      await api.post('/manutencoes', fd);
      showToast('Manutenção registrada!'); refetch(); setModal(false); setForm({}); setArquivo(null);
    } catch(e){showToast(e.message,'error');}
  };
  const rows = data||[];
  const total = rows.reduce((s,r)=>s+ +(r.valor_orcamento||0),0);
  const cols=[{k:'data_manutencao',l:'Data',f:v=>fmtDate(v)},{k:'placa',l:'Placa'},{k:'modelo',l:'Modelo'},{k:'tipo_manutencao',l:'Tipo'},{k:'componente',l:'Componente'},{k:'fornecedor_nome',l:'Fornecedor'},{k:'descricao',l:'Descrição'},{k:'valor_orcamento',l:'Valor (R$)',f:v=>v?Number(v).toFixed(2):''},{k:'data_vencimento',l:'Vencimento',f:v=>fmtDate(v)},{k:'aprovado_por',l:'Aprovado por'}];
  return (
    <div>
      <div className="page-header"><div><div className="page-title">Controle de Manutenção</div><div className="page-desc">Manutenções, obrigações legais e custos fixos da frota</div></div>
        <div style={{display:'flex',gap:8}}><ExportBtn rows={rows} filename="manutencoes" columns={cols.map(c=>({key:c.k,label:c.l,fmt:c.f}))} /><button className="btn btn-primary" onClick={()=>setModal(true)}>+ Registrar</button></div>
      </div>
      <div className="page-body">
        <div className="metrics-grid cols-4 mb-16 fade-up">
          <div className="metric-card"><div className="metric-label">Total registros</div><div className="metric-value">{rows.length}</div></div>
          <div className="metric-card"><div className="metric-label">Preventivas</div><div className="metric-value" style={{color:'var(--accent)'}}>{rows.filter(r=>r.tipo_manutencao==='preventiva').length}</div></div>
          <div className="metric-card amber"><div className="metric-label">Obrigações / Custos fixos</div><div className="metric-value" style={{color:'var(--amber)'}}>{rows.filter(r=>r.tipo_manutencao==='obrigacao_legal'||r.tipo_manutencao==='custo_fixo').length}</div></div>
          <div className="metric-card red"><div className="metric-label">Custo total</div><div className="metric-value">{fmt(total)}</div></div>
        </div>
        <div className="card fade-up fade-up-1"><div className="table-wrap"><table>
          <thead><tr><th>Data</th><th>Placa</th><th>Tipo</th><th>Componente</th><th>Fornecedor</th><th>Descrição</th><th>Valor</th><th>Orçamento</th><th>Vencimento</th><th>Aprovado por</th></tr></thead>
          <tbody>
            {loading&&Array.from({length:4}).map((_,i)=>(<tr key={i}>{Array.from({length:10}).map((_,j)=>(<td key={j}><div style={{height:12,background:'var(--bg3)',borderRadius:4,width:'65%'}}/></td>))}</tr>))}
            {!loading&&!rows.length&&<tr><td colSpan={10} style={{textAlign:'center',color:'var(--text3)',padding:'32px 0'}}>Nenhuma manutenção registrada</td></tr>}
            {rows.map(r=>{const venc=r.data_vencimento?new Date(r.data_vencimento+'T12:00:00'):null;const vencido=venc&&venc<new Date();const proxVencer=venc&&!vencido&&(venc-new Date())<30*86400000;return(<tr key={r.id}><td style={{fontSize:12}}>{fmtDate(r.data_manutencao)}</td><td className="font-mono fw-500">{r.placa}</td><td><StatusBadge status={r.tipo_manutencao}/></td><td style={{textTransform:'capitalize'}}>{r.componente}</td><td style={{fontSize:12}}>{r.fornecedor_nome||'—'}</td><td style={{fontSize:12,color:'var(--text2)'}}>{r.descricao||'—'}</td><td className="fw-500">{fmt(r.valor_orcamento)}</td><td style={{fontSize:12,textAlign:'center'}}>{r.orcamento_anexo?<a href={`https://api.wsdevsoft.com/uploads/${r.orcamento_anexo}`} target="_blank" rel="noopener noreferrer" title="Ver orçamento" style={{color:'var(--accent)',textDecoration:'none',fontWeight:600}}>📎 Ver</a>:'—'}</td><td style={{fontSize:12}}>{r.data_vencimento?<span style={{color:vencido?'var(--red)':proxVencer?'var(--amber)':'var(--text2)',fontWeight:vencido||proxVencer?600:400}}>{fmtDate(r.data_vencimento)}{vencido?' ⚠ Vencido':proxVencer?' ⏳ Próximo':''}</span>:'—'}</td><td style={{fontSize:12}}>{r.aprovado_por||'—'}</td></tr>);})}
          </tbody>
        </table></div></div>
      </div>
      {modal&&(<div className="modal-backdrop" onClick={e=>e.target===e.currentTarget&&setModal(false)}><div className="modal" style={{maxWidth:560}}><div className="modal-header"><span className="modal-title">Registrar Manutenção</span><button className="modal-close" onClick={()=>setModal(false)}>×</button></div><div className="modal-body"><div className="form-grid cols-2"><Field label="Veículo *"><Select value={form.veiculo_id||''} onChange={e=>set('veiculo_id',e.target.value)} options={(veiculos||[]).map(v=>({value:v.id,label:`${v.placa} — ${v.tipo}`}))}/></Field><Field label="Data"><Input type="date" value={form.data_manutencao||new Date().toISOString().split('T')[0]} onChange={e=>set('data_manutencao',e.target.value)}/></Field><Field label="Tipo *"><Select value={form.tipo_manutencao||''} onChange={e=>set('tipo_manutencao',e.target.value)} options={[{value:'preventiva',label:'Preventiva'},{value:'corretiva',label:'Corretiva'},{value:'obrigacao_legal',label:'Obrigação Legal'},{value:'custo_fixo',label:'Custo Fixo'}]}/></Field><Field label="Componente *"><Select value={form.componente||''} onChange={e=>set('componente',e.target.value)} options={[{value:'pneus',label:'Pneus'},{value:'oleo',label:'Óleo'},{value:'suspensao',label:'Suspensão'},{value:'freios',label:'Freios'},{value:'motor',label:'Motor'},{value:'eletrica',label:'Elétrica'},{value:'licenciamento',label:'Licenciamento'},{value:'ipva',label:'IPVA'},{value:'seguro_obrigatorio',label:'Seguro Obrigatório (DPVAT)'},{value:'seguro_veiculo',label:'Seguro do Veículo'},{value:'tacografo',label:'Tacógrafo'},{value:'extintor',label:'Extintor'},{value:'revisao_periodica',label:'Revisão Periódica'},{value:'outros',label:'Outros'}]}/></Field><Field label="Valor (R$)"><Input type="number" step="0.01" value={form.valor_orcamento||''} onChange={e=>set('valor_orcamento',e.target.value)}/></Field><Field label="Aprovado por"><Input value={form.aprovado_por||''} onChange={e=>set('aprovado_por',e.target.value)}/></Field><Field label="Vencimento"><Input type="date" value={form.data_vencimento||''} onChange={e=>set('data_vencimento',e.target.value)} placeholder="Para itens com validade"/></Field><Field label="Fornecedor / Prestador"><SelectAdd value={form.fornecedor_id||''} onChange={e=>set('fornecedor_id',e.target.value)} options={(fornecedores||[]).filter(f=>f.ativo!==false).map(f=>({value:f.id,label:f.nome}))} addTitle="Cadastro rápido de Fornecedor" addFields={[{key:'nome',label:'Nome / Razão Social *',full:true,placeholder:'Nome do fornecedor'},{key:'cnpj_cpf',label:'CNPJ / CPF',placeholder:'00.000.000/0000-00'},{key:'telefone',label:'Telefone',placeholder:'(11) 99999-0000'},{key:'tipo',label:'Tipo de Serviço',type:'select',full:true,options:[{value:'mecanica',label:'Mecânica'},{value:'pneus',label:'Pneus'},{value:'eletrica',label:'Elétrica'},{value:'funilaria',label:'Funilaria / Pintura'},{value:'seguros',label:'Seguros'},{value:'licenciamento',label:'Licenciamento / Despachante'},{value:'combustivel',label:'Combustível'},{value:'pecas',label:'Peças / Autopeças'},{value:'tacografo',label:'Tacógrafo'},{value:'outros',label:'Outros'}]}]} onAdd={async(d)=>{if(!d.nome?.trim())throw new Error('Nome é obrigatório');const r=await api.post('/fornecedores',d);refetchFornec();return r.id;}}/></Field><div style={{gridColumn:'span 2'}}><Field label="Orçamento (anexo)"><div style={{position:'relative'}}><input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={e=>{const f=e.target.files[0];if(f)setArquivo(f);}} style={{width:'100%',padding:'8px 12px',border:'1px dashed var(--border)',borderRadius:8,background:'var(--bg2)',color:'var(--text1)',fontSize:13,cursor:'pointer'}}/>{arquivo&&<div style={{marginTop:4,fontSize:12,color:'var(--accent)'}}>📎 {arquivo.name} ({(arquivo.size/1024).toFixed(0)} KB)</div>}</div></Field></div><div style={{gridColumn:'span 2'}}><Field label="Descrição"><Textarea value={form.descricao||''} onChange={e=>set('descricao',e.target.value)}/></Field></div></div></div><div className="modal-footer"><button className="btn btn-ghost" onClick={()=>setModal(false)}>Cancelar</button><button className="btn btn-primary" onClick={save}>Salvar</button></div></div></div>)}
      {toast&&<Toast {...toast}/>}
    </div>
  );
}

export function Multas() {
  const { data, loading, refetch } = useFetch('/multas');
  const { data: veiculos }  = useFetch('/veiculos');
  const { data: motoristas } = useFetch('/motoristas');
  const [modal, setModal] = useState(false);
  const [form, setForm]   = useState({motorista_indicado:false,cabe_recurso:false});
  const { toast, showToast } = useToast();
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  const save=async()=>{ try{await api.post('/multas',form);showToast('Multa registrada!');refetch();setModal(false);setForm({motorista_indicado:false,cabe_recurso:false});}catch(e){showToast(e.message,'error');}};
  const rows=data||[];
  const totalValor=rows.reduce((s,r)=>s+ +(r.valor||0),0);
  const cols=[{k:'data_infracao',l:'Data',f:v=>fmtDate(v)},{k:'placa',l:'Placa'},{k:'modelo',l:'Modelo'},{k:'motorista_nome',l:'Motorista'},{k:'valor',l:'Valor (R$)',f:v=>v?Number(v).toFixed(2):''},{k:'motorista_indicado',l:'Indicado',f:v=>v?'Sim':'Não'},{k:'cabe_recurso',l:'Recurso',f:v=>v?'Sim':'Não'},{k:'descricao',l:'Descrição'}];
  return (
    <div>
      <div className="page-header"><div><div className="page-title">Controle de Multas</div><div className="page-desc">Infrações de trânsito da frota</div></div>
        <div style={{display:'flex',gap:8}}><ExportBtn rows={rows} filename="multas" columns={cols.map(c=>({key:c.k,label:c.l,fmt:c.f}))} /><button className="btn btn-primary" onClick={()=>setModal(true)}>+ Registrar Multa</button></div>
      </div>
      <div className="page-body">
        <div className="metrics-grid cols-3 mb-16 fade-up">
          <div className="metric-card"><div className="metric-label">Total multas</div><div className="metric-value">{rows.length}</div></div>
          <div className="metric-card amber"><div className="metric-label">Com recurso</div><div className="metric-value" style={{color:'var(--amber)'}}>{rows.filter(r=>r.cabe_recurso).length}</div></div>
          <div className="metric-card red"><div className="metric-label">Valor total</div><div className="metric-value" style={{color:'var(--red)'}}>{fmt(totalValor)}</div></div>
        </div>
        <div className="card fade-up fade-up-1"><div className="table-wrap"><table>
          <thead><tr><th>Data</th><th>Placa</th><th>Modelo</th><th>Motorista</th><th>Valor</th><th>Indicado</th><th>Recurso</th><th>Descrição</th></tr></thead>
          <tbody>
            {loading&&Array.from({length:3}).map((_,i)=>(<tr key={i}>{Array.from({length:8}).map((_,j)=>(<td key={j}><div style={{height:12,background:'var(--bg3)',borderRadius:4,width:'65%'}}/></td>))}</tr>))}
            {!loading&&!rows.length&&<tr><td colSpan={8} style={{textAlign:'center',color:'var(--text3)',padding:'32px 0'}}>Nenhuma multa registrada</td></tr>}
            {rows.map(r=>(<tr key={r.id}><td style={{fontSize:12}}>{fmtDate(r.data_infracao)}</td><td className="font-mono fw-500">{r.placa}</td><td style={{fontSize:12}}>{r.modelo} {r.veiculo_tipo}</td><td>{r.motorista_nome||'—'}</td><td className="fw-600" style={{color:'var(--red)'}}>{fmt(r.valor)}</td><td><span className={`badge ${r.motorista_indicado?'badge-green':'badge-red'}`}>{r.motorista_indicado?'Sim':'Não'}</span></td><td><span className={`badge ${r.cabe_recurso?'badge-amber':'badge-red'}`}>{r.cabe_recurso?'Sim':'Não'}</span></td><td style={{fontSize:12,color:'var(--text2)'}}>{r.descricao||'—'}</td></tr>))}
          </tbody>
        </table></div></div>
      </div>
      {modal&&(<div className="modal-backdrop" onClick={e=>e.target===e.currentTarget&&setModal(false)}><div className="modal" style={{maxWidth:560}}><div className="modal-header"><span className="modal-title">Registrar Multa</span><button className="modal-close" onClick={()=>setModal(false)}>×</button></div><div className="modal-body"><div className="form-grid cols-2"><Field label="Veículo *"><Select value={form.veiculo_id||''} onChange={e=>set('veiculo_id',e.target.value)} options={(veiculos||[]).map(v=>({value:v.id,label:`${v.placa} — ${v.tipo}`}))}/></Field><Field label="Motorista"><Select value={form.motorista_id||''} onChange={e=>set('motorista_id',e.target.value)} options={(motoristas||[]).map(m=>({value:m.id,label:m.nome}))}/></Field><Field label="Valor da multa (R$) *"><Input type="number" step="0.01" value={form.valor||''} onChange={e=>set('valor',e.target.value)}/></Field><Field label="Data da infração *"><Input type="date" value={form.data_infracao||''} onChange={e=>set('data_infracao',e.target.value)}/></Field><Field label="Motorista indicado?"><Select value={form.motorista_indicado?'sim':'nao'} onChange={e=>set('motorista_indicado',e.target.value==='sim')} options={[{value:'sim',label:'Sim'},{value:'nao',label:'Não'}]}/></Field><Field label="Cabe recurso?"><Select value={form.cabe_recurso?'sim':'nao'} onChange={e=>set('cabe_recurso',e.target.value==='sim')} options={[{value:'sim',label:'Sim'},{value:'nao',label:'Não'}]}/></Field><div style={{gridColumn:'span 2'}}><Field label="Descrição / infração"><Textarea value={form.descricao||''} onChange={e=>set('descricao',e.target.value)}/></Field></div></div></div><div className="modal-footer"><button className="btn btn-ghost" onClick={()=>setModal(false)}>Cancelar</button><button className="btn btn-primary" onClick={save}>Salvar</button></div></div></div>)}
      {toast&&<Toast {...toast}/>}
    </div>
  );
}

export function Veiculos() {
  const { data, loading, refetch } = useFetch('/veiculos');
  const { data: transportadoras } = useFetch('/transportadoras');
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm]   = useState({});
  const [crlvFile, setCrlvFile] = useState(null);
  const { toast, showToast } = useToast();
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));

  const open = (row=null) => {
    setEditing(row);
    setForm(row ? {
      placa:row.placa, tipo:row.tipo, modelo:row.modelo, ano:row.ano,
      renavam:row.renavam, ag_ft:row.ag_ft, transportadora_id:row.transportadora_id,
      proprietario:row.proprietario, responsavel:row.responsavel,
      status_cadastro:row.status_cadastro,
    } : {});
    setCrlvFile(null);
    setModal(true);
  };
  const close = () => { setModal(false); setEditing(null); setForm({}); setCrlvFile(null); };

  const save = async () => {
    try {
      const fd = new FormData();
      for (const [k,v] of Object.entries(form)) {
        if (v != null && v !== '') fd.append(k, v);
      }
      if (crlvFile) fd.append('crlv', crlvFile);
      // Marca como completo se admin tá editando
      if (!form.status_cadastro) fd.append('status_cadastro', 'completo');

      const token = localStorage.getItem('logi_token');
      const url = editing
        ? `https://api.wsdevsoft.com/api/veiculos/${editing.id}`
        : 'https://api.wsdevsoft.com/api/veiculos';
      const method = editing ? 'PUT' : 'POST';
      const res = await fetch(url, { method, body: fd, headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('Erro ao salvar');
      showToast(editing ? 'Veículo atualizado!' : 'Veículo cadastrado!');
      refetch(); close();
    } catch(e) { showToast(e.message,'error'); }
  };

  const desativar = async (id) => {
    if (!confirm('Desativar este veículo?')) return;
    try { await api.patch(`/veiculos/${id}/desativar`,{}); showToast('Veículo desativado'); refetch(); }
    catch(e) { showToast(e.message,'error'); }
  };

  const rows=data||[];
  return (
    <div>
      <div className="page-header"><div><div className="page-title">Frota / Veículos</div><div className="page-desc">Caminhões próprios e de terceiros</div></div><div style={{display:'flex',gap:8,alignItems:'center'}}><ExportBtn rows={rows} filename="veiculos" columns={[
            {key:'placa',label:'Placa'},{key:'tipo',label:'Tipo'},{key:'modelo',label:'Modelo'},
            {key:'ano',label:'Ano'},{key:'renavam',label:'RENAVAM'},{key:'transportadora_nome',label:'Transportadora'},
            {key:'ag_ft',label:'Ag/Frota'},{key:'proprietario',label:'Proprietário'},
          ]} /><button className="btn btn-primary" onClick={()=>open()}>+ Cadastrar Veículo</button></div></div>
      <div className="page-body"><div className="card fade-up"><div className="table-wrap"><table>
        <thead><tr><th>Placa</th><th>Tipo</th><th>Modelo</th><th>Ano</th><th>Transportadora</th><th>Ag/Ft</th><th>Status</th><th></th></tr></thead>
        <tbody>
          {loading&&Array.from({length:5}).map((_,i)=>(<tr key={i}>{Array.from({length:8}).map((_,j)=>(<td key={j}><div style={{height:12,background:'var(--bg3)',borderRadius:4,width:'65%'}}/></td>))}</tr>))}
          {rows.map(r=>(<tr key={r.id}>
            <td className="font-mono fw-500">{r.placa}</td>
            <td><span className="badge badge-teal">{r.tipo}</span></td>
            <td>{r.modelo||'—'}</td>
            <td style={{fontSize:12}}>{r.ano||'—'}</td>
            <td style={{fontSize:12}}>{r.transportadora_nome||'—'}</td>
            <td><StatusBadge status={r.ag_ft}/></td>
            <td>{r.status_cadastro==='pendente_admin'
              ? <span className="badge" style={{background:'#fef3c7',color:'#92400e'}}>⚠️ Pendente</span>
              : <span style={{fontSize:11,color:'var(--text3)'}}>OK</span>}</td>
            <td><div style={{display:'flex',gap:4}}>
              <button className="btn btn-ghost btn-sm" onClick={()=>open(r)}>Editar</button>
              <button className="btn btn-danger btn-sm" onClick={()=>desativar(r.id)}>✕</button>
            </div></td>
          </tr>))}
        </tbody>
      </table></div></div></div>
      {modal&&(<div className="modal-backdrop" onClick={e=>e.target===e.currentTarget&&close()}>
        <div className="modal" style={{maxWidth:560}}>
          <div className="modal-header">
            <span className="modal-title">{editing?'Editar Veículo':'Cadastrar Veículo'}</span>
            <button className="modal-close" onClick={close}>×</button>
          </div>
          <div className="modal-body">
            <div className="form-grid cols-2">
              {/* 1. Frota */}
              <Field label="Frota *">
                <Select value={form.ag_ft||''} onChange={e=>set('ag_ft',e.target.value)}
                  options={[{value:'frota',label:'🏠 Próprio'},{value:'terceiro',label:'🚚 Terceiro'}]}/>
              </Field>
              {/* 2. Placa */}
              <Field label="Placa *">
                <Input value={form.placa||''} onChange={e=>set('placa',e.target.value.toUpperCase())} placeholder="AAA0A00"/>
              </Field>
              {/* 3. Tipo */}
              <Field label="Tipo *">
                <Select value={form.tipo||''} onChange={e=>set('tipo',e.target.value)}
                  options={['HR','IVECO','3/4','TOCO','TRUCK','MASTER','SPRINTER','CARRO / CARRETA'].map(v=>({value:v,label:v}))}/>
              </Field>
              <Field label="Modelo">
                <Input value={form.modelo||''} onChange={e=>set('modelo',e.target.value)} placeholder="ex: Daily 35S14"/>
              </Field>
              <Field label="Ano">
                <Input type="number" value={form.ano||''} onChange={e=>set('ano',e.target.value)} placeholder="2022"/>
              </Field>
              <Field label="RENAVAM">
                <Input value={form.renavam||''} onChange={e=>set('renavam',e.target.value)}/>
              </Field>
              <Field label="Proprietário">
                <Input value={form.proprietario||''} onChange={e=>set('proprietario',e.target.value)} placeholder="Nome do dono"/>
              </Field>
              <Field label="Responsável">
                <Input value={form.responsavel||''} onChange={e=>set('responsavel',e.target.value)} placeholder="Quem responde"/>
              </Field>
              <div style={{gridColumn:'span 2'}}>
                <Field label="Transportadora">
                  <Select value={form.transportadora_id||''} onChange={e=>set('transportadora_id',e.target.value)}
                    options={[{value:'',label:'— Nenhuma —'},...(transportadoras||[]).map(t=>({value:t.id,label:t.nome}))]}/>
                </Field>
              </div>
              <div style={{gridColumn:'span 2'}}>
                <Field label="CRLV (PDF/imagem)">
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png"
                    onChange={e=>setCrlvFile(e.target.files?.[0]||null)}
                    style={{padding:6,fontSize:13}} />
                  {editing?.crlv_arquivo_nome && !crlvFile && (
                    <div style={{fontSize:11,color:'var(--text3)',marginTop:4}}>
                      📎 Arquivo atual: {editing.crlv_arquivo_nome}
                    </div>
                  )}
                </Field>
              </div>
              {editing?.status_cadastro === 'pendente_admin' && (
                <div style={{gridColumn:'span 2'}}>
                  <Field label="Status do Cadastro">
                    <Select value={form.status_cadastro||'pendente_admin'} onChange={e=>set('status_cadastro',e.target.value)}
                      options={[{value:'pendente_admin',label:'⚠️ Pendente Administrativo'},{value:'completo',label:'✓ Completo'}]} />
                  </Field>
                </div>
              )}
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-ghost" onClick={close}>Cancelar</button>
            <button className="btn btn-primary" onClick={save}>{editing?'Salvar':'Cadastrar'}</button>
          </div>
        </div>
      </div>)}
      {toast&&<Toast {...toast}/>}
    </div>
  );
}

export function Motoristas() {
  const { data, loading, refetch } = useFetch('/motoristas');
  const { data: veiculos } = useFetch('/veiculos');
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm]   = useState({});
  const [cnhFile, setCnhFile] = useState(null);
  const [cnpjFile, setCnpjFile] = useState(null);
  const [comprovanteFile, setComprovanteFile] = useState(null);
  const [contratoFile, setContratoFile] = useState(null);
  const { toast, showToast } = useToast();
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  const [buscandoCep, setBuscandoCep] = useState(false);

  // Máscara e busca de CEP via ViaCEP (auto-fill de endereço)
  const maskCEP = v => (v||'').replace(/\D/g,'').replace(/(\d{5})(\d)/,'$1-$2').slice(0,9);
  const handleCEP = async (raw) => {
    const masked = maskCEP(raw);
    setForm(f => ({ ...f, endereco_cep: masked }));
    const clean = (raw||'').replace(/\D/g,'');
    if (clean.length !== 8) return;
    setBuscandoCep(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
      const d = await res.json();
      if (!d.erro) {
        setForm(f => ({
          ...f,
          endereco_logradouro: d.logradouro || f.endereco_logradouro || '',
          endereco_bairro:     d.bairro     || f.endereco_bairro     || '',
          endereco_cidade:     d.localidade || f.endereco_cidade     || '',
          endereco_estado:     d.uf         || f.endereco_estado     || '',
        }));
      }
    } catch (e) { /* silencioso, usuário pode preencher manual */ }
    finally { setBuscandoCep(false); }
  };

  const open = (row=null) => {
    setEditing(row);
    setForm(row ? {
      nome:row.nome, cnh:row.cnh, telefone:row.telefone,
      tipo_colaborador:row.tipo_colaborador || 'pendente',
      veiculo_padrao_id:row.veiculo_padrao_id,
      cnh_validade:row.cnh_validade?.substring(0,10) || '',
      cnh_categoria:row.cnh_categoria || '',
      endereco_cep:row.endereco_cep, endereco_logradouro:row.endereco_logradouro,
      endereco_numero:row.endereco_numero, endereco_complemento:row.endereco_complemento,
      endereco_bairro:row.endereco_bairro, endereco_cidade:row.endereco_cidade, endereco_estado:row.endereco_estado,
      contato_esposa:row.contato_esposa, contato_pai:row.contato_pai, contato_mae:row.contato_mae,
      contato_outro_nome:row.contato_outro_nome, contato_outro_telefone:row.contato_outro_telefone,
      status_cadastro:row.status_cadastro,
      dono_veiculo:row.dono_veiculo,
      data_admissao:row.data_admissao?.substring(0,10) || '',
      cnpj:row.cnpj,
      cpf:row.cpf,
      rg:row.rg,
    } : {});
    setCnhFile(null);
    setCnpjFile(null);
    setComprovanteFile(null);
    setContratoFile(null);
    setModal(true);
  };
  const close = () => {
    setModal(false); setEditing(null); setForm({});
    setCnhFile(null); setCnpjFile(null); setComprovanteFile(null); setContratoFile(null);
  };

  const save = async () => {
    try {
      // Validações obrigatórias
      if (!form.nome || !form.nome.trim()) {
        showToast('Nome é obrigatório','error'); return;
      }
      if (!form.cpf || !form.cpf.trim()) {
        showToast('CPF é obrigatório','error'); return;
      }
      if (!form.rg || !form.rg.trim()) {
        showToast('RG é obrigatório','error'); return;
      }

      const fd = new FormData();
      for (const [k,v] of Object.entries(form)) {
        if (v != null && v !== '') fd.append(k, v);
      }
      if (cnhFile)         fd.append('cnh_arquivo', cnhFile);
      if (cnpjFile)        fd.append('cnpj_arquivo', cnpjFile);
      if (comprovanteFile) fd.append('comprovante_endereco', comprovanteFile);
      if (contratoFile)    fd.append('contrato_social', contratoFile);
      if (!form.status_cadastro) fd.append('status_cadastro', 'completo');

      const token = localStorage.getItem('logi_token');
      const url = editing
        ? `https://api.wsdevsoft.com/api/motoristas/${editing.id}`
        : 'https://api.wsdevsoft.com/api/motoristas';
      const method = editing ? 'PUT' : 'POST';
      const res = await fetch(url, { method, body: fd, headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) {
        let msg = 'Erro ao salvar';
        try { const data = await res.json(); if (data.error) msg = data.error; } catch {}
        throw new Error(msg);
      }
      showToast(editing ? 'Colaborador atualizado!' : 'Colaborador cadastrado!');
      refetch(); close();
    } catch(e) { showToast(e.message,'error'); }
  };

  const rows=data||[];
  return (
    <div>
      <div className="page-header"><div><div className="page-title">Colaboradores</div><div className="page-desc">Motoristas, ajudantes e administrativos</div></div><div style={{display:'flex',gap:8,alignItems:'center'}}><ExportBtn rows={rows} filename="colaboradores" columns={[
            {key:'nome',label:'Nome'},{key:'cpf',label:'CPF'},{key:'rg',label:'RG'},{key:'tipo_colaborador',label:'Tipo'},{key:'cnh',label:'CNH'},{key:'cnh_categoria',label:'Cat.'},
            {key:'cnh_validade',label:'Validade CNH'},{key:'telefone',label:'Telefone'},
            {key:'veiculo_padrao_placa',label:'Veículo Padrão'},
          ]} /><button className="btn btn-ghost" onClick={()=>window.location.assign('/cadastros-motorista')} title="Gerar convite p/ colaborador preencher o cadastro online">📨 Gerar Convite</button><button className="btn btn-primary" onClick={()=>open()}>+ Cadastrar Colaborador</button></div></div>
      <div className="page-body"><div className="card fade-up"><div className="table-wrap"><table>
        <thead><tr><th>Nome</th><th>Tipo</th><th>CNH</th><th>Cat.</th><th>Validade</th><th>Telefone</th><th>Veículo</th><th>Status</th><th></th></tr></thead>
        <tbody>
          {loading&&Array.from({length:5}).map((_,i)=>(<tr key={i}>{Array.from({length:9}).map((_,j)=>(<td key={j}><div style={{height:12,background:'var(--bg3)',borderRadius:4,width:'65%'}}/></td>))}</tr>))}
          {rows.map(r=>{
            const venc = r.cnh_validade ? new Date(r.cnh_validade) : null;
            const proxVenc = venc && (venc - new Date()) < (60*86400000); // 60 dias
            const tipoLabels = {
              motorista_proprio:'🏠 Motorista Próprio',
              motorista_terceiro:'🚚 Motorista Terceiro',
              ajudante:'👷 Ajudante',
              administrativo:'💼 Administrativo',
              pendente:'⏳ Pendente',
            };
            return (<tr key={r.id}>
              <td className="fw-500">{r.nome}</td>
              <td style={{fontSize:12}}>{tipoLabels[r.tipo_colaborador] || '—'}</td>
              <td className="font-mono" style={{fontSize:12}}>{r.cnh||'—'}</td>
              <td style={{fontSize:12}}>{r.cnh_categoria||'—'}</td>
              <td style={{fontSize:12,color:proxVenc?'#dc2626':'inherit',fontWeight:proxVenc?600:400}}>
                {venc?venc.toLocaleDateString('pt-BR'):'—'}{proxVenc&&' ⚠️'}
              </td>
              <td style={{fontSize:12}}>{r.telefone||'—'}</td>
              <td style={{fontSize:12}}>
                {r.veiculo_padrao_placa
                  ? <span><span className="badge badge-teal">{r.veiculo_padrao_tipo}</span> <span style={{marginLeft:4}}>{r.veiculo_padrao_placa}</span></span>
                  : <span style={{color:'var(--text3)'}}>—</span>}
              </td>
              <td>{r.status_cadastro==='pendente_admin'
                ? <span className="badge" style={{background:'#fef3c7',color:'#92400e'}}>⚠️ Pendente</span>
                : <span style={{fontSize:11,color:'var(--text3)'}}>OK</span>}</td>
              <td><button className="btn btn-ghost btn-sm" onClick={()=>open(r)}>Editar</button></td>
            </tr>);
          })}
        </tbody>
      </table></div></div></div>
      {modal&&(<div className="modal-backdrop" onClick={e=>e.target===e.currentTarget&&close()}>
        <div className="modal" style={{maxWidth:640}}>
          <div className="modal-header">
            <span className="modal-title">{editing?'Editar Colaborador':'Cadastrar Colaborador'}</span>
            <button className="modal-close" onClick={close}>×</button>
          </div>
          <div className="modal-body">
            {/* Bloco identificação */}
            <div style={{fontSize:11,fontWeight:600,color:'var(--text3)',textTransform:'uppercase',letterSpacing:'.5px',marginBottom:8}}>Identificação</div>
            <div className="form-grid cols-2" style={{marginBottom:14}}>
              <div style={{gridColumn:'span 2'}}>
                <Field label="Tipo de Colaborador">
                  <Select value={form.tipo_colaborador||''} onChange={e=>set('tipo_colaborador',e.target.value)}
                    options={[
                      {value:'',label:'— Selecionar —'},
                      {value:'motorista_proprio',label:'🏠 Motorista Próprio'},
                      {value:'motorista_terceiro',label:'🚚 Motorista Terceiro'},
                      {value:'ajudante',label:'👷 Ajudante'},
                      {value:'administrativo',label:'💼 Administrativo'},
                      {value:'pendente',label:'⏳ Pendente (admin classificará)'},
                    ]}/>
                </Field>
              </div>
              <div style={{gridColumn:'span 2'}}>
                <Field label="Nome completo *">
                  <Input value={form.nome||''} onChange={e=>set('nome',e.target.value)}/>
                </Field>
              </div>
              <Field label="CPF *">
                <Input value={form.cpf||''} onChange={e=>{
                  const v = (e.target.value||'').replace(/\D/g,'').slice(0,11)
                    .replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d{1,2})$/,'$1-$2');
                  set('cpf', v);
                }} placeholder="000.000.000-00" maxLength={14}/>
              </Field>
              <Field label="RG *">
                <Input value={form.rg||''} onChange={e=>set('rg', e.target.value)}
                  placeholder="00.000.000-0" maxLength={20}/>
              </Field>
              <Field label="Telefone"><Input value={form.telefone||''} onChange={e=>set('telefone',e.target.value)}/></Field>
              <Field label="CNH"><Input value={form.cnh||''} onChange={e=>set('cnh',e.target.value)}/></Field>
              <Field label="Categoria CNH">
                <Select value={form.cnh_categoria||''} onChange={e=>set('cnh_categoria',e.target.value)}
                  options={[{value:'',label:'—'},...['A','B','C','D','E','AB','AC','AD','AE'].map(v=>({value:v,label:v}))]}/>
              </Field>
              <Field label="Validade CNH">
                <Input type="date" value={form.cnh_validade||''} onChange={e=>set('cnh_validade',e.target.value)}/>
              </Field>
              <div style={{gridColumn:'span 2'}}>
                <Field label="CNH (PDF/imagem)">
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png"
                    onChange={e=>setCnhFile(e.target.files?.[0]||null)} style={{padding:6,fontSize:13}} />
                  {editing?.cnh_arquivo_nome && !cnhFile && (
                    <div style={{fontSize:11,color:'var(--text3)',marginTop:4}}>
                      📎 Arquivo atual: {editing.cnh_arquivo_nome}
                    </div>
                  )}
                </Field>
              </div>
            </div>

            {/* Bloco endereço */}
            <div style={{fontSize:11,fontWeight:600,color:'var(--text3)',textTransform:'uppercase',letterSpacing:'.5px',marginBottom:8}}>Endereço Residencial</div>
            <div className="form-grid cols-2" style={{marginBottom:14}}>
              <Field label="CEP">
                <Input value={form.endereco_cep||''} onChange={e=>handleCEP(e.target.value)} placeholder="00000-000" maxLength={9}/>
                {buscandoCep && <div style={{fontSize:11,color:'#2563eb',marginTop:2}}>Buscando CEP...</div>}
              </Field>
              <Field label="Cidade / UF">
                <div style={{display:'flex',gap:6}}>
                  <Input value={form.endereco_cidade||''} onChange={e=>set('endereco_cidade',e.target.value)}/>
                  <Input value={form.endereco_estado||''} onChange={e=>set('endereco_estado',e.target.value.toUpperCase())} maxLength={2} style={{width:60}}/>
                </div>
              </Field>
              <div style={{gridColumn:'span 2'}}>
                <Field label="Logradouro"><Input value={form.endereco_logradouro||''} onChange={e=>set('endereco_logradouro',e.target.value)}/></Field>
              </div>
              <Field label="Número"><Input value={form.endereco_numero||''} onChange={e=>set('endereco_numero',e.target.value)}/></Field>
              <Field label="Complemento"><Input value={form.endereco_complemento||''} onChange={e=>set('endereco_complemento',e.target.value)}/></Field>
              <div style={{gridColumn:'span 2'}}>
                <Field label="Bairro"><Input value={form.endereco_bairro||''} onChange={e=>set('endereco_bairro',e.target.value)}/></Field>
              </div>
            </div>

            {/* Bloco contatos */}
            <div style={{fontSize:11,fontWeight:600,color:'var(--text3)',textTransform:'uppercase',letterSpacing:'.5px',marginBottom:8}}>Telefones de Contato</div>
            <div className="form-grid cols-2" style={{marginBottom:14}}>
              <Field label="Esposa"><Input value={form.contato_esposa||''} onChange={e=>set('contato_esposa',e.target.value)}/></Field>
              <Field label="Pai"><Input value={form.contato_pai||''} onChange={e=>set('contato_pai',e.target.value)}/></Field>
              <Field label="Mãe"><Input value={form.contato_mae||''} onChange={e=>set('contato_mae',e.target.value)}/></Field>
              <Field label="Outro (nome)"><Input value={form.contato_outro_nome||''} onChange={e=>set('contato_outro_nome',e.target.value)}/></Field>
              <div style={{gridColumn:'span 2'}}>
                <Field label="Outro (telefone)"><Input value={form.contato_outro_telefone||''} onChange={e=>set('contato_outro_telefone',e.target.value)}/></Field>
              </div>
            </div>

            {/* Bloco documentos */}
            <div style={{fontSize:11,fontWeight:600,color:'var(--text3)',textTransform:'uppercase',letterSpacing:'.5px',marginBottom:8}}>Documentos</div>
            <div className="form-grid cols-2" style={{marginBottom:14}}>
              <Field label="Comprovante de Endereço (PDF/imagem)">
                <input type="file" accept=".pdf,.jpg,.jpeg,.png"
                  onChange={e=>setComprovanteFile(e.target.files?.[0]||null)} style={{padding:6,fontSize:13}} />
                {editing?.comprovante_endereco_nome && !comprovanteFile && (
                  <div style={{fontSize:11,color:'var(--text3)',marginTop:4}}>
                    📎 <a href={`https://api.wsdevsoft.com/api/motoristas/${editing.id}/comprovante-endereco`} target="_blank" rel="noreferrer" style={{color:'var(--accent)'}}>{editing.comprovante_endereco_nome}</a>
                  </div>
                )}
              </Field>
              <Field label="Cartão CNPJ (PDF/imagem)">
                <input type="file" accept=".pdf,.jpg,.jpeg,.png"
                  onChange={e=>setCnpjFile(e.target.files?.[0]||null)} style={{padding:6,fontSize:13}} />
                {editing?.cnpj_arquivo_nome && !cnpjFile && (
                  <div style={{fontSize:11,color:'var(--text3)',marginTop:4}}>
                    📎 <a href={`https://api.wsdevsoft.com/api/motoristas/${editing.id}/cnpj-arquivo`} target="_blank" rel="noreferrer" style={{color:'var(--accent)'}}>{editing.cnpj_arquivo_nome}</a>
                  </div>
                )}
              </Field>
              <div style={{gridColumn:'span 2'}}>
                <Field label="Contrato Social (PDF/imagem)">
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png"
                    onChange={e=>setContratoFile(e.target.files?.[0]||null)} style={{padding:6,fontSize:13}} />
                  {editing?.contrato_social_nome && !contratoFile && (
                    <div style={{fontSize:11,color:'var(--text3)',marginTop:4}}>
                      📎 <a href={`https://api.wsdevsoft.com/api/motoristas/${editing.id}/contrato-social`} target="_blank" rel="noreferrer" style={{color:'var(--accent)'}}>{editing.contrato_social_nome}</a>
                    </div>
                  )}
                </Field>
              </div>
            </div>

            {/* Bloco vínculos */}
            <div style={{fontSize:11,fontWeight:600,color:'var(--text3)',textTransform:'uppercase',letterSpacing:'.5px',marginBottom:8}}>Vínculos</div>
            <div className="form-grid cols-2">
              <div style={{gridColumn:'span 2'}}>
                <Field label="Veículo Padrão">
                  <Select value={form.veiculo_padrao_id||''} onChange={e=>set('veiculo_padrao_id',e.target.value)}
                    options={[{value:'',label:'— Nenhum —'},...(veiculos||[]).map(v=>({value:v.id,label:`${v.placa} — ${v.tipo}`}))]}/>
                </Field>
              </div>
              <div style={{gridColumn:'span 2'}}>
                <Field label="Dono do Veículo">
                  <Input value={form.dono_veiculo||''} onChange={e=>set('dono_veiculo',e.target.value)}
                    placeholder="Ex: Próprio, João da Silva, Empresa XYZ"/>
                </Field>
              </div>
              <Field label="Data de Admissão">
                <Input type="date" value={form.data_admissao||''} onChange={e=>set('data_admissao',e.target.value)}/>
              </Field>
              <Field label="CNPJ (terceiros / PJ)">
                <Input value={form.cnpj||''} onChange={e=>set('cnpj',e.target.value)} placeholder="00.000.000/0000-00"/>
              </Field>
              {editing?.status_cadastro === 'pendente_admin' && (
                <div style={{gridColumn:'span 2'}}>
                  <Field label="Status do Cadastro">
                    <Select value={form.status_cadastro||'pendente_admin'} onChange={e=>set('status_cadastro',e.target.value)}
                      options={[{value:'pendente_admin',label:'⚠️ Pendente Administrativo'},{value:'completo',label:'✓ Completo'}]} />
                  </Field>
                </div>
              )}

              {editing && (
                <div style={{gridColumn:'span 2', marginTop:8, padding:'12px 14px', background:'rgba(37,99,235,.06)', borderRadius:8, border:'1px solid rgba(37,99,235,.15)'}}>
                  <div style={{fontSize:11, fontWeight:600, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:8}}>
                    🔑 Acesso ao app do colaborador (/m)
                  </div>
                  {editing.cpf ? (
                    <div style={{display:'flex', alignItems:'center', gap:10, flexWrap:'wrap'}}>
                      <div style={{fontSize:13, flex:1, minWidth:200}}>
                        {editing.tem_senha
                          ? <span>✓ Colaborador tem senha cadastrada{editing.ultimo_login && <span style={{color:'var(--text3)'}}> (último login: {fmtDate(editing.ultimo_login)})</span>}</span>
                          : <span style={{color:'var(--amber)'}}>⚠️ Colaborador ainda não tem senha. Gere uma para liberar o acesso ao app.</span>
                        }
                      </div>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={gerarSenha} disabled={gerandoSenha} style={{color:'#2563eb', whiteSpace:'nowrap'}}>
                        {gerandoSenha ? 'Gerando...' : (editing.tem_senha ? '↻ Redefinir senha' : '🔑 Gerar senha')}
                      </button>
                    </div>
                  ) : (
                    <div style={{fontSize:12, color:'var(--text3)'}}>
                      ℹ️ Preencha e salve o CPF do colaborador antes de gerar a senha de acesso.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-ghost" onClick={close}>Cancelar</button>
            <button className="btn btn-primary" onClick={save}>{editing?'Salvar':'Cadastrar'}</button>
          </div>
        </div>
      </div>)}
      {toast&&<Toast {...toast}/>}
    </div>
  );
}
