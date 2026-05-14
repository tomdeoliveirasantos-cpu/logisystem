import { useState, useMemo } from 'react';
import { useFetch } from '../hooks/useFetch';
import { api } from '../lib/api';
import { Modal, Field, Input, Select, Textarea, useToast, Toast } from '../components/UI';

const fmt = v => v!==null && v!==undefined ? new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v) : '—';
const fmtDate = d => {
  if (!d) return '—';
  const s = String(d).substring(0, 10);
  const dt = new Date(s + 'T12:00:00');
  if (isNaN(dt)) return '—';
  return dt.toLocaleDateString('pt-BR');
};
const fmtDateTime = d => {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt)) return '—';
  return dt.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
};

const STATUS_INFO = {
  pendente:     { label: 'Pendente',     color: '#6B7280', bg: 'rgba(107,114,128,.12)' },
  entregue:     { label: 'Entregue',     color: '#059669', bg: 'rgba(5,150,105,.12)'  },
  nao_entregue: { label: 'Não entregue', color: '#DC2626', bg: 'rgba(220,38,38,.12)'  },
  reentrega:    { label: 'Reentrega',    color: '#D97706', bg: 'rgba(217,119,6,.12)'  },
  cancelada:    { label: 'Cancelada',    color: '#4B5563', bg: 'rgba(75,85,99,.12)'   },
};

const MOTIVOS_NAO_ENTREGA = [
  'Cliente ausente',
  'Endereço errado / não localizado',
  'Recusou a entrega',
  'Estabelecimento fechado',
  'Mercadoria avariada',
  'Documentação incompleta',
  'Outro',
];

function StatusBadge({ status }) {
  const info = STATUS_INFO[status] || STATUS_INFO.pendente;
  return (
    <span style={{
      display:'inline-block', padding:'3px 8px', borderRadius:6, fontSize:11,
      fontWeight:600, color:info.color, background:info.bg,
    }}>{info.label}</span>
  );
}

export default function Entregas() {
  // Filtros (padrão: últimos 7 dias)
  const hoje = new Date().toISOString().slice(0, 10);
  const seteDiasAtras = new Date(Date.now() - 7*24*60*60*1000).toISOString().slice(0, 10);

  const [filtros, setFiltros] = useState({
    data_de: seteDiasAtras,
    data_ate: hoje,
    status: '',
    motorista_id: '',
    aguardando_reagendamento: false,
  });

  // URL params da busca
  const qs = useMemo(() => {
    const p = new URLSearchParams();
    if (filtros.data_de)  p.set('data_de',  filtros.data_de);
    if (filtros.data_ate) p.set('data_ate', filtros.data_ate);
    if (filtros.status)   p.set('status',   filtros.status);
    if (filtros.motorista_id) p.set('motorista_id', filtros.motorista_id);
    if (filtros.aguardando_reagendamento) p.set('aguardando_reagendamento', 'true');
    return p.toString();
  }, [filtros]);

  const { data, loading, refetch } = useFetch(`/ordens/entregas?${qs}`);
  const { data: motoristas } = useFetch('/motoristas');
  const { data: ots } = useFetch('/ordens'); // pra reagendar
  const { toast, showToast } = useToast();

  const [marcando, setMarcando] = useState(null); // parada em fluxo de marcação
  const [reagendando, setReagendando] = useState(null); // parada em fluxo de reagendamento

  const rows = data?.rows || [];
  const m = data?.metricas || { total: 0, entregue: 0, nao_entregue: 0, pendente: 0, reentrega: 0, taxa_sucesso: 0 };

  const marcarStatus = (parada, novoStatus) => {
    if (novoStatus === 'entregue' || novoStatus === 'cancelada') {
      // Operação direta com confirm simples
      const msg = novoStatus === 'entregue'
        ? `Confirmar entrega de "${parada.cliente_nome || 'NF '+parada.nf}"?`
        : `Cancelar a entrega de "${parada.cliente_nome || 'NF '+parada.nf}"?`;
      if (!confirm(msg)) return;
      api.patch(`/ordens/paradas/${parada.id}/status`, { status: novoStatus, marcado_por: 'admin' })
        .then(() => { showToast('Status atualizado!'); refetch(); })
        .catch(e => showToast(e.message, 'error'));
    } else {
      // Abre modal pra capturar motivo/obs
      setMarcando({ parada, novoStatus });
    }
  };

  const confirmarMarcacao = async ({ motivo, observacao }) => {
    try {
      await api.patch(`/ordens/paradas/${marcando.parada.id}/status`, {
        status: marcando.novoStatus,
        motivo_nao_entrega: motivo || null,
        observacao: observacao || null,
        marcado_por: 'admin',
      });
      showToast('Status atualizado!');
      setMarcando(null);
      refetch();
    } catch (e) { showToast(e.message, 'error'); }
  };

  const confirmarReagendamento = async (ordemDestinoId) => {
    if (!ordemDestinoId) return showToast('Selecione uma OT destino', 'error');
    try {
      await api.post(`/ordens/paradas/${reagendando.id}/reagendar`, { ordem_id_destino: ordemDestinoId });
      showToast('Entrega reagendada com sucesso!');
      setReagendando(null);
      refetch();
    } catch (e) { showToast(e.message, 'error'); }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Entregas</div>
          <div className="page-desc">Acompanhamento individual de cada parada por rota</div>
        </div>
      </div>

      <div className="page-body">
        {/* Filtros */}
        <div className="card fade-up" style={{padding:14, marginBottom:14}}>
          <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(140px, 1fr))', gap:10}}>
            <Field label="De"><Input type="date" value={filtros.data_de} onChange={e=>setFiltros(f=>({...f, data_de:e.target.value}))} /></Field>
            <Field label="Até"><Input type="date" value={filtros.data_ate} onChange={e=>setFiltros(f=>({...f, data_ate:e.target.value}))} /></Field>
            <Field label="Status">
              <Select value={filtros.status} onChange={e=>setFiltros(f=>({...f, status:e.target.value}))}
                options={[{value:'',label:'Todos'}, ...Object.entries(STATUS_INFO).map(([v,info])=>({value:v, label:info.label}))]}/>
            </Field>
            <Field label="Motorista">
              <Select value={filtros.motorista_id} onChange={e=>setFiltros(f=>({...f, motorista_id:e.target.value}))}
                options={[{value:'',label:'Todos'}, ...(motoristas||[]).map(m=>({value:m.id, label:m.nome}))]}/>
            </Field>
            <Field label="">
              <label style={{display:'flex', alignItems:'center', gap:6, marginTop:6, fontSize:13, cursor:'pointer'}}>
                <input type="checkbox" checked={filtros.aguardando_reagendamento}
                  onChange={e=>setFiltros(f=>({...f, aguardando_reagendamento:e.target.checked}))} />
                Aguardando reagendamento
              </label>
            </Field>
          </div>
        </div>

        {/* Métricas */}
        <div className="metrics-grid cols-5 mb-16 fade-up">
          <div className="metric-card">
            <div className="metric-label">Total no período</div>
            <div className="metric-value">{m.total}</div>
          </div>
          <div className="metric-card green">
            <div className="metric-label">Entregues</div>
            <div className="metric-value" style={{color:'var(--green)'}}>{m.entregue}</div>
          </div>
          <div className="metric-card" style={{borderLeftColor:'#DC2626'}}>
            <div className="metric-label">Não entregues</div>
            <div className="metric-value" style={{color:'#DC2626'}}>{m.nao_entregue}</div>
          </div>
          <div className="metric-card amber">
            <div className="metric-label">Reentregas</div>
            <div className="metric-value" style={{color:'var(--amber)'}}>{m.reentrega}</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Taxa de sucesso</div>
            <div className="metric-value" style={{color:m.taxa_sucesso >= 90 ? 'var(--green)' : m.taxa_sucesso >= 70 ? 'var(--amber)' : '#DC2626'}}>
              {m.taxa_sucesso}%
            </div>
          </div>
        </div>

        {/* Tabela */}
        <div className="card fade-up fade-up-1"><div className="table-wrap"><table>
          <thead><tr>
            <th>Data</th><th>Rota</th><th>Motorista</th><th>Cliente</th><th>NF</th>
            <th>Status</th><th>Marcado em</th><th style={{minWidth:220}}>Ação</th>
          </tr></thead>
          <tbody>
            {loading && Array.from({length:5}).map((_,i)=>(
              <tr key={i}>{Array.from({length:8}).map((_,j)=>(<td key={j}><div style={{height:12,background:'var(--bg3)',borderRadius:4,width:'60%'}}/></td>))}</tr>
            ))}
            {!loading && !rows.length && (
              <tr><td colSpan={8} style={{textAlign:'center', color:'var(--text3)', padding:'32px 0'}}>
                Nenhuma entrega no período. Importe planilhas no menu "Importar Planilha" e elas aparecerão aqui.
              </td></tr>
            )}
            {rows.map(r => (
              <tr key={r.id}>
                <td style={{fontSize:12}}>{fmtDate(r.ot_data)}</td>
                <td className="font-mono fw-600" style={{color:'var(--accent)', fontSize:12}}>{r.numero_rota || '—'}</td>
                <td style={{fontSize:13}}>
                  {r.motorista_nome || <span style={{color:'var(--text3)'}}>—</span>}
                  {r.veiculo_placa && <div style={{fontSize:11, color:'var(--text3)'}}>🚛 {r.veiculo_placa}</div>}
                </td>
                <td style={{fontSize:13, maxWidth:220}}>
                  <div className="truncate fw-500">{r.cliente_nome || '—'}</div>
                  {r.endereco && <div className="truncate" style={{fontSize:11, color:'var(--text3)'}}>{r.endereco}</div>}
                  {r.tentativa_numero > 1 && (
                    <div style={{fontSize:11, color:'var(--amber)'}}>🔁 Tentativa #{r.tentativa_numero}</div>
                  )}
                </td>
                <td className="font-mono" style={{fontSize:12}}>{r.nf || '—'}</td>
                <td><StatusBadge status={r.status} /></td>
                <td style={{fontSize:11, color:'var(--text3)'}}>
                  {r.data_tentativa ? (
                    <>
                      <div>{fmtDateTime(r.data_tentativa)}</div>
                      {r.marcado_por && <div>{r.marcado_por.startsWith('motorista') ? '👤' : '🖥️'} {r.marcado_por}</div>}
                    </>
                  ) : '—'}
                </td>
                <td style={{whiteSpace:'nowrap'}}>
                  {r.status === 'pendente' && (
                    <>
                      <button className="btn btn-ghost btn-sm" onClick={()=>marcarStatus(r,'entregue')} title="Marcar como entregue" style={{color:'#059669'}}>✅</button>
                      <button className="btn btn-ghost btn-sm" onClick={()=>marcarStatus(r,'nao_entregue')} title="Marcar como não entregue" style={{color:'#DC2626'}}>❌</button>
                      <button className="btn btn-ghost btn-sm" onClick={()=>marcarStatus(r,'reentrega')} title="Marcar para reentrega" style={{color:'#D97706'}}>🔁</button>
                      <button className="btn btn-ghost btn-sm" onClick={()=>marcarStatus(r,'cancelada')} title="Cancelar entrega" style={{color:'#4B5563'}}>❎</button>
                    </>
                  )}
                  {r.status === 'reentrega' && (
                    <button className="btn btn-ghost btn-sm" onClick={()=>setReagendando(r)} style={{color:'#D97706', fontSize:12}}>🔁 Reagendar</button>
                  )}
                  {(r.status === 'entregue' || r.status === 'nao_entregue' || r.status === 'cancelada') && (
                    <button className="btn btn-ghost btn-sm" onClick={()=>marcarStatus(r,'pendente')} title="Voltar para pendente" style={{fontSize:11, color:'var(--text3)'}}>↺</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table></div></div>
      </div>

      {marcando && (
        <ModalMarcarStatus
          parada={marcando.parada}
          novoStatus={marcando.novoStatus}
          onClose={()=>setMarcando(null)}
          onConfirm={confirmarMarcacao}
        />
      )}

      {reagendando && (
        <ModalReagendar
          parada={reagendando}
          ots={ots||[]}
          onClose={()=>setReagendando(null)}
          onConfirm={confirmarReagendamento}
        />
      )}

      {toast && <Toast {...toast} />}
    </div>
  );
}

// ────────────────────────────────────────────────────────────
function ModalMarcarStatus({ parada, novoStatus, onClose, onConfirm }) {
  const [motivo, setMotivo] = useState('');
  const [observacao, setObservacao] = useState('');
  const [saving, setSaving] = useState(false);
  const precisaMotivo = novoStatus === 'nao_entregue';
  const info = STATUS_INFO[novoStatus] || {};

  const confirmar = async () => {
    if (precisaMotivo && !motivo) return alert('Informe o motivo');
    setSaving(true);
    try { await onConfirm({ motivo, observacao }); }
    finally { setSaving(false); }
  };

  return (
    <Modal title={`Marcar como ${info.label}`} onClose={onClose} width={480}>
      <div style={{background:info.bg, padding:'10px 12px', borderRadius:8, marginBottom:14, fontSize:13}}>
        <div className="fw-600">{parada.cliente_nome || `NF ${parada.nf}`}</div>
        {parada.endereco && <div style={{fontSize:11, color:'var(--text3)'}}>{parada.endereco}</div>}
        <div style={{fontSize:11, color:'var(--text3)', marginTop:4}}>Rota {parada.numero_rota} • {parada.motorista_nome}</div>
      </div>

      {precisaMotivo && (
        <Field label="Motivo *">
          <Select value={motivo} onChange={e=>setMotivo(e.target.value)}
            options={[{value:'',label:'— Selecione —'}, ...MOTIVOS_NAO_ENTREGA.map(m=>({value:m, label:m}))]}/>
        </Field>
      )}

      <Field label={precisaMotivo ? 'Observação (opcional)' : 'Observação'}>
        <Textarea value={observacao} onChange={e=>setObservacao(e.target.value)} rows={3} placeholder="Detalhes adicionais..." />
      </Field>

      <div style={{display:'flex', gap:8, justifyContent:'flex-end', marginTop:14}}>
        <button className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancelar</button>
        <button className="btn btn-primary" onClick={confirmar} disabled={saving}>
          {saving ? 'Salvando...' : `Confirmar ${info.label}`}
        </button>
      </div>
    </Modal>
  );
}

// ────────────────────────────────────────────────────────────
function ModalReagendar({ parada, ots, onClose, onConfirm }) {
  const [otId, setOtId] = useState('');
  const [saving, setSaving] = useState(false);

  // Filtra OTs disponíveis (data de hoje em diante)
  const hoje = new Date().toISOString().slice(0, 10);
  const otsDisponiveis = ots
    .filter(o => o.data && String(o.data).substring(0,10) >= hoje)
    .filter(o => o.id !== parada.ordem_id) // não a mesma OT
    .sort((a,b) => String(a.data).localeCompare(String(b.data)));

  const confirmar = async () => {
    setSaving(true);
    try { await onConfirm(otId); }
    finally { setSaving(false); }
  };

  return (
    <Modal title="Reagendar entrega para outra OT" onClose={onClose} width={520}>
      <div style={{background:'rgba(217,119,6,.10)', padding:'10px 12px', borderRadius:8, marginBottom:14, fontSize:13}}>
        <div className="fw-600">🔁 {parada.cliente_nome || `NF ${parada.nf}`}</div>
        {parada.endereco && <div style={{fontSize:11, color:'var(--text3)'}}>{parada.endereco}</div>}
        <div style={{fontSize:11, color:'var(--text3)', marginTop:4}}>
          Tentativa #{parada.tentativa_numero || 1} → será #{(parada.tentativa_numero || 1) + 1}
        </div>
      </div>

      <Field label="Reagendar para qual OT? *">
        <Select value={otId} onChange={e=>setOtId(e.target.value)}
          options={[{value:'',label:'— Selecione —'},
            ...otsDisponiveis.map(o=>({value:o.id, label:`Rota ${o.numero_rota} • ${fmtDate(o.data)} • ${o.motorista_nome||'sem motorista'}`}))
          ]}/>
      </Field>

      <div style={{fontSize:12, color:'var(--text3)', marginTop:8}}>
        💡 A entrega original ficará marcada como "reentrega" e uma nova será criada na OT escolhida, com o contador de tentativas atualizado.
      </div>

      <div style={{display:'flex', gap:8, justifyContent:'flex-end', marginTop:14}}>
        <button className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancelar</button>
        <button className="btn btn-primary" onClick={confirmar} disabled={saving || !otId}>
          {saving ? 'Reagendando...' : 'Confirmar reagendamento'}
        </button>
      </div>
    </Modal>
  );
}
