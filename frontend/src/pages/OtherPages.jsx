import { useState } from 'react';
import { useFetch } from '../hooks/useFetch';
import { api } from '../lib/api';
import { StatusBadge, Modal, Field, Input, Select, Textarea, useToast, Toast, ExportBtn } from '../components/UI';

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
  const rows = data||[];
  const marcarRecebido = async (id) => { try { await api.patch(`/financeiro/receber/${id}/receber`,{}); showToast('Marcado como recebido!'); refetch(); } catch(e) { showToast(e.message,'error'); } };
  const total=rows.reduce((s,r)=>s+ +r.valor,0), emAberto=rows.filter(r=>r.status==='pendente').reduce((s,r)=>s+ +r.valor,0), recebido=rows.filter(r=>r.status==='recebido').reduce((s,r)=>s+ +r.valor,0);
  const cols=[{k:'cliente',l:'Cliente'},{k:'regiao',l:'Região'},{k:'valor',l:'Valor (R$)',f:v=>v?Number(v).toFixed(2):''},{k:'vencimento',l:'Vencimento',f:v=>fmtDate(v)},{k:'data_pagamento',l:'Dt. Pgto',f:v=>fmtDate(v)},{k:'status',l:'Status'},{k:'obs',l:'Obs'}];
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
          <thead><tr><th>Cliente</th><th>Região</th><th>Valor</th><th>Vencimento</th><th>Pgto.</th><th>Status</th><th>Ação</th></tr></thead>
          <tbody>
            {loading && Array.from({length:4}).map((_,i)=>(<tr key={i}>{Array.from({length:7}).map((_,j)=>(<td key={j}><div style={{height:12,background:'var(--bg3)',borderRadius:4,width:'60%'}}/></td>))}</tr>))}
            {!loading&&!rows.length&&<tr><td colSpan={7} style={{textAlign:'center',color:'var(--text3)',padding:'32px 0'}}>Nenhum lançamento encontrado</td></tr>}
            {rows.map(r=>(<tr key={r.id}><td className="fw-500">{r.cliente}</td><td style={{fontSize:12}}>{r.regiao||'—'}</td><td className="fw-600">{fmt(r.valor)}</td><td style={{fontSize:12}}>{fmtDate(r.vencimento)}</td><td style={{fontSize:12}}>{fmtDate(r.data_pagamento)}</td><td><StatusBadge status={r.status}/></td><td>{r.status==='pendente'&&<button className="btn btn-ghost btn-sm" onClick={()=>marcarRecebido(r.id)}>Receber</button>}</td></tr>))}
          </tbody>
        </table></div></div>
      </div>
      {toast&&<Toast {...toast}/>}
    </div>
  );
}

const TIPO_LANCAMENTO_LABEL = {
  frete_agregado:   { label: 'Frete Agregado', badge: 'badge-blue' },
  diaria_motorista: { label: 'Diária Motorista', badge: 'badge-teal' },
  diaria_ajudante:  { label: 'Diária Ajudante', badge: 'badge-amber' },
};

export function ContasPagar() {
  const [filtroTipo, setFiltroTipo] = useState('');
  const { data, loading, refetch } = useFetch('/financeiro/pagar');
  const { toast, showToast } = useToast();
  const rows = (data||[]).filter(r => !filtroTipo || r.tipo_lancamento === filtroTipo);
  const marcarPago = async (id) => { try { await api.patch(`/financeiro/pagar/${id}/pagar`,{}); showToast('Marcado como pago!'); refetch(); } catch(e) { showToast(e.message,'error'); } };
  const total=rows.reduce((s,r)=>s+ +r.valor,0), emAberto=rows.filter(r=>r.status==='pendente').reduce((s,r)=>s+ +r.valor,0), pago=rows.filter(r=>r.status==='pago').reduce((s,r)=>s+ +r.valor,0);
  const cols=[
    {k:'tipo_lancamento',l:'Tipo',f:v=>TIPO_LANCAMENTO_LABEL[v]?.label||v||''},
    {k:'descricao',l:'Descrição'},
    {k:'transportadora_nome',l:'Transportadora'},
    {k:'motorista_nome',l:'Motorista'},
    {k:'valor',l:'Valor (R$)',f:v=>v?Number(v).toFixed(2):''},
    {k:'vencimento',l:'Vencimento',f:v=>fmtDate(v)},
    {k:'status',l:'Status'},
  ];
  return (
    <div>
      <div className="page-header">
        <div><div className="page-title">Contas a Pagar</div><div className="page-desc">Fretes agregados e diárias da frota própria</div></div>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          <select className="form-select" style={{width:190}} value={filtroTipo} onChange={e=>setFiltroTipo(e.target.value)}>
            <option value="">Todos os tipos</option>
            <option value="frete_agregado">Frete Agregado</option>
            <option value="diaria_motorista">Diária Motorista</option>
            <option value="diaria_ajudante">Diária Ajudante</option>
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
          <thead><tr><th>Tipo</th><th>Descrição</th><th>Benef. / Motorista</th><th>Valor</th><th>Vencimento</th><th>Status</th><th>Ação</th></tr></thead>
          <tbody>
            {loading && Array.from({length:4}).map((_,i)=>(<tr key={i}>{Array.from({length:7}).map((_,j)=>(<td key={j}><div style={{height:12,background:'var(--bg3)',borderRadius:4,width:'60%'}}/></td>))}</tr>))}
            {!loading&&!rows.length&&<tr><td colSpan={7} style={{textAlign:'center',color:'var(--text3)',padding:'32px 0'}}>Nenhum lançamento encontrado</td></tr>}
            {rows.map(r=>{
              const tipoInfo = TIPO_LANCAMENTO_LABEL[r.tipo_lancamento] || {label: r.tipo_lancamento||'—', badge:'badge-gray'};
              return (
                <tr key={r.id}>
                  <td><span className={`badge ${tipoInfo.badge}`}>{tipoInfo.label}</span></td>
                  <td style={{fontSize:12,color:'var(--text2)',maxWidth:200}}>
                    <div className="truncate">{r.descricao || '—'}</div>
                    {r.regiao && <div style={{fontSize:11,color:'var(--text3)'}}>{r.regiao}</div>}
                  </td>
                  <td>
                    {r.transportadora_nome && <div className="fw-500">{r.transportadora_nome}</div>}
                    {r.motorista_nome && <div style={{fontSize:11,color:'var(--text3)'}}>{r.motorista_nome}</div>}
                    {!r.transportadora_nome && !r.motorista_nome && <span style={{color:'var(--text3)'}}>—</span>}
                  </td>
                  <td className="fw-600">{fmt(r.valor)}</td>
                  <td style={{fontSize:12}}>{fmtDate(r.vencimento)}</td>
                  <td><StatusBadge status={r.status}/></td>
                  <td>{r.status==='pendente'&&<button className="btn btn-ghost btn-sm" onClick={()=>marcarPago(r.id)}>Pagar</button>}</td>
                </tr>
              );
            })}
          </tbody>
        </table></div></div>
      </div>
      {toast&&<Toast {...toast}/>}
    </div>
  );
}

export function Manutencoes() {
  const { data, loading, refetch } = useFetch('/manutencoes');
  const { data: veiculos } = useFetch('/veiculos');
  const [modal, setModal] = useState(false);
  const [form, setForm]   = useState({});
  const { toast, showToast } = useToast();
  const set = (k,v)=>setForm(f=>({...f,[k]:v}));
  const save = async () => { try { await api.post('/manutencoes',form); showToast('Manutenção registrada!'); refetch(); setModal(false); setForm({}); } catch(e){showToast(e.message,'error');} };
  const rows = data||[];
  const total = rows.reduce((s,r)=>s+ +(r.valor_orcamento||0),0);
  const cols=[{k:'data_manutencao',l:'Data',f:v=>fmtDate(v)},{k:'placa',l:'Placa'},{k:'modelo',l:'Modelo'},{k:'tipo_manutencao',l:'Tipo'},{k:'componente',l:'Componente'},{k:'descricao',l:'Descrição'},{k:'valor_orcamento',l:'Valor (R$)',f:v=>v?Number(v).toFixed(2):''},{k:'aprovado_por',l:'Aprovado por'}];
  return (
    <div>
      <div className="page-header"><div><div className="page-title">Controle de Manutenção</div><div className="page-desc">Preventiva e corretiva da frota</div></div>
        <div style={{display:'flex',gap:8}}>{xlsBtn('Manutencoes',rows,cols)}<button className="btn btn-primary" onClick={()=>setModal(true)}>+ Registrar</button></div>
      </div>
      <div className="page-body">
        <div className="metrics-grid cols-3 mb-16 fade-up">
          <div className="metric-card"><div className="metric-label">Total registros</div><div className="metric-value">{rows.length}</div></div>
          <div className="metric-card"><div className="metric-label">Preventivas</div><div className="metric-value" style={{color:'var(--accent)'}}>{rows.filter(r=>r.tipo_manutencao==='preventiva').length}</div></div>
          <div className="metric-card red"><div className="metric-label">Custo total</div><div className="metric-value">{fmt(total)}</div></div>
        </div>
        <div className="card fade-up fade-up-1"><div className="table-wrap"><table>
          <thead><tr><th>Data</th><th>Placa</th><th>Tipo</th><th>Componente</th><th>Descrição</th><th>Valor</th><th>Aprovado por</th></tr></thead>
          <tbody>
            {loading&&Array.from({length:4}).map((_,i)=>(<tr key={i}>{Array.from({length:7}).map((_,j)=>(<td key={j}><div style={{height:12,background:'var(--bg3)',borderRadius:4,width:'65%'}}/></td>))}</tr>))}
            {!loading&&!rows.length&&<tr><td colSpan={7} style={{textAlign:'center',color:'var(--text3)',padding:'32px 0'}}>Nenhuma manutenção registrada</td></tr>}
            {rows.map(r=>(<tr key={r.id}><td style={{fontSize:12}}>{fmtDate(r.data_manutencao)}</td><td className="font-mono fw-500">{r.placa}</td><td><StatusBadge status={r.tipo_manutencao}/></td><td style={{textTransform:'capitalize'}}>{r.componente}</td><td style={{fontSize:12,color:'var(--text2)'}}>{r.descricao||'—'}</td><td className="fw-500">{fmt(r.valor_orcamento)}</td><td style={{fontSize:12}}>{r.aprovado_por||'—'}</td></tr>))}
          </tbody>
        </table></div></div>
      </div>
      {modal&&(<div className="modal-backdrop" onClick={e=>e.target===e.currentTarget&&setModal(false)}><div className="modal" style={{maxWidth:560}}><div className="modal-header"><span className="modal-title">Registrar Manutenção</span><button className="modal-close" onClick={()=>setModal(false)}>×</button></div><div className="modal-body"><div className="form-grid cols-2"><Field label="Veículo *"><Select value={form.veiculo_id||''} onChange={e=>set('veiculo_id',e.target.value)} options={(veiculos||[]).map(v=>({value:v.id,label:`${v.placa} — ${v.tipo}`}))}/></Field><Field label="Data"><Input type="date" value={form.data_manutencao||new Date().toISOString().split('T')[0]} onChange={e=>set('data_manutencao',e.target.value)}/></Field><Field label="Tipo *"><Select value={form.tipo_manutencao||''} onChange={e=>set('tipo_manutencao',e.target.value)} options={[{value:'preventiva',label:'Preventiva'},{value:'corretiva',label:'Corretiva'}]}/></Field><Field label="Componente *"><Select value={form.componente||''} onChange={e=>set('componente',e.target.value)} options={['pneus','oleo','suspensao','freios','motor','eletrica','outros'].map(v=>({value:v,label:v.charAt(0).toUpperCase()+v.slice(1)}))}/></Field><Field label="Valor (R$)"><Input type="number" step="0.01" value={form.valor_orcamento||''} onChange={e=>set('valor_orcamento',e.target.value)}/></Field><Field label="Aprovado por"><Input value={form.aprovado_por||''} onChange={e=>set('aprovado_por',e.target.value)}/></Field><div style={{gridColumn:'span 2'}}><Field label="Descrição"><Textarea value={form.descricao||''} onChange={e=>set('descricao',e.target.value)}/></Field></div></div></div><div className="modal-footer"><button className="btn btn-ghost" onClick={()=>setModal(false)}>Cancelar</button><button className="btn btn-primary" onClick={save}>Salvar</button></div></div></div>)}
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
        <div style={{display:'flex',gap:8}}>{xlsBtn('Multas',rows,cols)}<button className="btn btn-primary" onClick={()=>setModal(true)}>+ Registrar Multa</button></div>
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
  const { toast, showToast } = useToast();
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));

  const open = (row=null) => {
    setEditing(row);
    setForm(row ? { placa:row.placa, tipo:row.tipo, modelo:row.modelo, ano:row.ano, renavam:row.renavam, ag_ft:row.ag_ft, transportadora_id:row.transportadora_id } : {});
    setModal(true);
  };
  const close = () => { setModal(false); setEditing(null); setForm({}); };

  const save = async () => {
    try {
      if (editing) await api.put(`/veiculos/${editing.id}`, form);
      else await api.post('/veiculos', form);
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
      <div className="page-header"><div><div className="page-title">Frota / Veículos</div><div className="page-desc">Caminhões próprios e agregados</div></div><button className="btn btn-primary" onClick={()=>open()}>+ Cadastrar Veículo</button></div>
      <div className="page-body"><div className="card fade-up"><div className="table-wrap"><table>
        <thead><tr><th>Placa</th><th>Tipo</th><th>Modelo</th><th>Ano</th><th>RENAVAM</th><th>Transportadora</th><th>Ag/Ft</th><th></th></tr></thead>
        <tbody>
          {loading&&Array.from({length:5}).map((_,i)=>(<tr key={i}>{Array.from({length:8}).map((_,j)=>(<td key={j}><div style={{height:12,background:'var(--bg3)',borderRadius:4,width:'65%'}}/></td>))}</tr>))}
          {rows.map(r=>(<tr key={r.id}>
            <td className="font-mono fw-500">{r.placa}</td>
            <td><span className="badge badge-teal">{r.tipo}</span></td>
            <td>{r.modelo||'—'}</td>
            <td style={{fontSize:12}}>{r.ano||'—'}</td>
            <td className="font-mono" style={{fontSize:11}}>{r.renavam||'—'}</td>
            <td style={{fontSize:12}}>{r.transportadora_nome||'—'}</td>
            <td><StatusBadge status={r.ag_ft}/></td>
            <td><div style={{display:'flex',gap:4}}>
              <button className="btn btn-ghost btn-sm" onClick={()=>open(r)}>Editar</button>
              <button className="btn btn-danger btn-sm" onClick={()=>desativar(r.id)}>✕</button>
            </div></td>
          </tr>))}
        </tbody>
      </table></div></div></div>
      {modal&&(<div className="modal-backdrop" onClick={e=>e.target===e.currentTarget&&close()}><div className="modal" style={{maxWidth:520}}><div className="modal-header"><span className="modal-title">{editing?'Editar Veículo':'Cadastrar Veículo'}</span><button className="modal-close" onClick={close}>×</button></div><div className="modal-body"><div className="form-grid cols-2"><Field label="Placa *"><Input value={form.placa||''} onChange={e=>set('placa',e.target.value.toUpperCase())} placeholder="AAA0A00"/></Field><Field label="Tipo *"><Select value={form.tipo||''} onChange={e=>set('tipo',e.target.value)} options={['HR','IVECO','3/4','TOCO','TRUCK','MASTER'].map(v=>({value:v,label:v}))}/></Field><Field label="Modelo"><Input value={form.modelo||''} onChange={e=>set('modelo',e.target.value)} placeholder="ex: Daily 35S14"/></Field><Field label="Ano"><Input type="number" value={form.ano||''} onChange={e=>set('ano',e.target.value)} placeholder="2022"/></Field><Field label="RENAVAM"><Input value={form.renavam||''} onChange={e=>set('renavam',e.target.value)}/></Field><Field label="Ag / Frota *"><Select value={form.ag_ft||''} onChange={e=>set('ag_ft',e.target.value)} options={[{value:'frota',label:'Frota própria'},{value:'agregado',label:'Agregado'}]}/></Field><div style={{gridColumn:'span 2'}}><Field label="Transportadora"><Select value={form.transportadora_id||''} onChange={e=>set('transportadora_id',e.target.value)} options={(transportadoras||[]).map(t=>({value:t.id,label:t.nome}))}/></Field></div></div></div><div className="modal-footer"><button className="btn btn-ghost" onClick={close}>Cancelar</button><button className="btn btn-primary" onClick={save}>{editing?'Salvar':'Cadastrar'}</button></div></div></div>)}
      {toast&&<Toast {...toast}/>}
    </div>
  );
}

export function Motoristas() {
  const { data, loading, refetch } = useFetch('/motoristas');
  const { data: transportadoras } = useFetch('/transportadoras');
  const { data: veiculos } = useFetch('/veiculos');
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm]   = useState({});
  const { toast, showToast } = useToast();
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));

  const open = (row=null) => {
    setEditing(row);
    setForm(row ? { nome:row.nome, cnh:row.cnh, telefone:row.telefone, transportadora_id:row.transportadora_id, veiculo_padrao_id:row.veiculo_padrao_id } : {});
    setModal(true);
  };
  const close = () => { setModal(false); setEditing(null); setForm({}); };

  const save = async () => {
    try {
      if (editing) await api.put(`/motoristas/${editing.id}`, form);
      else await api.post('/motoristas', form);
      showToast(editing ? 'Motorista atualizado!' : 'Motorista cadastrado!');
      refetch(); close();
    } catch(e) { showToast(e.message,'error'); }
  };

  const rows=data||[];
  return (
    <div>
      <div className="page-header"><div><div className="page-title">Motoristas</div><div className="page-desc">Motoristas próprios e agregados</div></div><button className="btn btn-primary" onClick={()=>open()}>+ Cadastrar Motorista</button></div>
      <div className="page-body"><div className="card fade-up"><div className="table-wrap"><table>
        <thead><tr><th>Nome</th><th>CNH</th><th>Telefone</th><th>Veículo Padrão</th><th>Transportadora</th><th></th></tr></thead>
        <tbody>
          {loading&&Array.from({length:5}).map((_,i)=>(<tr key={i}>{Array.from({length:6}).map((_,j)=>(<td key={j}><div style={{height:12,background:'var(--bg3)',borderRadius:4,width:'65%'}}/></td>))}</tr>))}
          {rows.map(r=>(<tr key={r.id}>
            <td className="fw-500">{r.nome}</td>
            <td className="font-mono" style={{fontSize:12}}>{r.cnh||'—'}</td>
            <td style={{fontSize:12}}>{r.telefone||'—'}</td>
            <td style={{fontSize:12}}>
              {r.veiculo_padrao_placa
                ? <span><span className="badge badge-teal">{r.veiculo_padrao_tipo}</span> <span style={{marginLeft:4}}>{r.veiculo_padrao_placa}</span></span>
                : <span style={{color:'var(--text3)'}}>—</span>}
            </td>
            <td style={{fontSize:12}}>{r.transportadora_nome||'—'}</td>
            <td><button className="btn btn-ghost btn-sm" onClick={()=>open(r)}>Editar</button></td>
          </tr>))}
        </tbody>
      </table></div></div></div>
      {modal&&(<div className="modal-backdrop" onClick={e=>e.target===e.currentTarget&&close()}><div className="modal" style={{maxWidth:480}}><div className="modal-header"><span className="modal-title">{editing?'Editar Motorista':'Cadastrar Motorista'}</span><button className="modal-close" onClick={close}>×</button></div><div className="modal-body"><div className="form-grid cols-2">
        <div style={{gridColumn:'span 2'}}><Field label="Nome completo *"><Input value={form.nome||''} onChange={e=>set('nome',e.target.value)}/></Field></div>
        <Field label="CNH"><Input value={form.cnh||''} onChange={e=>set('cnh',e.target.value)}/></Field>
        <Field label="Telefone"><Input value={form.telefone||''} onChange={e=>set('telefone',e.target.value)}/></Field>
        <div style={{gridColumn:'span 2'}}><Field label="Veículo Padrão"><Select value={form.veiculo_padrao_id||''} onChange={e=>set('veiculo_padrao_id',e.target.value)} options={(veiculos||[]).map(v=>({value:v.id,label:`${v.placa} — ${v.tipo}`}))}/></Field></div>
        <div style={{gridColumn:'span 2'}}><Field label="Transportadora"><Select value={form.transportadora_id||''} onChange={e=>set('transportadora_id',e.target.value)} options={(transportadoras||[]).map(t=>({value:t.id,label:t.nome}))}/></Field></div>
      </div></div><div className="modal-footer"><button className="btn btn-ghost" onClick={close}>Cancelar</button><button className="btn btn-primary" onClick={save}>{editing?'Salvar':'Cadastrar'}</button></div></div></div>)}
      {toast&&<Toast {...toast}/>}
    </div>
  );
}
