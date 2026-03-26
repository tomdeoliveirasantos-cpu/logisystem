/* global URLSearchParams */
import { useState, useRef, useEffect, useMemo } from 'react';
import { useFetch } from '../hooks/useFetch';
import { useParametros } from '../hooks/useParametros';
import { api } from '../lib/api';
import { StatusBadge, Field, Input, Select, useToast, Toast } from '../components/UI';

const STATUS_OPTS = [
  {value:'pendente',label:'Pendente'},
  {value:'entregue',label:'Entregue'},
  {value:'devolucao',label:'Devolução'},
  {value:'cancelado',label:'Cancelado'},
];

const fmt = v => v !== null && v !== undefined ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v) : '—';

function fmtDate(d) {
  if (!d) return '—';
  const s = typeof d === 'string' ? d.substring(0,10) : d;
  const [y,m,day] = s.split('-');
  return `${day}/${m}/${y}`;
}

function exportXLS(rows) {
  if (!rows.length) return alert('Nenhum dado para exportar');
  const cols = [
    {k:'data',l:'Data',f:v=>fmtDate(v)},
    {k:'numero_rota',l:'Rota'},{k:'seq',l:'Seq.'},
    {k:'cliente_nome',l:'Cliente'},{k:'motorista_nome',l:'Motorista'},
    {k:'veiculo_tipo',l:'Veículo'},{k:'placa',l:'Placa'},
    {k:'regiao',l:'Região'},{k:'peso',l:'Peso (kg)'},
    {k:'nf',l:'NF'},{k:'remessa',l:'Remessa'},
    {k:'status',l:'Status'},{k:'tipo',l:'Tipo'},
    {k:'ajuda_diesel',l:'Ajuda Diesel',f:v=>v?Number(v).toFixed(2):''},
    {k:'taxa_descarga',l:'Taxa Descarga',f:v=>v?Number(v).toFixed(2):''},
    {k:'obs',l:'Observações'},
  ];
  const data=[cols.map(c=>c.l),...rows.map(r=>cols.map(c=>c.f?c.f(r[c.k],r):(r[c.k]||'')))];
  const ws=window.XLSX.utils.aoa_to_sheet(data);
  ws['!cols']=cols.map(()=>({wch:18}));
  const wb=window.XLSX.utils.book_new();
  window.XLSX.utils.book_append_sheet(wb,ws,'Ordens');
  window.XLSX.writeFile(wb,`ordens_${new Date().toLocaleDateString('pt-BR').replace(/\//g,'-')}.xlsx`);
}

function AnexoCell({ ordem }) {
  if (ordem.anexo_path) {
    const url = `https://api.wsdevsoft.com/uploads/${ordem.anexo_path}`;
    return (
      <a href={url} target="_blank" rel="noreferrer"
        style={{display:'flex',alignItems:'center',gap:4,fontSize:11,color:'var(--accent)',textDecoration:'none'}}>
        📎 {ordem.anexo_nome?.length>18?ordem.anexo_nome.slice(0,15)+'...':ordem.anexo_nome}
      </a>
    );
  }
  return <span style={{fontSize:11,color:'var(--text3)'}}>—</span>;
}

function UploadZone({ file, onFile }) {
  const ref = useRef();
  return (
    <div className={`upload-zone ${file?'has-file':''}`} onClick={()=>ref.current.click()}
      onDrop={e=>{e.preventDefault();onFile(e.dataTransfer.files[0]);}} onDragOver={e=>e.preventDefault()}>
      <input ref={ref} type="file" style={{display:'none'}} accept=".pdf,.jpg,.jpeg,.png,.xml" onChange={e=>onFile(e.target.files[0])} />
      <div className="upload-icon">
        <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
        </svg>
      </div>
      {file ? <div className="upload-text" style={{color:'var(--green)',fontWeight:500}}>{file.name}</div>
             : <><div className="upload-text">Clique ou arraste o arquivo aqui</div><div className="upload-hint">PDF, imagem ou XML — máx. 10 MB</div></>}
    </div>
  );
}

// Label com badge obrigatório
function FL({ label, obrig, children }) {
  return (
    <Field label={
      <span>{label} {obrig && <span style={{color:'var(--red)',fontSize:10,fontWeight:700,marginLeft:4}}>*</span>}</span>
    }>{children}</Field>
  );
}

// ════ Card de resumo do frete (exibido no modal) ═════════════════════════════
function FreteResumo({ veiculo, regiao, freteData, loading }) {
  if (!veiculo) return null;

  return (
    <div style={{
      padding: '14px 16px', background: 'var(--bg2)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius)', marginBottom: 14,
    }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 10 }}>
        💰 Valores de Frete (automático)
      </div>
      {loading ? (
        <div style={{ fontSize: 12, color: 'var(--text3)' }}>Buscando valores...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div style={{ padding: '10px 12px', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 'var(--radius)' }}>
            <div style={{ fontSize: 10, color: '#16A34A', fontWeight: 600, marginBottom: 4 }}>RECEBER (Léo Madeiras)</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#16A34A' }}>
              {freteData?.receber ? fmt(freteData.receber.valor) : '—'}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>
              Fixo por veículo: {veiculo.tipo}
            </div>
          </div>
          <div style={{ padding: '10px 12px', background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: 'var(--radius)' }}>
            <div style={{ fontSize: 10, color: '#B45309', fontWeight: 600, marginBottom: 4 }}>PAGAR (Agregado)</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#B45309' }}>
              {freteData?.pagar ? fmt(freteData.pagar.valor_base) : '—'}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>
              {regiao ? `Região: ${regiao}` : 'Preencha a região'}
              {veiculo.ag_ft === 'frota' && ' (frota própria — sem frete agregado)'}
            </div>
          </div>
        </div>
      )}
      {!regiao && veiculo.ag_ft === 'agregado' && (
        <div style={{ marginTop: 8, fontSize: 11, color: 'var(--amber)', fontStyle: 'italic' }}>
          Preencha a região para calcular o frete a pagar automaticamente.
        </div>
      )}
    </div>
  );
}

export default function Ordens() {
  const today = new Date().toISOString().split('T')[0];
  const [filtInicio, setFiltInicio] = useState('');
  const [filtFim, setFiltFim]       = useState('');
  const [filtStatus, setFiltStatus] = useState('pendente');
  const [modal, setModal] = useState(false);
  const [form, setForm]   = useState({ data: today });
  const [anexo, setAnexo] = useState(null);
  const [formError, setFormError] = useState('');
  const [freteData, setFreteData] = useState(null);
  const [freteLoading, setFreteLoading] = useState(false);
  const { toast, showToast } = useToast();
  const { visivel, obrigatorio } = useParametros();

  const qs = new URLSearchParams();
  if (filtInicio) qs.set('data_inicio', filtInicio);
  if (filtFim)    qs.set('data_fim', filtFim);
  if (filtStatus) qs.set('status', filtStatus);

  const { data, loading, refetch }   = useFetch(`/ordens?${qs}`, [filtInicio, filtFim, filtStatus]);
  const { data: clientes }           = useFetch('/clientes');
  const { data: motoristas }         = useFetch('/motoristas');
  const { data: veiculos }           = useFetch('/veiculos');
  const { data: regioes }            = useFetch('/financeiro/fretes/regioes');

  // Veículo selecionado
  const veiculoSelecionado = useMemo(
    () => (veiculos||[]).find(v => String(v.id) === String(form.veiculo_id)),
    [veiculos, form.veiculo_id]
  );

  // Buscar frete automaticamente quando veículo ou região mudam
  useEffect(() => {
    if (!veiculoSelecionado) { setFreteData(null); return; }

    const tipoVeiculo = veiculoSelecionado.tipo;
    const regiao = (form.regiao || '').trim();

    if (!tipoVeiculo) return;

    setFreteLoading(true);
    const params = new URLSearchParams({ tipo_veiculo: tipoVeiculo });
    if (regiao) params.set('regiao', regiao);

    api.get(`/financeiro/fretes/buscar?${params}`)
      .then(data => setFreteData(data))
      .catch(() => setFreteData(null))
      .finally(() => setFreteLoading(false));
  }, [veiculoSelecionado, form.regiao]);

  const set = (k, v) => setForm(f => ({...f, [k]: v}));
  const onClienteChange = (id) => {
    set('cliente_id',id);
    const cli=(clientes||[]).find(c=>String(c.id)===String(id));
    if(cli) set('cliente_nome',cli.nome);
  };

  const validate = () => {
    const erros = [];
    if (!form.data) erros.push('Data');
    if (!form.cliente_id) erros.push('Cliente');
    if (!form.motorista_id) erros.push('Motorista');
    if (!form.veiculo_id) erros.push('Veículo');
    if (visivel('numero_rota') && obrigatorio('numero_rota') && !form.numero_rota) erros.push('Número da Rota');
    if (visivel('seq') && obrigatorio('seq') && !form.seq) erros.push('Sequência');
    if (visivel('nf') && obrigatorio('nf') && !form.nf) erros.push('NF');
    if (visivel('peso') && obrigatorio('peso') && !form.peso) erros.push('Peso');
    if (visivel('remessa') && obrigatorio('remessa') && !form.remessa) erros.push('Remessa');
    if (visivel('ajuda_diesel') && obrigatorio('ajuda_diesel') && !form.ajuda_diesel) erros.push('Ajuda Diesel');
    if (visivel('taxa_descarga') && obrigatorio('taxa_descarga') && !form.taxa_descarga) erros.push('Taxa Descarga');
    if (visivel('obs') && obrigatorio('obs') && !form.obs) erros.push('Observações');
    if (visivel('anexo') && obrigatorio('anexo') && !anexo) erros.push('Anexo');
    return erros;
  };

  const save = async () => {
    const erros = validate();
    if (erros.length) { setFormError(`Campos obrigatórios não preenchidos: ${erros.join(', ')}`); return; }
    setFormError('');
    try {
      const fd = new FormData();
      fd.append('data', form.data);
      if(visivel('numero_rota')) fd.append('numero_rota', form.numero_rota||'');
      if(visivel('seq')) fd.append('seq', form.seq||1);
      if(form.cliente_id) fd.append('cliente_id',form.cliente_id);
      if(form.cliente_nome) fd.append('cliente_nome',form.cliente_nome);
      if(form.motorista_id) fd.append('motorista_id',form.motorista_id);
      if(form.veiculo_id) fd.append('veiculo_id',form.veiculo_id);
      if(form.ajudante_nome) fd.append('ajudante_nome',form.ajudante_nome);
      if(form.regiao) fd.append('regiao',form.regiao);
      if(form.tipo) fd.append('tipo',form.tipo);
      if(form.pedido) fd.append('pedido',form.pedido);
      if(visivel('nf') && form.nf) fd.append('nf',form.nf);
      if(visivel('peso') && form.peso) fd.append('peso',form.peso);
      if(visivel('remessa') && form.remessa) fd.append('remessa',form.remessa);
      if(visivel('obs') && form.obs) fd.append('obs',form.obs);
      fd.append('ajuda_diesel', visivel('ajuda_diesel') ? (form.ajuda_diesel||0) : 0);
      fd.append('taxa_descarga', visivel('taxa_descarga') ? (form.taxa_descarga||0) : 0);
      fd.append('status', form.status||'pendente');
      if(visivel('anexo') && anexo) fd.append('anexo',anexo);

      // Passa o ID da tarifa agregado se encontrou
      if (freteData?.pagar?.id) fd.append('tabela_frete_id', freteData.pagar.id);

      const token = localStorage.getItem('logi_token');
      const res = await fetch('https://api.wsdevsoft.com/api/ordens',{method:'POST',body:fd,headers:{Authorization:`Bearer ${token}`}});
      if(!res.ok) throw new Error('Erro ao salvar');
      showToast('Ordem criada com sucesso!'); refetch(); setModal(false); setForm({ data: today }); setAnexo(null); setFreteData(null);
    } catch(e) { showToast(e.message,'error'); }
  };

  const updateStatus = async (id,status) => {
    try { await api.patch(`/ordens/${id}/status`,{status}); showToast('Status atualizado!'); refetch(); }
    catch(e) { showToast(e.message,'error'); }
  };

  const openModal = () => {
    setForm({ data: today });
    setAnexo(null);
    setFormError('');
    setFreteData(null);
    setModal(true);
  };

  const closeModal = () => {
    setModal(false);
    setForm({ data: today });
    setAnexo(null);
    setFreteData(null);
  };

  const rows = data||[];

  return (
    <div>
      <div className="page-header">
        <div style={{flex:1}}>
          <div className="page-title">Ordens de Transporte</div>
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
          <div className="search-bar">
            <svg width="14" height="14" fill="none" stroke="var(--text3)" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
            <input placeholder="Buscar..." />
          </div>
          <div style={{display:'flex',alignItems:'center',gap:4}}>
            <input type="date" className="form-input" style={{width:140}} value={filtInicio} onChange={e=>setFiltInicio(e.target.value)} />
            <span style={{color:'var(--text3)',fontSize:12}}>até</span>
            <input type="date" className="form-input" style={{width:140}} value={filtFim} onChange={e=>setFiltFim(e.target.value)} />
          </div>
          <select className="form-select" style={{width:140}} value={filtStatus} onChange={e=>setFiltStatus(e.target.value)}>
            <option value="">Todos status</option>
            {STATUS_OPTS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          {(filtInicio||filtFim||filtStatus!=='pendente') && (
            <button className="btn btn-ghost btn-sm" onClick={()=>{setFiltInicio('');setFiltFim('');setFiltStatus('pendente');}}>✕</button>
          )}
          <button className="btn btn-ghost" onClick={()=>exportXLS(rows)}>⬇ Excel</button>
          <button className="btn btn-primary" onClick={openModal}>+ Nova Ordem</button>
        </div>
      </div>

      <div className="page-body">
        <div className="metrics-grid cols-4 mb-20 fade-up">
          {[
            {label:'Total',val:rows.length,cls:'',color:'var(--text)'},
            {label:'Entregues',val:rows.filter(r=>r.status==='entregue').length,cls:'green',color:'var(--green)'},
            {label:'Pendentes',val:rows.filter(r=>r.status==='pendente').length,cls:'amber',color:'var(--amber)'},
            {label:'Devoluções',val:rows.filter(r=>r.status==='devolucao').length,cls:'red',color:'var(--red)'},
          ].map(k=>(
            <div key={k.label} className={`metric-card ${k.cls}`}>
              <div className="metric-label">{k.label}</div>
              <div className="metric-value" style={{color:k.color}}>{k.val}</div>
            </div>
          ))}
        </div>

        <div className="card fade-up fade-up-1">
          {!filtInicio && !filtFim && (
            <div style={{padding:'8px 12px',background:'var(--accent-lt)',borderRadius:'var(--radius)',marginBottom:12,fontSize:12,color:'var(--accent)'}}>
              Mostrando ordens <strong>pendentes</strong>. Use os filtros de data para buscar por período.
            </div>
          )}
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  {visivel('numero_rota') && <th>Rota</th>}
                  <th>Cliente</th>
                  <th>Motorista</th>
                  <th>Veículo</th>
                  <th>Região</th>
                  {visivel('peso') && <th>Peso</th>}
                  {visivel('nf') && <th>NF</th>}
                  {visivel('anexo') && <th>Anexo</th>}
                  <th>Status</th>
                  <th>Ação</th>
                </tr>
              </thead>
              <tbody>
                {loading && Array.from({length:5}).map((_,i)=>(
                  <tr key={i}>{Array.from({length:8}).map((_,j)=>(
                    <td key={j}><div style={{height:12,background:'var(--bg3)',borderRadius:4,width:'65%'}}/></td>
                  ))}</tr>
                ))}
                {!loading && !rows.length && (
                  <tr><td colSpan={12} style={{textAlign:'center',color:'var(--text3)',padding:'40px 0',fontSize:13}}>
                    Nenhuma ordem encontrada para este filtro
                  </td></tr>
                )}
                {rows.map(r=>(
                  <tr key={r.id}>
                    <td className="font-mono" style={{fontSize:11}}>{fmtDate(r.data)}</td>
                    {visivel('numero_rota') && <td className="font-mono fw-600" style={{color:'var(--accent)'}}>{r.numero_rota}</td>}
                    <td>
                      <div className="fw-500 truncate" style={{maxWidth:150}}>{r.cliente_nome}</div>
                      {r.regiao&&<div style={{fontSize:11,color:'var(--text3)'}}>{r.regiao}</div>}
                    </td>
                    <td style={{fontSize:12}}>{r.motorista_nome||'—'}</td>
                    <td>
                      {r.veiculo_tipo&&<span className="badge badge-teal">{r.veiculo_tipo}</span>}
                      {r.placa&&<span style={{fontSize:10,color:'var(--text3)',marginLeft:4}}>{r.placa}</span>}
                    </td>
                    <td style={{fontSize:12}}>{r.regiao||'—'}</td>
                    {visivel('peso') && <td style={{fontSize:12}}>{r.peso?Number(r.peso).toLocaleString('pt-BR')+' kg':'—'}</td>}
                    {visivel('nf') && <td className="font-mono" style={{fontSize:11}}>{r.nf||'—'}</td>}
                    {visivel('anexo') && <td><AnexoCell ordem={r} /></td>}
                    <td><StatusBadge status={r.status} /></td>
                    <td>
                      <select className="form-select" style={{width:110,fontSize:11,padding:'4px 6px'}}
                        value={r.status} onChange={e=>updateStatus(r.id,e.target.value)}>
                        {STATUS_OPTS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal Nova Ordem */}
      {modal && (
        <div className="modal-backdrop" onClick={e=>e.target===e.currentTarget&&closeModal()}>
          <div className="modal" style={{maxWidth:700}}>
            <div className="modal-header">
              <span className="modal-title">Nova Ordem de Transporte</span>
              <button className="modal-close" onClick={closeModal}>×</button>
            </div>
            <div className="modal-body">
              {formError && (
                <div style={{padding:'10px 14px',background:'var(--red-bg)',border:'1px solid var(--red)',borderRadius:'var(--radius)',marginBottom:16,fontSize:13,color:'var(--red)'}}>
                  {formError}
                </div>
              )}

              {/* Linha 1: Data + campos configuráveis de identificação */}
              <div className="form-grid cols-3" style={{marginBottom:14}}>
                <Field label={<span>Data <span style={{color:'var(--red)',fontSize:10,fontWeight:700}}>*</span></span>}>
                  <Input type="date" value={form.data||today} onChange={e=>set('data',e.target.value)} />
                </Field>
                {visivel('numero_rota') && (
                  <FL label="Nº da Rota" obrig={obrigatorio('numero_rota')}>
                    <Input type="number" value={form.numero_rota||''} onChange={e=>set('numero_rota',e.target.value)} placeholder="ex: 4800" />
                  </FL>
                )}
                {visivel('seq') && (
                  <FL label="Seq." obrig={obrigatorio('seq')}>
                    <Input type="number" value={form.seq||1} onChange={e=>set('seq',e.target.value)} min={1} />
                  </FL>
                )}
              </div>

              {/* Linha 2: Cliente */}
              <div className="form-grid cols-2" style={{marginBottom:14}}>
                <div style={{gridColumn:'span 2'}}>
                  <Field label={<span>Cliente <span style={{color:'var(--red)',fontSize:10,fontWeight:700}}>*</span></span>}>
                    <Select value={form.cliente_id||''} onChange={e=>onClienteChange(e.target.value)}
                      options={(clientes||[]).map(c=>({value:c.id,label:c.nome+(c.cidade?` — ${c.cidade}`:'')}))}>
                    </Select>
                  </Field>
                </div>

                {/* Motorista + Ajudante */}
                <Field label={<span>Motorista <span style={{color:'var(--red)',fontSize:10,fontWeight:700}}>*</span></span>}>
                  <Select value={form.motorista_id||''} onChange={e=>set('motorista_id',e.target.value)}
                    options={(motoristas||[]).map(m=>({value:m.id,label:m.nome}))} />
                </Field>
                <Field label="Ajudante">
                  <Input
                    value={form.ajudante_nome||''}
                    onChange={e=>set('ajudante_nome',e.target.value)}
                    placeholder="Nome do ajudante (opcional)"
                  />
                </Field>

                {/* Veículo + Região */}
                <Field label={<span>Veículo <span style={{color:'var(--red)',fontSize:10,fontWeight:700}}>*</span></span>}>
                  <Select value={form.veiculo_id||''} onChange={e=>set('veiculo_id',e.target.value)}
                    options={(veiculos||[]).map(v=>({value:v.id,label:`${v.placa} — ${v.tipo} — ${v.ag_ft==='frota'?'🏠 Frota':'🚛 Agregado'}`}))} />
                </Field>
                <Field label={<span>Região <span style={{color:'var(--text3)',fontSize:10,fontWeight:400}}>(define frete)</span></span>}>
                  <Select value={form.regiao||''} onChange={e=>set('regiao',e.target.value)}
                    options={(regioes||[]).map(r=>({value:r,label:r}))} />
                </Field>

                {/* Tipo + Pedido */}
                <Field label="Tipo">
                  <Select value={form.tipo||''} onChange={e=>set('tipo',e.target.value)}
                    options={['SOROCABA','INTEIRO','CORTE','AGREGADO'].map(v=>({value:v,label:v}))} />
                </Field>
                <Field label="Pedido">
                  <Input value={form.pedido||''} onChange={e=>set('pedido',e.target.value)} />
                </Field>
              </div>

              {/* ════ Card de resumo de frete ════ */}
              <FreteResumo
                veiculo={veiculoSelecionado}
                regiao={form.regiao}
                freteData={freteData}
                loading={freteLoading}
              />

              {/* Campos configuráveis */}
              <div className="form-grid cols-2" style={{marginBottom:14}}>
                {visivel('nf') && (
                  <FL label="NF" obrig={obrigatorio('nf')}>
                    <Input value={form.nf||''} onChange={e=>set('nf',e.target.value)} />
                  </FL>
                )}
                {visivel('peso') && (
                  <FL label="Peso (kg)" obrig={obrigatorio('peso')}>
                    <Input type="number" value={form.peso||''} onChange={e=>set('peso',e.target.value)} />
                  </FL>
                )}
                {visivel('remessa') && (
                  <FL label="Remessa" obrig={obrigatorio('remessa')}>
                    <Input value={form.remessa||''} onChange={e=>set('remessa',e.target.value)} />
                  </FL>
                )}
                {visivel('ajuda_diesel') && (
                  <FL label="Ajuda Diesel (R$)" obrig={obrigatorio('ajuda_diesel')}>
                    <Input type="number" step="0.01" min="0" value={form.ajuda_diesel||''} onChange={e=>set('ajuda_diesel',e.target.value)} placeholder="0,00" />
                  </FL>
                )}
                {visivel('taxa_descarga') && (
                  <FL label="Taxa Descarga (R$)" obrig={obrigatorio('taxa_descarga')}>
                    <Input type="number" step="0.01" min="0" value={form.taxa_descarga||''} onChange={e=>set('taxa_descarga',e.target.value)} placeholder="0,00" />
                  </FL>
                )}
                {visivel('obs') && (
                  <div style={{gridColumn:'span 2'}}>
                    <FL label="Observações" obrig={obrigatorio('obs')}>
                      <Input value={form.obs||''} onChange={e=>set('obs',e.target.value)} />
                    </FL>
                  </div>
                )}
              </div>

              {/* Anexo */}
              {visivel('anexo') && (
                <div>
                  <div style={{fontSize:12,fontWeight:600,color:'var(--text3)',textTransform:'uppercase',letterSpacing:'.05em',marginBottom:6}}>
                    Anexo {obrigatorio('anexo') && <span style={{color:'var(--red)'}}>*</span>}
                    <span style={{fontWeight:400,textTransform:'none',marginLeft:6}}>(NF, romaneio, comprovante...)</span>
                  </div>
                  <UploadZone file={anexo} onFile={setAnexo} />
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={closeModal}>Cancelar</button>
              <button className="btn btn-primary" onClick={save}>Salvar Ordem</button>
            </div>
          </div>
        </div>
      )}
      {toast && <Toast {...toast} />}
    </div>
  );
}
