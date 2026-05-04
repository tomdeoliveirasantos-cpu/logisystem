import { useState } from 'react';
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
  frete_terceiro:   { label: 'Frete Terceiro', badge: 'badge-blue' },
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
        <div><div className="page-title">Contas a Pagar</div><div className="page-desc">Fretes de terceiros e diárias da frota própria</div></div>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          <select className="form-select" style={{width:190}} value={filtroTipo} onChange={e=>setFiltroTipo(e.target.value)}>
            <option value="">Todos os tipos</option>
            <option value="frete_terceiro">Frete Terceiro</option>
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
                  options={['HR','IVECO','3/4','TOCO','TRUCK','MASTER','SPRINTER'].map(v=>({value:v,label:v}))}/>
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
  const { data: transportadoras } = useFetch('/transportadoras');
  const { data: veiculos } = useFetch('/veiculos');
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm]   = useState({});
  const [cnhFile, setCnhFile] = useState(null);
  const { toast, showToast } = useToast();
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));

  const open = (row=null) => {
    setEditing(row);
    setForm(row ? {
      nome:row.nome, cnh:row.cnh, telefone:row.telefone,
      tipo_colaborador:row.tipo_colaborador || 'pendente',
      transportadora_id:row.transportadora_id, veiculo_padrao_id:row.veiculo_padrao_id,
      cnh_validade:row.cnh_validade?.substring(0,10) || '',
      cnh_categoria:row.cnh_categoria || '',
      endereco_cep:row.endereco_cep, endereco_logradouro:row.endereco_logradouro,
      endereco_numero:row.endereco_numero, endereco_complemento:row.endereco_complemento,
      endereco_bairro:row.endereco_bairro, endereco_cidade:row.endereco_cidade, endereco_estado:row.endereco_estado,
      contato_esposa:row.contato_esposa, contato_pai:row.contato_pai, contato_mae:row.contato_mae,
      contato_outro_nome:row.contato_outro_nome, contato_outro_telefone:row.contato_outro_telefone,
      status_cadastro:row.status_cadastro,
    } : {});
    setCnhFile(null);
    setModal(true);
  };
  const close = () => { setModal(false); setEditing(null); setForm({}); setCnhFile(null); };

  const save = async () => {
    try {
      const fd = new FormData();
      for (const [k,v] of Object.entries(form)) {
        if (v != null && v !== '') fd.append(k, v);
      }
      if (cnhFile) fd.append('cnh_arquivo', cnhFile);
      if (!form.status_cadastro) fd.append('status_cadastro', 'completo');

      const token = localStorage.getItem('logi_token');
      const url = editing
        ? `https://api.wsdevsoft.com/api/motoristas/${editing.id}`
        : 'https://api.wsdevsoft.com/api/motoristas';
      const method = editing ? 'PUT' : 'POST';
      const res = await fetch(url, { method, body: fd, headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('Erro ao salvar');
      showToast(editing ? 'Motorista atualizado!' : 'Motorista cadastrado!');
      refetch(); close();
    } catch(e) { showToast(e.message,'error'); }
  };

  const rows=data||[];
  return (
    <div>
      <div className="page-header"><div><div className="page-title">Colaboradores</div><div className="page-desc">Motoristas, ajudantes e administrativos</div></div><div style={{display:'flex',gap:8,alignItems:'center'}}><ExportBtn rows={rows} filename="colaboradores" columns={[
            {key:'nome',label:'Nome'},{key:'tipo_colaborador',label:'Tipo'},{key:'cnh',label:'CNH'},{key:'cnh_categoria',label:'Cat.'},
            {key:'cnh_validade',label:'Validade CNH'},{key:'telefone',label:'Telefone'},
            {key:'veiculo_padrao_placa',label:'Veículo Padrão'},{key:'transportadora_nome',label:'Transportadora'},
          ]} /><button className="btn btn-primary" onClick={()=>open()}>+ Cadastrar Colaborador</button></div></div>
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
                <Field label="Tipo de Colaborador *">
                  <Select value={form.tipo_colaborador||''} onChange={e=>set('tipo_colaborador',e.target.value)}
                    options={[
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
              <Field label="CNH"><Input value={form.cnh||''} onChange={e=>set('cnh',e.target.value)}/></Field>
              <Field label="Categoria CNH">
                <Select value={form.cnh_categoria||''} onChange={e=>set('cnh_categoria',e.target.value)}
                  options={[{value:'',label:'—'},...['A','B','C','D','E','AB','AC','AD','AE'].map(v=>({value:v,label:v}))]}/>
              </Field>
              <Field label="Validade CNH">
                <Input type="date" value={form.cnh_validade||''} onChange={e=>set('cnh_validade',e.target.value)}/>
              </Field>
              <Field label="Telefone"><Input value={form.telefone||''} onChange={e=>set('telefone',e.target.value)}/></Field>
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
              <Field label="CEP"><Input value={form.endereco_cep||''} onChange={e=>set('endereco_cep',e.target.value)}/></Field>
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
                <Field label="Transportadora">
                  <Select value={form.transportadora_id||''} onChange={e=>set('transportadora_id',e.target.value)}
                    options={[{value:'',label:'— Nenhuma —'},...(transportadoras||[]).map(t=>({value:t.id,label:t.nome}))]}/>
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
