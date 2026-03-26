import { useState, useEffect, useMemo } from 'react';
import { useFetch } from '../hooks/useFetch';
import { api } from '../lib/api';
import { Modal, Field, Input, Select, useToast, Toast } from '../components/UI';

const fmt = v => v !== null && v !== undefined ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v) : '—';

const VEICULOS_ORDER = ['HR', 'IVECO', '3/4', 'TOCO', 'TRUCK'];

const SUB_TABELAS = {
  sp: 'Rotas São Paulo',
  sorocaba: 'Região Sorocaba',
  campinas1: 'Campinas 1 (até 300km)',
  campinas2: 'Campinas 2 (até 500km)',
};

// ════ Aba RECEBER (frete fixo por veículo) ═══════════════════════════════════
function TabReceber() {
  const { data, loading, refetch } = useFetch('/financeiro/fretes/recebido');
  const [editing, setEditing] = useState(null);
  const [valor, setValor] = useState('');
  const { toast, showToast } = useToast();

  const rows = data || [];

  const startEdit = (row) => {
    setEditing(row.id);
    setValor(row.valor?.toString() || '');
  };

  const save = async () => {
    try {
      await api.put(`/financeiro/fretes/recebido/${editing}`, { valor: parseFloat(valor) });
      showToast('Valor atualizado!');
      setEditing(null);
      refetch();
    } catch (e) { showToast(e.message, 'error'); }
  };

  const cancel = () => { setEditing(null); setValor(''); };

  return (
    <div>
      <div style={{ padding: '12px 16px', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 'var(--radius)', marginBottom: 16, fontSize: 13, color: '#16A34A' }}>
        <strong>Frete recebido da Léo Madeiras</strong> — Valor fixo cobrado por tipo de veículo, independente da região.
      </div>

      <div className="card fade-up">
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${rows.length || 5}, 1fr)`, gap: 12 }}>
          {loading && Array.from({ length: 5 }).map((_, i) => (
            <div key={i} style={{ padding: 20, background: 'var(--bg3)', borderRadius: 'var(--radius)', textAlign: 'center' }}>
              <div style={{ height: 16, background: 'var(--border)', borderRadius: 4, width: '60%', margin: '0 auto 12px' }} />
              <div style={{ height: 24, background: 'var(--border)', borderRadius: 4, width: '70%', margin: '0 auto' }} />
            </div>
          ))}
          {rows.map(r => (
            <div key={r.id} style={{
              padding: '20px 16px', background: 'var(--bg2)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius)', textAlign: 'center', transition: 'all .15s',
            }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 4 }}>
                {r.tipo_veiculo}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 10 }}>
                {r.descricao || ''}
              </div>
              {editing === r.id ? (
                <div>
                  <input
                    type="number" step="0.01" value={valor}
                    onChange={e => setValor(e.target.value)}
                    style={{
                      width: '100%', padding: '8px', border: '1px solid var(--accent)',
                      borderRadius: 'var(--radius)', textAlign: 'center', fontSize: 16,
                      fontWeight: 600, fontFamily: 'inherit', marginBottom: 8,
                    }}
                    autoFocus
                    onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') cancel(); }}
                  />
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                    <button className="btn btn-ghost btn-sm" onClick={cancel}>Cancelar</button>
                    <button className="btn btn-primary btn-sm" onClick={save}>Salvar</button>
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--accent)', marginBottom: 8 }}>
                    {fmt(r.valor)}
                  </div>
                  <button className="btn btn-ghost btn-sm" onClick={() => startEdit(r)}>
                    Editar
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      {toast && <Toast {...toast} />}
    </div>
  );
}

// ════ Aba PAGAR (tabela agregado por região/veículo) ═════════════════════════
function TabPagar() {
  const [subTab, setSubTab] = useState('sp');
  const { data, loading, refetch } = useFetch(`/financeiro/fretes?tipo_frete=agregado&sub_tabela=${subTab}`, [subTab]);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const { toast, showToast } = useToast();
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const rows = data || [];

  // Agrupar por região para exibir como grade (região x veículo)
  const grouped = useMemo(() => {
    const map = {};
    rows.forEach(r => {
      if (!map[r.regiao]) map[r.regiao] = {};
      map[r.regiao][r.tipo_veiculo] = r;
    });
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0], 'pt-BR'));
  }, [rows]);

  // Para Sorocaba, agrupar por veículo e faixa de km
  const isSorocaba = subTab === 'sorocaba';
  const sorocabaGrouped = useMemo(() => {
    if (!isSorocaba) return {};
    const map = {};
    rows.forEach(r => {
      if (!map[r.tipo_veiculo]) map[r.tipo_veiculo] = [];
      map[r.tipo_veiculo].push(r);
    });
    // Ordenar cada grupo por km_max
    Object.keys(map).forEach(k => map[k].sort((a, b) => (a.km_max || 0) - (b.km_max || 0)));
    return map;
  }, [rows, isSorocaba]);

  const open = (row = null) => {
    setEditing(row);
    setForm(row ? { ...row } : {
      tipo_frete: 'agregado', tipo_veiculo: 'HR', valor_base: '', regiao: '',
      sub_tabela: subTab, km_max: '',
    });
    setModal(true);
  };
  const close = () => { setModal(false); setEditing(null); };

  const save = async () => {
    if (!form.valor_base) return showToast('Valor é obrigatório', 'error');
    if (!isSorocaba && !form.regiao) return showToast('Região é obrigatória', 'error');
    try {
      const payload = { ...form, sub_tabela: subTab };
      if (editing) await api.put(`/financeiro/fretes/${editing.id}`, payload);
      else await api.post('/financeiro/fretes', payload);
      showToast(editing ? 'Tarifa atualizada!' : 'Tarifa cadastrada!');
      refetch(); close();
    } catch (e) { showToast(e.message, 'error'); }
  };

  const remove = async (id) => {
    if (!confirm('Excluir esta tarifa?')) return;
    try { await api.delete(`/financeiro/fretes/${id}`); showToast('Tarifa excluída!'); refetch(); }
    catch (e) { showToast(e.message, 'error'); }
  };

  return (
    <div>
      <div style={{ padding: '12px 16px', background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: 'var(--radius)', marginBottom: 16, fontSize: 13, color: '#B45309' }}>
        <strong>Frete pago aos agregados</strong> — Valor variável por região e tipo de veículo.
      </div>

      {/* Sub-tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {Object.entries(SUB_TABELAS).map(([key, label]) => (
          <button
            key={key}
            className={`btn btn-sm ${subTab === key ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setSubTab(key)}
          >
            {label}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <button className="btn btn-primary btn-sm" onClick={() => open()}>+ Nova Tarifa</button>
      </div>

      {/* Tabela Sorocaba (por km) */}
      {isSorocaba ? (
        <div className="card fade-up">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Veículo</th>
                  <th>Até 100 km</th>
                  <th>Até 250 km</th>
                  <th>Até 300 km</th>
                  <th>Até 350 km</th>
                  <th>Até 400 km</th>
                  <th>Até 450 km</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {loading && Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>{Array.from({ length: 8 }).map((_, j) => (
                    <td key={j}><div style={{ height: 12, background: 'var(--bg3)', borderRadius: 4, width: '60%' }} /></td>
                  ))}</tr>
                ))}
                {!loading && VEICULOS_ORDER.map(veiculo => {
                  const items = sorocabaGrouped[veiculo] || [];
                  const kmFaixas = [100, 250, 300, 350, 400, 450];
                  return (
                    <tr key={veiculo}>
                      <td><span className="badge badge-teal">{veiculo}</span></td>
                      {kmFaixas.map(km => {
                        const item = items.find(i => i.km_max === km);
                        return (
                          <td key={km} className="fw-600" style={{ color: item ? 'var(--accent)' : 'var(--text3)' }}>
                            {item ? fmt(item.valor_base) : '—'}
                          </td>
                        );
                      })}
                      <td>
                        <button className="btn btn-ghost btn-sm" onClick={() => {
                          const item = items[0];
                          if (item) open(item);
                          else open({ tipo_veiculo: veiculo, sub_tabela: 'sorocaba', tipo_frete: 'agregado' });
                        }}>Editar</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{ padding: '10px 14px', fontSize: 11, color: 'var(--text3)', borderTop: '1px solid var(--border)' }}>
            * Regra de km baseada no romaneio + retorno da última entrega para o CD. Pedágio por conta do agregado.
          </div>
        </div>
      ) : (
        /* Tabelas SP / Campinas — grade região x veículo */
        <div className="card fade-up">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ minWidth: 200 }}>Região / Rota</th>
                  {VEICULOS_ORDER.map(v => <th key={v}>{v}</th>)}
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {loading && Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>{Array.from({ length: 7 }).map((_, j) => (
                    <td key={j}><div style={{ height: 12, background: 'var(--bg3)', borderRadius: 4, width: '60%' }} /></td>
                  ))}</tr>
                ))}
                {!loading && !grouped.length && (
                  <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text3)', padding: '32px 0' }}>
                    Nenhuma tarifa cadastrada para esta sub-tabela
                  </td></tr>
                )}
                {grouped.map(([regiao, veiculos], idx) => (
                  <tr key={regiao} style={{ background: idx % 2 === 0 ? 'transparent' : 'var(--bg3)' }}>
                    <td className="fw-500" style={{ fontSize: 12 }}>{regiao}</td>
                    {VEICULOS_ORDER.map(v => (
                      <td key={v} className="fw-600" style={{ color: veiculos[v] ? 'var(--accent)' : 'var(--text3)', fontSize: 13 }}>
                        {veiculos[v] ? fmt(veiculos[v].valor_base) : '—'}
                      </td>
                    ))}
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => {
                          const first = Object.values(veiculos)[0];
                          if (first) open(first);
                        }}>Editar</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {(subTab === 'campinas1' || subTab === 'campinas2') && (
            <div style={{ padding: '10px 14px', fontSize: 11, color: 'var(--text3)', borderTop: '1px solid var(--border)' }}>
              * Pedágio por conta do agregado.
            </div>
          )}
        </div>
      )}

      {/* Modal de edição */}
      {modal && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && close()}>
          <div className="modal" style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <span className="modal-title">{editing?.id ? 'Editar Tarifa' : 'Nova Tarifa'}</span>
              <button className="modal-close" onClick={close}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-grid cols-2">
                {!isSorocaba && (
                  <div style={{ gridColumn: 'span 2' }}>
                    <Field label="Região / Rota *">
                      <Input value={form.regiao || ''} onChange={e => set('regiao', e.target.value)} placeholder="ex: Osasco / Barueri" />
                    </Field>
                  </div>
                )}
                <Field label="Tipo de veículo *">
                  <Select
                    value={form.tipo_veiculo || 'HR'}
                    onChange={e => set('tipo_veiculo', e.target.value)}
                    options={VEICULOS_ORDER.map(v => ({ value: v, label: v }))}
                  />
                </Field>
                <Field label="Valor base (R$) *">
                  <Input type="number" step="0.01" min="0" value={form.valor_base || ''} onChange={e => set('valor_base', e.target.value)} placeholder="0,00" />
                </Field>
                {isSorocaba && (
                  <Field label="Km máximo">
                    <Select
                      value={form.km_max || ''}
                      onChange={e => set('km_max', e.target.value)}
                      options={[100, 250, 300, 350, 400, 450].map(v => ({ value: v, label: `Até ${v} km` }))}
                    />
                  </Field>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={close}>Cancelar</button>
              <button className="btn btn-primary" onClick={save}>{editing?.id ? 'Salvar' : 'Cadastrar'}</button>
            </div>
          </div>
        </div>
      )}
      {toast && <Toast {...toast} />}
    </div>
  );
}

// ════ Componente Principal ═══════════════════════════════════════════════════
export default function TabelaFretes() {
  const [tab, setTab] = useState('pagar');

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Tabela de Fretes</div>
          <div className="page-desc">Valores de referência para frete recebido e pago aos agregados</div>
        </div>
      </div>

      <div className="page-body">
        {/* Tabs */}
        <div style={{
          display: 'flex', gap: 0, marginBottom: 20,
          borderBottom: '2px solid var(--border)',
        }}>
          <button
            onClick={() => setTab('receber')}
            style={{
              padding: '10px 20px', border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
              background: 'transparent',
              color: tab === 'receber' ? 'var(--accent)' : 'var(--text3)',
              borderBottom: tab === 'receber' ? '2px solid var(--accent)' : '2px solid transparent',
              marginBottom: -2, transition: 'all .15s',
            }}
          >
            💰 Frete Recebido
          </button>
          <button
            onClick={() => setTab('pagar')}
            style={{
              padding: '10px 20px', border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
              background: 'transparent',
              color: tab === 'pagar' ? 'var(--accent)' : 'var(--text3)',
              borderBottom: tab === 'pagar' ? '2px solid var(--accent)' : '2px solid transparent',
              marginBottom: -2, transition: 'all .15s',
            }}
          >
            🚚 Frete Agregado (Pagar)
          </button>
        </div>

        {tab === 'receber' ? <TabReceber /> : <TabPagar />}
      </div>
    </div>
  );
}
