import { useState } from 'react';
import { useFetch } from '../hooks/useFetch';
import { api } from '../lib/api';
import { StatusBadge, Modal, Field, Input, Select, useToast, Toast } from '../components/UI';

const EMPTY = {
  nome:'', tipo_doc:'CNPJ', documento:'', email:'', telefone:'', contato:'',
  cep:'', logradouro:'', numero:'', complemento:'', bairro:'', cidade:'', estado:'', obs:''
};
const ESTADOS = ['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'];
function maskDoc(v,tipo){const d=v.replace(/\D/g,'');if(tipo==='CPF')return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/,'$1.$2.$3-$4');return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,'$1.$2.$3/$4-$5');}
function maskCEP(v){return v.replace(/\D/g,'').replace(/^(\d{5})(\d{3})$/,'$1-$2');}
function maskPhone(v){return v.replace(/\D/g,'').replace(/^(\d{2})(\d{4,5})(\d{4})$/,'($1) $2-$3');}

function exportXLS(rows) {
  if (!rows.length) return alert('Nenhum dado para exportar');
  const cols = [
    {k:'nome',l:'Nome'},{k:'tipo_doc',l:'Tipo'},{k:'documento',l:'Documento'},
    {k:'telefone',l:'Telefone'},{k:'email',l:'E-mail'},{k:'contato',l:'Contato'},
    {k:'cidade',l:'Cidade'},{k:'estado',l:'Estado'},{k:'logradouro',l:'Endereço'},
    {k:'numero',l:'Número'},{k:'bairro',l:'Bairro'},{k:'cep',l:'CEP'},
  ];
  const data = [cols.map(c=>c.l), ...rows.map(r=>cols.map(c=>r[c.k]||''))];
  const ws = window.XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = cols.map(()=>({wch:20}));
  const wb = window.XLSX.utils.book_new();
  window.XLSX.utils.book_append_sheet(wb,ws,'Clientes');
  window.XLSX.writeFile(wb,`clientes_${new Date().toLocaleDateString('pt-BR').replace(/\//g,'-')}.xlsx`);
}

export default function Clientes() {
  const { data, loading, refetch } = useFetch('/clientes');
  const [modal, setModal]   = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm]     = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const { toast, showToast } = useToast();

  const open = (row=null) => { setEditing(row); setForm(row ? {...row} : EMPTY); setModal(true); };
  const close = () => { setModal(false); setEditing(null); };
  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  const save = async () => {
    if (!form.nome || !form.documento) return showToast('Nome e documento são obrigatórios','error');
    setSaving(true);
    try {
      if (editing) await api.put(`/clientes/${editing.id}`, form);
      else         await api.post('/clientes', form);
      showToast(editing ? 'Cliente atualizado!' : 'Cliente cadastrado!');
      refetch(); close();
    } catch(e) { showToast(e.message,'error'); }
    finally { setSaving(false); }
  };

  const remove = async (id) => {
    if (!confirm('Desativar este cliente?')) return;
    await api.delete(`/clientes/${id}`);
    showToast('Cliente desativado!'); refetch();
  };

  const rows = (data||[]).filter(r =>
    !search || r.nome.toLowerCase().includes(search.toLowerCase()) || r.documento.includes(search)
  );

  return (
    <div>
      <div className="page-header">
        <div style={{flex:1}}>
          <div className="page-title">Clientes</div>
          <div className="page-desc">Cadastro de clientes para ordens de transporte</div>
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          <div className="search-bar">
            <svg width="14" height="14" fill="none" stroke="var(--text3)" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
            <input placeholder="Buscar por nome ou documento..." value={search} onChange={e=>setSearch(e.target.value)} />
          </div>
          <button className="btn btn-ghost" onClick={()=>exportXLS(rows)}>⬇ Excel</button>
          <button className="btn btn-primary" onClick={()=>open()}>+ Novo Cliente</button>
        </div>
      </div>
      <div className="page-body">
        <div className="card fade-up">
          <div className="table-wrap">
            <table>
              <thead><tr><th>Nome</th><th>Documento</th><th>Cidade / Estado</th><th>Telefone</th><th>E-mail</th><th>Contato</th><th></th></tr></thead>
              <tbody>
                {loading && Array.from({length:4}).map((_,i)=>(<tr key={i}>{Array.from({length:7}).map((_,j)=>(<td key={j}><div style={{height:12,background:'var(--bg3)',borderRadius:4,width:'65%'}}/></td>))}</tr>))}
                {!loading && !rows.length && (<tr><td colSpan={7} style={{textAlign:'center',color:'var(--text3)',padding:'40px 0',fontSize:13}}>Nenhum cliente cadastrado ainda</td></tr>)}
                {rows.map(r=>(
                  <tr key={r.id}>
                    <td><div className="fw-500">{r.nome}</div></td>
                    <td><span style={{fontSize:12,fontFamily:'var(--mono)'}}>{r.documento}</span><span className="badge badge-gray" style={{marginLeft:6,fontSize:10}}>{r.tipo_doc}</span></td>
                    <td style={{fontSize:12}}>{r.cidade}{r.estado?` / ${r.estado}`:''}</td>
                    <td style={{fontSize:12}}>{r.telefone||'—'}</td>
                    <td style={{fontSize:12}}>{r.email||'—'}</td>
                    <td style={{fontSize:12}}>{r.contato||'—'}</td>
                    <td><div style={{display:'flex',gap:6}}><button className="btn btn-ghost btn-sm" onClick={()=>open(r)}>Editar</button><button className="btn btn-danger btn-sm" onClick={()=>remove(r.id)}>✕</button></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      {modal && (
        <div className="modal-backdrop" onClick={e=>e.target===e.currentTarget&&close()}>
          <div className="modal" style={{maxWidth:680}}>
            <div className="modal-header"><span className="modal-title">{editing?'Editar Cliente':'Novo Cliente'}</span><button className="modal-close" onClick={close}>×</button></div>
            <div className="modal-body">
              <div style={{marginBottom:14,paddingBottom:14,borderBottom:'1px solid var(--border)'}}>
                <div style={{fontSize:12,fontWeight:600,color:'var(--text3)',textTransform:'uppercase',letterSpacing:'.05em',marginBottom:10}}>Dados principais</div>
                <div className="form-grid cols-2">
                  <div style={{gridColumn:'span 2'}}><Field label="Nome / Razão Social *"><Input value={form.nome} onChange={e=>set('nome',e.target.value)} placeholder="Nome completo ou razão social" /></Field></div>
                  <Field label="Tipo de documento"><Select value={form.tipo_doc} onChange={e=>set('tipo_doc',e.target.value)} options={[{value:'CNPJ',label:'CNPJ — Pessoa Jurídica'},{value:'CPF',label:'CPF — Pessoa Física'}]} /></Field>
                  <Field label={`${form.tipo_doc} *`}><Input value={form.documento} onChange={e=>set('documento',maskDoc(e.target.value,form.tipo_doc))} placeholder={form.tipo_doc==='CNPJ'?'00.000.000/0000-00':'000.000.000-00'} maxLength={form.tipo_doc==='CNPJ'?18:14} /></Field>
                  <Field label="Telefone"><Input value={form.telefone} onChange={e=>set('telefone',maskPhone(e.target.value))} placeholder="(11) 99999-0000" /></Field>
                  <Field label="E-mail"><Input type="email" value={form.email} onChange={e=>set('email',e.target.value)} placeholder="email@empresa.com" /></Field>
                  <div style={{gridColumn:'span 2'}}><Field label="Nome do contato"><Input value={form.contato} onChange={e=>set('contato',e.target.value)} placeholder="Pessoa responsável" /></Field></div>
                </div>
              </div>
              <div>
                <div style={{fontSize:12,fontWeight:600,color:'var(--text3)',textTransform:'uppercase',letterSpacing:'.05em',marginBottom:10}}>Endereço</div>
                <div className="form-grid cols-3">
                  <Field label="CEP"><Input value={form.cep} onChange={e=>set('cep',maskCEP(e.target.value))} placeholder="00000-000" maxLength={9} /></Field>
                  <div style={{gridColumn:'span 2'}}><Field label="Logradouro"><Input value={form.logradouro} onChange={e=>set('logradouro',e.target.value)} placeholder="Rua, Avenida..." /></Field></div>
                  <Field label="Número"><Input value={form.numero} onChange={e=>set('numero',e.target.value)} /></Field>
                  <div style={{gridColumn:'span 2'}}><Field label="Complemento"><Input value={form.complemento} onChange={e=>set('complemento',e.target.value)} placeholder="Sala, Bloco..." /></Field></div>
                  <Field label="Bairro"><Input value={form.bairro} onChange={e=>set('bairro',e.target.value)} /></Field>
                  <Field label="Cidade"><Input value={form.cidade} onChange={e=>set('cidade',e.target.value)} /></Field>
                  <Field label="Estado"><Select value={form.estado} onChange={e=>set('estado',e.target.value)} options={ESTADOS.map(s=>({value:s,label:s}))} /></Field>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={close}>Cancelar</button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>{saving?'Salvando...':editing?'Salvar alterações':'Cadastrar Cliente'}</button>
            </div>
          </div>
        </div>
      )}
      {toast && <Toast {...toast} />}
    </div>
  );
}
