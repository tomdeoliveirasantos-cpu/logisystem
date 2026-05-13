import { useState, useEffect, useMemo } from 'react';
import { useFetch } from '../hooks/useFetch';
import { api } from '../lib/api';
import {
  StatusBadge, Field, Input, Select, SelectAdd, Textarea,
  useToast, Toast, ExportBtn,
} from '../components/UI';

const fmt = v => v !== null && v !== undefined
  ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
  : '—';

const fmtDate = d => {
  if (!d) return '—';
  const s = String(d).substring(0, 10);
  const dt = new Date(s + 'T12:00:00');
  return isNaN(dt) ? '—' : dt.toLocaleDateString('pt-BR');
};

const TIPO_BENEFICIARIO = {
  motorista_proprio:  { label: 'Motorista próprio',  badge: 'badge-blue' },
  motorista_terceiro: { label: 'Terceiro',           badge: 'badge-amber' },
  ajudante:           { label: 'Ajudante',           badge: 'badge-teal' },
};

const FORMA_PAGAMENTO = [
  { value: '',              label: '— Selecionar —' },
  { value: 'pix',           label: 'PIX' },
  { value: 'dinheiro',      label: 'Dinheiro' },
  { value: 'transferencia', label: 'Transferência' },
  { value: 'cartao',        label: 'Cartão' },
  { value: 'outro',         label: 'Outro' },
];

export default function Adiantamentos() {
  const { data, loading, refetch } = useFetch('/financeiro/adiantamentos');
  const { data: motoristas } = useFetch('/motoristas');
  const { data: veiculos } = useFetch('/veiculos');
  const { data: ajudantes, refetch: refetchAjudantes } = useFetch('/ajudantes?ativo=true');
  const { toast, showToast } = useToast();

  const [filtroStatus, setFiltroStatus] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [modalOpen, setModalOpen] = useState(false);

  const rows = useMemo(() => {
    return (data || [])
      .filter(r => r.status !== 'cancelado' || filtroStatus === 'cancelado')
      .filter(r => !filtroStatus || r.status === filtroStatus)
      .filter(r => !filtroTipo || r.tipo_beneficiario === filtroTipo);
  }, [data, filtroStatus, filtroTipo]);

  const total      = rows.reduce((s, r) => s + Number(r.valor), 0);
  const pendentes  = rows.filter(r => r.status === 'pendente').reduce((s, r) => s + (Number(r.valor) - Number(r.valor_descontado || 0)), 0);
  const descontado = rows.filter(r => r.status === 'descontado').reduce((s, r) => s + Number(r.valor), 0);

  const excluir = async (id) => {
    if (!confirm('Cancelar este adiantamento? A CP gerada também será cancelada.')) return;
    try {
      await api.delete(`/financeiro/adiantamentos/${id}`);
      showToast('Adiantamento cancelado!');
      refetch();
    } catch (e) { showToast(e.message, 'error'); }
  };

  const cols = [
    { k: 'data_adiantamento', l: 'Data',       f: v => fmtDate(v) },
    { k: 'tipo_beneficiario', l: 'Tipo',       f: v => TIPO_BENEFICIARIO[v]?.label || v || '' },
    { k: 'beneficiario_nome', l: 'Beneficiário' },
    { k: 'veiculo_placa',     l: 'Placa' },
    { k: 'valor',             l: 'Valor (R$)', f: v => v ? Number(v).toFixed(2) : '' },
    { k: 'valor_descontado',  l: 'Descontado', f: v => v ? Number(v).toFixed(2) : '0.00' },
    { k: 'forma_pagamento',   l: 'Forma' },
    { k: 'status',            l: 'Status' },
    { k: 'observacao',        l: 'Obs' },
  ];

  // Mapeia para exportação
  const rowsExport = rows.map(r => ({
    ...r,
    beneficiario_nome: r.motorista_nome || r.ajudante_nome || '—',
  }));

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Adiantamentos</div>
          <div className="page-desc">Adiantamentos a motoristas, terceiros e ajudantes</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <select className="form-select" style={{ width: 160 }} value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}>
            <option value="">Todos os status</option>
            <option value="pendente">Pendentes</option>
            <option value="descontado">Descontados</option>
            <option value="cancelado">Cancelados</option>
          </select>
          <select className="form-select" style={{ width: 180 }} value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}>
            <option value="">Todos os tipos</option>
            <option value="motorista_proprio">Motorista próprio</option>
            <option value="motorista_terceiro">Terceiro</option>
            <option value="ajudante">Ajudante</option>
          </select>
          <ExportBtn rows={rowsExport} filename="adiantamentos" columns={cols.map(c => ({ key: c.k, label: c.l, fmt: c.f }))} />
          <button className="btn btn-primary" onClick={() => setModalOpen(true)}>+ Adiantamento</button>
        </div>
      </div>

      <div className="page-body">
        <div className="metrics-grid cols-4 mb-16 fade-up">
          <div className="metric-card">
            <div className="metric-label">Total</div>
            <div className="metric-value">{fmt(total)}</div>
          </div>
          <div className="metric-card amber">
            <div className="metric-label">Pendente a descontar</div>
            <div className="metric-value" style={{ color: 'var(--amber)' }}>{fmt(pendentes)}</div>
          </div>
          <div className="metric-card green">
            <div className="metric-label">Já descontado</div>
            <div className="metric-value" style={{ color: 'var(--green)' }}>{fmt(descontado)}</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Lançamentos</div>
            <div className="metric-value">{rows.length}</div>
          </div>
        </div>

        <div className="card fade-up fade-up-1">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Tipo</th>
                  <th>Beneficiário</th>
                  <th>Placa</th>
                  <th>OT/Rota</th>
                  <th>Valor</th>
                  <th>Descontado</th>
                  <th>Status</th>
                  <th>Ação</th>
                </tr>
              </thead>
              <tbody>
                {loading && Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i}>{Array.from({ length: 9 }).map((_, j) => (
                    <td key={j}><div style={{ height: 12, background: 'var(--bg3)', borderRadius: 4, width: '60%' }} /></td>
                  ))}</tr>
                ))}
                {!loading && !rows.length && (
                  <tr><td colSpan={9} style={{ textAlign: 'center', color: 'var(--text3)', padding: '32px 0' }}>
                    Nenhum adiantamento encontrado. <button className="btn btn-ghost btn-sm" onClick={() => setModalOpen(true)}>+ Novo adiantamento</button>
                  </td></tr>
                )}
                {rows.map(r => {
                  const tipoInfo = TIPO_BENEFICIARIO[r.tipo_beneficiario] || { label: r.tipo_beneficiario || '—', badge: 'badge-gray' };
                  const beneficiario = r.motorista_nome || r.ajudante_nome || '—';
                  return (
                    <tr key={r.id}>
                      <td style={{ fontSize: 12 }}>{fmtDate(r.data_adiantamento)}</td>
                      <td><span className={`badge ${tipoInfo.badge}`}>{tipoInfo.label}</span></td>
                      <td>
                        <div className="fw-500">{beneficiario}</div>
                        {r.forma_pagamento && <div style={{ fontSize: 11, color: 'var(--text3)' }}>{r.forma_pagamento}</div>}
                      </td>
                      <td className="font-mono" style={{ fontSize: 12 }}>{r.veiculo_placa || '—'}</td>
                      <td className="font-mono fw-600" style={{ color: 'var(--accent)', fontSize: 12 }}>{r.numero_rota || '—'}</td>
                      <td className="fw-600">{fmt(r.valor)}</td>
                      <td style={{ fontSize: 12, color: 'var(--text2)' }}>
                        {Number(r.valor_descontado || 0) > 0 ? fmt(r.valor_descontado) : '—'}
                      </td>
                      <td><StatusBadge status={r.status} /></td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {r.comprovante_path && (
                          <a className="btn btn-ghost btn-sm"
                             href={`https://api.wsdevsoft.com/uploads/adiantamentos/${r.comprovante_path}`}
                             target="_blank" rel="noreferrer" title="Ver comprovante">📎</a>
                        )}
                        {r.status === 'pendente' && (
                          <button className="btn btn-ghost btn-sm" onClick={() => excluir(r.id)} style={{ color: '#DC2626' }} title="Cancelar adiantamento">🗑️</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {modalOpen && (
        <NovoAdiantamentoModal
          onClose={() => setModalOpen(false)}
          onSaved={() => { setModalOpen(false); refetch(); showToast('Adiantamento registrado!'); }}
          motoristas={motoristas || []}
          veiculos={veiculos || []}
          ajudantes={ajudantes || []}
          refetchAjudantes={refetchAjudantes}
          showToast={showToast}
        />
      )}

      {toast && <Toast {...toast} />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Modal de criação
// ─────────────────────────────────────────────────────────────────────────────
function NovoAdiantamentoModal({ onClose, onSaved, motoristas, veiculos, ajudantes, refetchAjudantes, showToast }) {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    tipo_beneficiario: 'motorista_proprio',
    motorista_id: '',
    ajudante_id: '',
    veiculo_id: '',
    valor: '',
    data_adiantamento: today,
    forma_pagamento: '',
    observacao: '',
  });
  const [comprovante, setComprovante] = useState(null);
  const [saving, setSaving] = useState(false);
  const [alertaPendente, setAlertaPendente] = useState(null);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Filtra motoristas conforme tipo
  const motoristasFiltrados = useMemo(() => {
    const tipo = form.tipo_beneficiario;
    if (tipo === 'motorista_proprio') {
      return (motoristas || []).filter(m =>
        ['motorista_proprio', 'motorista_funcionario', 'pendente'].includes(m.tipo_colaborador)
      );
    }
    if (tipo === 'motorista_terceiro') {
      return (motoristas || []).filter(m => m.tipo_colaborador === 'motorista_terceiro');
    }
    return [];
  }, [motoristas, form.tipo_beneficiario]);

  // Verifica pendentes quando muda beneficiário
  useEffect(() => {
    setAlertaPendente(null);
    const params = new URLSearchParams();
    if (form.tipo_beneficiario === 'ajudante' && form.ajudante_id) {
      params.set('ajudante_id', form.ajudante_id);
    } else if (form.tipo_beneficiario === 'motorista_terceiro' && form.veiculo_id) {
      params.set('veiculo_id', form.veiculo_id);
    } else if (form.tipo_beneficiario === 'motorista_proprio' && form.motorista_id) {
      params.set('motorista_id', form.motorista_id);
    } else {
      return;
    }
    api.get(`/financeiro/adiantamentos/pendentes?${params.toString()}`)
      .then(r => { if (r && r.count > 0) setAlertaPendente(r); })
      .catch(() => {});
  }, [form.tipo_beneficiario, form.motorista_id, form.ajudante_id, form.veiculo_id]);

  const cadastrarAjudante = async (dados) => {
    const novo = await api.post('/ajudantes', dados);
    refetchAjudantes();
    return novo.id;
  };

  const save = async () => {
    // Validações
    if (!form.valor || Number(form.valor) <= 0) {
      return showToast('Informe um valor maior que zero', 'error');
    }
    if (form.tipo_beneficiario === 'motorista_terceiro' && !form.veiculo_id) {
      return showToast('Para terceiro, selecione a placa do veículo', 'error');
    }
    if (form.tipo_beneficiario === 'ajudante' && !form.ajudante_id) {
      return showToast('Selecione o ajudante', 'error');
    }
    if (form.tipo_beneficiario !== 'ajudante' && !form.motorista_id) {
      return showToast('Selecione o motorista', 'error');
    }

    setSaving(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => {
        if (v !== '' && v !== null && v !== undefined) fd.append(k, v);
      });
      if (comprovante) fd.append('comprovante', comprovante);
      await api.post('/financeiro/adiantamentos', fd);
      onSaved();
    } catch (e) {
      showToast(e.message || 'Erro ao registrar adiantamento', 'error');
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 680 }}>
        <div className="modal-header">
          <span className="modal-title">Novo adiantamento</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
        {/* Tipo de beneficiário (radio cards) */}
        <Field label="Tipo de beneficiário *">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {Object.entries(TIPO_BENEFICIARIO).map(([key, info]) => (
              <label
                key={key}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '10px 12px',
                  border: '1px solid ' + (form.tipo_beneficiario === key ? 'var(--accent)' : 'var(--border)'),
                  background: form.tipo_beneficiario === key ? 'rgba(37,99,235,0.06)' : 'transparent',
                  borderRadius: 8, cursor: 'pointer', fontSize: 13,
                }}
              >
                <input
                  type="radio"
                  name="tipo_beneficiario"
                  checked={form.tipo_beneficiario === key}
                  onChange={() => {
                    setForm(f => ({
                      ...f,
                      tipo_beneficiario: key,
                      motorista_id: '', ajudante_id: '', veiculo_id: '',
                    }));
                  }}
                />
                {info.label}
              </label>
            ))}
          </div>
        </Field>

        <div className="form-grid cols-2" style={{ marginTop: 12 }}>
          {/* Motorista (próprio ou terceiro) */}
          {form.tipo_beneficiario !== 'ajudante' && (
            <div style={{ gridColumn: 'span 2' }}>
              <Field label="Motorista *">
                <Select
                  value={form.motorista_id}
                  onChange={e => set('motorista_id', e.target.value)}
                  options={[
                    { value: '', label: '— Selecione —' },
                    ...motoristasFiltrados.map(m => ({
                      value: m.id,
                      label: m.nome + (m.transportadora_nome ? ` (${m.transportadora_nome})` : ''),
                    })),
                  ]}
                />
              </Field>
            </div>
          )}

          {/* Ajudante */}
          {form.tipo_beneficiario === 'ajudante' && (
            <div style={{ gridColumn: 'span 2' }}>
              <Field label="Ajudante *">
                <SelectAdd
                  value={form.ajudante_id}
                  onChange={e => set('ajudante_id', e.target.value)}
                  options={(ajudantes || []).map(a => ({ value: a.id, label: a.nome + (a.cpf ? ` (${a.cpf})` : '') }))}
                  addTitle="Novo ajudante"
                  addFields={[
                    { key: 'nome',     label: 'Nome *',     full: true },
                    { key: 'cpf',      label: 'CPF',        placeholder: '000.000.000-00' },
                    { key: 'telefone', label: 'Telefone',   placeholder: '(11) 99999-9999' },
                  ]}
                  onAdd={cadastrarAjudante}
                />
              </Field>
            </div>
          )}

          {/* Veículo — obrigatório só para terceiro */}
          {form.tipo_beneficiario === 'motorista_terceiro' && (
            <div style={{ gridColumn: 'span 2' }}>
              <Field label="Veículo (placa) *">
                <Select
                  value={form.veiculo_id}
                  onChange={e => set('veiculo_id', e.target.value)}
                  options={[
                    { value: '', label: '— Selecione a placa —' },
                    ...(veiculos || []).map(v => ({
                      value: v.id,
                      label: `${v.placa} — ${v.tipo || ''}`,
                    })),
                  ]}
                />
              </Field>
            </div>
          )}

          <Field label="Valor (R$) *">
            <Input
              type="number" step="0.01" min="0.01"
              value={form.valor}
              onChange={e => set('valor', e.target.value)}
              placeholder="0,00"
            />
          </Field>

          <Field label="Data do adiantamento *">
            <Input
              type="date"
              value={form.data_adiantamento}
              onChange={e => set('data_adiantamento', e.target.value)}
            />
          </Field>

          <Field label="Forma de pagamento">
            <Select
              value={form.forma_pagamento}
              onChange={e => set('forma_pagamento', e.target.value)}
              options={FORMA_PAGAMENTO}
            />
          </Field>

          <Field label="Comprovante (PDF/imagem)">
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={e => setComprovante(e.target.files?.[0] || null)}
              style={{
                width: '100%', padding: '8px 12px',
                border: '1px dashed var(--border)', borderRadius: 8,
                background: 'var(--bg2)', color: 'var(--text1)',
                fontSize: 13, cursor: 'pointer',
              }}
            />
            {comprovante && (
              <div style={{ marginTop: 4, fontSize: 12, color: 'var(--accent)' }}>
                📎 {comprovante.name} ({(comprovante.size / 1024).toFixed(0)} KB)
              </div>
            )}
          </Field>

          <div style={{ gridColumn: 'span 2' }}>
            <Field label="Observação">
              <Textarea
                rows={2}
                value={form.observacao}
                onChange={e => set('observacao', e.target.value)}
                placeholder="Ex: adiantamento para combustível da rota XPTO"
              />
            </Field>
          </div>
        </div>

        {/* Alerta de pendentes */}
        {alertaPendente && alertaPendente.count > 0 && (
          <div style={{
            marginTop: 12, padding: '10px 12px',
            background: 'rgba(251,191,36,0.1)',
            border: '1px solid rgba(251,191,36,0.4)',
            borderRadius: 8, fontSize: 13,
          }}>
            <div style={{ fontWeight: 600, color: 'var(--amber)', marginBottom: 4 }}>
              ⚠ Já existe{alertaPendente.count > 1 ? 'm' : ''} {alertaPendente.count} adiantamento{alertaPendente.count > 1 ? 's' : ''} pendente{alertaPendente.count > 1 ? 's' : ''} para este beneficiário
            </div>
            <div style={{ color: 'var(--text2)' }}>
              Saldo pendente: <strong>{fmt(alertaPendente.total_pendente)}</strong>. Você pode prosseguir, mas verifique se não é duplicidade.
            </div>
          </div>
        )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancelar</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? 'Salvando...' : 'Registrar adiantamento'}
          </button>
        </div>
      </div>
    </div>
  );
}
