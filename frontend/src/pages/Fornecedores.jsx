import { useState } from 'react';
import { useFetch } from '../hooks/useFetch';
import { api } from '../lib/api';
import { Modal, Field, Input, Select, useToast, Toast, ExportBtn } from '../components/UI';

const tipoOptions = [
  { value: 'mecanica', label: 'Mecânica' },
  { value: 'pneus', label: 'Pneus' },
  { value: 'eletrica', label: 'Elétrica' },
  { value: 'funilaria', label: 'Funilaria / Pintura' },
  { value: 'seguros', label: 'Seguros' },
  { value: 'licenciamento', label: 'Licenciamento / Despachante' },
  { value: 'combustivel', label: 'Combustível' },
  { value: 'pecas', label: 'Peças / Autopeças' },
  { value: 'tacografo', label: 'Tacógrafo' },
  { value: 'outros', label: 'Outros' },
];

const tipoLabel = Object.fromEntries(tipoOptions.map(t => [t.value, t.label]));

const formatDoc = v => {
  if (!v) return '—';
  const d = v.replace(/\D/g, '');
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  return v;
};

export default function Fornecedores() {
  const { data, loading, refetch } = useFetch('/fornecedores');
  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({});
  const { toast, showToast } = useToast();
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const rows = data || [];

  const openNew = () => { setEditId(null); setForm({}); setModal(true); };
  const openEdit = (r) => { setEditId(r.id); setForm({ nome: r.nome, cnpj_cpf: r.cnpj_cpf || '', telefone: r.telefone || '', tipo: r.tipo || '' }); setModal(true); };

  const save = async () => {
    if (!form.nome?.trim()) return showToast('Nome é obrigatório', 'error');
    try {
      if (editId) {
        await api.put(`/fornecedores/${editId}`, form);
        showToast('Fornecedor atualizado!');
      } else {
        await api.post('/fornecedores', form);
        showToast('Fornecedor cadastrado!');
      }
      refetch(); setModal(false); setForm({}); setEditId(null);
    } catch (e) { showToast(e.message, 'error'); }
  };

  const toggleAtivo = async (r) => {
    try {
      await api.patch(`/fornecedores/${r.id}/ativo`, { ativo: !r.ativo });
      showToast(r.ativo ? 'Fornecedor inativado' : 'Fornecedor reativado');
      refetch();
    } catch (e) { showToast(e.message, 'error'); }
  };

  const cols = [
    { k: 'nome', l: 'Nome / Razão Social' },
    { k: 'cnpj_cpf', l: 'CNPJ/CPF', f: v => formatDoc(v) },
    { k: 'telefone', l: 'Telefone' },
    { k: 'tipo', l: 'Tipo', f: v => tipoLabel[v] || v || '' },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Fornecedores / Prestadores</div>
          <div className="page-desc">Cadastro de fornecedores e prestadores de serviço da frota</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <ExportBtn rows={rows} filename="fornecedores" columns={cols.map(c => ({ key: c.k, label: c.l, fmt: c.f }))} />
          <button className="btn btn-primary" onClick={openNew}>+ Cadastrar</button>
        </div>
      </div>
      <div className="page-body">
        <div className="metrics-grid cols-3 mb-16 fade-up">
          <div className="metric-card"><div className="metric-label">Total cadastrados</div><div className="metric-value">{rows.length}</div></div>
          <div className="metric-card"><div className="metric-label">Ativos</div><div className="metric-value" style={{ color: 'var(--accent)' }}>{rows.filter(r => r.ativo !== false).length}</div></div>
          <div className="metric-card amber"><div className="metric-label">Inativos</div><div className="metric-value" style={{ color: 'var(--amber)' }}>{rows.filter(r => r.ativo === false).length}</div></div>
        </div>

        <div className="card fade-up fade-up-1"><div className="table-wrap"><table>
          <thead><tr><th>Nome / Razão Social</th><th>CNPJ/CPF</th><th>Telefone</th><th>Tipo</th><th>Status</th><th style={{ width: 100 }}>Ações</th></tr></thead>
          <tbody>
            {loading && Array.from({ length: 4 }).map((_, i) => (<tr key={i}>{Array.from({ length: 6 }).map((_, j) => (<td key={j}><div style={{ height: 12, background: 'var(--bg3)', borderRadius: 4, width: '65%' }} /></td>))}</tr>))}
            {!loading && !rows.length && <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text3)', padding: '32px 0' }}>Nenhum fornecedor cadastrado</td></tr>}
            {rows.map(r => (
              <tr key={r.id} style={{ opacity: r.ativo === false ? 0.5 : 1 }}>
                <td className="fw-500">{r.nome}</td>
                <td className="font-mono" style={{ fontSize: 12 }}>{formatDoc(r.cnpj_cpf)}</td>
                <td style={{ fontSize: 12 }}>{r.telefone || '—'}</td>
                <td style={{ fontSize: 12, textTransform: 'capitalize' }}>{tipoLabel[r.tipo] || r.tipo || '—'}</td>
                <td><span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: r.ativo !== false ? 'rgba(34,197,94,.15)' : 'rgba(239,68,68,.15)', color: r.ativo !== false ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>{r.ativo !== false ? 'Ativo' : 'Inativo'}</span></td>
                <td>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => openEdit(r)} title="Editar">✏️</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => toggleAtivo(r)} title={r.ativo !== false ? 'Inativar' : 'Reativar'}>{r.ativo !== false ? '🚫' : '✅'}</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table></div></div>
      </div>

      {modal && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="modal" style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <span className="modal-title">{editId ? 'Editar Fornecedor' : 'Cadastrar Fornecedor'}</span>
              <button className="modal-close" onClick={() => setModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-grid cols-2">
                <div style={{ gridColumn: 'span 2' }}>
                  <Field label="Nome / Razão Social *">
                    <Input value={form.nome || ''} onChange={e => set('nome', e.target.value)} placeholder="Nome do fornecedor ou prestador" />
                  </Field>
                </div>
                <Field label="CNPJ / CPF">
                  <Input value={form.cnpj_cpf || ''} onChange={e => set('cnpj_cpf', e.target.value)} placeholder="00.000.000/0000-00" />
                </Field>
                <Field label="Telefone">
                  <Input value={form.telefone || ''} onChange={e => set('telefone', e.target.value)} placeholder="(11) 99999-0000" />
                </Field>
                <div style={{ gridColumn: 'span 2' }}>
                  <Field label="Tipo de Serviço">
                    <Select value={form.tipo || ''} onChange={e => set('tipo', e.target.value)} options={tipoOptions} />
                  </Field>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={save}>Salvar</button>
            </div>
          </div>
        </div>
      )}
      {toast && <Toast {...toast} />}
    </div>
  );
}
