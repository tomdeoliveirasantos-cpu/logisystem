import { useState } from 'react';
import { useFetch } from '../hooks/useFetch';
import { api } from '../lib/api';
import { StatusBadge, Modal, Field, Input, Select, useToast, Toast, Spinner, ExportBtn } from '../components/UI';

const EMPTY = {
  nome: '', cnpj: '', tipo: 'terceiros',
  email_operacional: '', email_financeiro: '',
  telefone_contato: '', telefone_financeiro: '',
};

function maskCNPJ(v) {
  return v.replace(/\D/g, '').replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}

export default function Transportadoras() {
  const { data, loading, refetch } = useFetch('/transportadoras');
  const [modal, setModal]   = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm]     = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const { toast, showToast } = useToast();

  const open = (row = null) => {
    setEditing(row);
    setForm(row ? { ...row } : EMPTY);
    setModal(true);
  };
  const close = () => { setModal(false); setEditing(null); };

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      if (editing) await api.put(`/transportadoras/${editing.id}`, form);
      else         await api.post('/transportadoras', form);
      showToast(editing ? 'Transportadora atualizada!' : 'Transportadora cadastrada!');
      refetch(); close();
    } catch (e) { showToast(e.message, 'error'); }
    finally { setSaving(false); }
  };

  const remove = async (id) => {
    if (!confirm('Desativar esta transportadora?')) return;
    await api.delete(`/transportadoras/${id}`);
    showToast('Desativada!'); refetch();
  };

  const rows = (data || []).filter(r =>
    !search || r.nome.toLowerCase().includes(search.toLowerCase()) || r.cnpj.includes(search)
  );

  return (
    <div>
      <div className="page-header">
        <div style={{ flex: 1 }}>
          <div className="page-title">Transportadoras</div>
          <div className="page-desc">Cadastro de parceiros e frota própria</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div className="search-bar">
            <span className="search-icon">🔍</span>
            <input placeholder="Buscar por nome ou CNPJ..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <ExportBtn rows={rows} filename="transportadoras" columns={[
            {key:'nome',label:'Nome'},{key:'cnpj',label:'CNPJ'},{key:'tipo',label:'Tipo'},
            {key:'email_operacional',label:'E-mail Op.'},{key:'email_financeiro',label:'E-mail Fin.'},
            {key:'telefone_contato',label:'Telefone'},{key:'telefone_financeiro',label:'Tel. Fin.'},
          ]} />
          <button className="btn btn-primary" onClick={() => open()}>+ Nova Transportadora</button>
        </div>
      </div>

      <div className="page-body">
        <div className="card fade-up">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>CNPJ</th>
                  <th>Tipo</th>
                  <th>Contato</th>
                  <th>E-mail operacional</th>
                  <th>E-mail financeiro</th>
                  <th>Financeiro</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {loading && Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j}><div style={{ height: 12, background: 'var(--bg3)', borderRadius: 4, width: '70%' }} /></td>
                    ))}
                    <td />
                  </tr>
                ))}
                {!loading && !rows.length && (
                  <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--text3)', padding: '32px 0' }}>
                    Nenhuma transportadora cadastrada
                  </td></tr>
                )}
                {rows.map(r => (
                  <tr key={r.id}>
                    <td className="fw-500">{r.nome}</td>
                    <td className="font-mono" style={{ fontSize: 12 }}>{r.cnpj}</td>
                    <td><StatusBadge status={r.tipo} /></td>
                    <td style={{ fontSize: 12 }}>{r.telefone_contato || '—'}</td>
                    <td style={{ fontSize: 12 }}>{r.email_operacional || '—'}</td>
                    <td style={{ fontSize: 12 }}>{r.email_financeiro || '—'}</td>
                    <td style={{ fontSize: 12 }}>{r.telefone_financeiro || '—'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => open(r)}>Editar</button>
                        <button className="btn btn-danger btn-sm" onClick={() => remove(r.id)}>✕</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {modal && (
        <Modal title={editing ? 'Editar Transportadora' : 'Nova Transportadora'} onClose={close} width={620}>
          <div className="form-grid cols-2">
            <div className="form-grid" style={{ gridColumn: 'span 2' }}>
              <Field label="Nome / Razão Social *">
                <Input value={form.nome} onChange={e => set('nome', e.target.value)} placeholder="Nome da empresa" />
              </Field>
            </div>
            <Field label="CNPJ *">
              <Input value={form.cnpj} onChange={e => set('cnpj', maskCNPJ(e.target.value))} placeholder="00.000.000/0000-00" maxLength={18} />
            </Field>
            <Field label="Tipo de transporte *">
              <Select value={form.tipo} onChange={e => set('tipo', e.target.value)}
                options={[{ value: 'proprio', label: 'Próprio' }, { value: 'terceiros', label: 'Terceiros' }]} />
            </Field>
            <Field label="Telefone de contato">
              <Input value={form.telefone_contato} onChange={e => set('telefone_contato', e.target.value)} placeholder="(11) 99999-0000" />
            </Field>
            <Field label="E-mail operacional">
              <Input type="email" value={form.email_operacional} onChange={e => set('email_operacional', e.target.value)} placeholder="operacao@empresa.com" />
            </Field>
            <Field label="Telefone financeiro">
              <Input value={form.telefone_financeiro} onChange={e => set('telefone_financeiro', e.target.value)} placeholder="(11) 99999-0001" />
            </Field>
            <Field label="E-mail financeiro">
              <Input type="email" value={form.email_financeiro} onChange={e => set('email_financeiro', e.target.value)} placeholder="financeiro@empresa.com" />
            </Field>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
            <button className="btn btn-ghost" onClick={close}>Cancelar</button>
            <button className="btn btn-primary" onClick={save} disabled={saving}>
              {saving ? 'Salvando...' : (editing ? 'Salvar alterações' : 'Cadastrar')}
            </button>
          </div>
        </Modal>
      )}

      {toast && <Toast {...toast} />}
    </div>
  );
}
