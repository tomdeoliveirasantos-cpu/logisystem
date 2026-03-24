import { useState } from 'react';
import { useFetch } from '../hooks/useFetch';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Modal, Field, Input, Select, useToast, Toast } from '../components/UI';

const PERFIS = [
  { value: 'admin',      label: 'Admin — acesso total' },
  { value: 'operador',   label: 'Operador — cadastros e ordens' },
  { value: 'financeiro', label: 'Financeiro — contas e relatórios' },
];

const PERFIL_BADGE = {
  admin:      { bg: '#F0FDF4', color: '#16A34A', label: 'Admin' },
  operador:   { bg: '#EEF4FF', color: '#2563EB', label: 'Operador' },
  financeiro: { bg: '#FFFBEB', color: '#D97706', label: 'Financeiro' },
};

export default function Usuarios() {
  const { user: me } = useAuth();
  const { data, loading, refetch } = useFetch('/auth/usuarios');
  const [modal, setModal]   = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm]     = useState({});
  const [saving, setSaving] = useState(false);
  const { toast, showToast } = useToast();

  const open = (row=null) => {
    setEditing(row);
    setForm(row ? { nome:row.nome, email:row.email, perfil:row.perfil, ativo:row.ativo, senha:'' } : { perfil:'operador', ativo:true, senha:'' });
    setModal(true);
  };
  const close = () => { setModal(false); setEditing(null); };
  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  const save = async () => {
    if (!form.nome || !form.email) return showToast('Nome e e-mail obrigatórios','error');
    if (!editing && !form.senha) return showToast('Senha obrigatória para novo usuário','error');
    setSaving(true);
    try {
      if (editing) await api.put(`/auth/usuarios/${editing.id}`, form);
      else         await api.post('/auth/usuarios', form);
      showToast(editing ? 'Usuário atualizado!' : 'Usuário criado!');
      refetch(); close();
    } catch(e) { showToast(e.message,'error'); }
    finally { setSaving(false); }
  };

  const toggle = async (row) => {
    if (row.id === me.id) return showToast('Você não pode desativar sua própria conta','error');
    try {
      await api.put(`/auth/usuarios/${row.id}`, { ...row, ativo: !row.ativo });
      showToast(row.ativo ? 'Usuário desativado' : 'Usuário reativado');
      refetch();
    } catch(e) { showToast(e.message,'error'); }
  };

  const rows = data || [];

  return (
    <div>
      <div className="page-header">
        <div style={{flex:1}}>
          <div className="page-title">Usuários do sistema</div>
          <div className="page-desc">Gerencie quem tem acesso ao LogiSystem</div>
        </div>
        <button className="btn btn-primary" onClick={()=>open()}>+ Novo Usuário</button>
      </div>

      <div className="page-body">
        <div className="card fade-up">
          <div className="table-wrap">
            <table>
              <thead><tr><th>Nome</th><th>E-mail</th><th>Perfil</th><th>Último acesso</th><th>Status</th><th>Ações</th></tr></thead>
              <tbody>
                {loading && Array.from({length:3}).map((_,i)=>(
                  <tr key={i}>{Array.from({length:6}).map((_,j)=>(
                    <td key={j}><div style={{height:12,background:'var(--bg3)',borderRadius:4,width:'65%'}}/></td>
                  ))}</tr>
                ))}
                {rows.map(r => {
                  const p = PERFIL_BADGE[r.perfil] || PERFIL_BADGE.operador;
                  return (
                    <tr key={r.id} style={{opacity: r.ativo ? 1 : .5}}>
                      <td className="fw-500">{r.nome}{r.id===me.id && <span style={{fontSize:10,color:'var(--accent)',marginLeft:6}}>(você)</span>}</td>
                      <td style={{fontSize:12}}>{r.email}</td>
                      <td><span className="badge" style={{background:p.bg,color:p.color}}>{p.label}</span></td>
                      <td style={{fontSize:12,color:'var(--text3)'}}>
                        {r.ultimo_login ? new Date(r.ultimo_login).toLocaleString('pt-BR') : 'Nunca'}
                      </td>
                      <td>
                        <span className={`badge ${r.ativo ? 'badge-green' : 'badge-red'}`}>
                          {r.ativo ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td>
                        <div style={{display:'flex',gap:6}}>
                          <button className="btn btn-ghost btn-sm" onClick={()=>open(r)}>Editar</button>
                          <button
                            className={`btn btn-sm ${r.ativo ? 'btn-danger' : 'btn-ghost'}`}
                            onClick={()=>toggle(r)}
                            disabled={r.id===me.id}
                          >{r.ativo ? 'Desativar' : 'Reativar'}</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {modal && (
        <div className="modal-backdrop" onClick={e=>e.target===e.currentTarget&&close()}>
          <div className="modal" style={{maxWidth:480}}>
            <div className="modal-header">
              <span className="modal-title">{editing ? 'Editar Usuário' : 'Novo Usuário'}</span>
              <button className="modal-close" onClick={close}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-grid cols-2">
                <div style={{gridColumn:'span 2'}}>
                  <Field label="Nome completo *"><Input value={form.nome||''} onChange={e=>set('nome',e.target.value)} /></Field>
                </div>
                <div style={{gridColumn:'span 2'}}>
                  <Field label="E-mail *"><Input type="email" value={form.email||''} onChange={e=>set('email',e.target.value)} /></Field>
                </div>
                <Field label="Perfil de acesso *">
                  <Select value={form.perfil||'operador'} onChange={e=>set('perfil',e.target.value)} options={PERFIS} />
                </Field>
                {editing && (
                  <Field label="Status">
                    <Select value={form.ativo?'true':'false'} onChange={e=>set('ativo',e.target.value==='true')}
                      options={[{value:'true',label:'Ativo'},{value:'false',label:'Inativo'}]} />
                  </Field>
                )}
                <div style={{gridColumn:'span 2'}}>
                  <Field label={editing ? 'Nova senha (deixe em branco para manter)' : 'Senha *'}>
                    <Input type="password" value={form.senha||''} onChange={e=>set('senha',e.target.value)}
                      placeholder={editing ? 'Digite para alterar a senha' : 'Mínimo 6 caracteres'} />
                  </Field>
                </div>
              </div>

              <div style={{marginTop:16,padding:12,background:'var(--bg3)',borderRadius:'var(--radius)',fontSize:12,color:'var(--text2)'}}>
                <strong>Permissões por perfil:</strong><br/>
                <strong style={{color:'#16A34A'}}>Admin</strong> — acesso total incluindo usuários<br/>
                <strong style={{color:'#2563EB'}}>Operador</strong> — cadastros, ordens, manutenção, multas<br/>
                <strong style={{color:'#D97706'}}>Financeiro</strong> — contas, relatórios, clientes e ordens
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={close}>Cancelar</button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>{saving?'Salvando...':editing?'Salvar':'Criar usuário'}</button>
            </div>
          </div>
        </div>
      )}
      {toast && <Toast {...toast} />}
    </div>
  );
}
