import { useState } from 'react';
import { useFetch } from '../hooks/useFetch';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Cell,
} from 'recharts';

const fmt = v => v !== null ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 }).format(v) : '—';

const COLORS = { TRUCK: '#4f6ef7', TOCO: '#14b8a6', IVECO: '#f59e0b', '3/4': '#22c55e', HR: '#a855f7' };

export default function Relatorios() {
  const [tab, setTab]   = useState('faturamento');
  const [mes, setMes]   = useState(new Date().toISOString().slice(0, 7));

  const { data: fat }  = useFetch(`/relatorios/faturamento?mes=${mes}`, [mes]);
  const { data: cpR }  = useFetch('/relatorios/contas-pagar-resumo');
  const { data: crR }  = useFetch('/relatorios/contas-receber-resumo');

  const fatRows = fat || [];

  return (
    <div>
      <div className="page-header">
        <div style={{ flex: 1 }}>
          <div className="page-title">Relatórios Gerenciais</div>
          <div className="page-desc">Análises e resumos operacionais</div>
        </div>
        <input type="month" className="form-input" style={{ width: 160 }} value={mes} onChange={e => setMes(e.target.value)} />
      </div>

      <div className="page-body">
        <div className="tabs">
          {[
            { id: 'faturamento', label: 'Faturamento' },
            { id: 'pagar',       label: 'Contas a Pagar' },
            { id: 'receber',     label: 'Contas a Receber' },
          ].map(t => (
            <button key={t.id} className={`tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'faturamento' && (
          <div>
            <div className="metrics-grid cols-4 mb-16 fade-up">
              <div className="metric-card">
                <div className="metric-label">Total rotas</div>
                <div className="metric-value">{fatRows.reduce((s,r)=>s+Number(r.total_rotas),0)}</div>
              </div>
              <div className="metric-card">
                <div className="metric-label">Total entregas</div>
                <div className="metric-value">{fatRows.reduce((s,r)=>s+Number(r.total_entregas),0)}</div>
              </div>
              <div className="metric-card">
                <div className="metric-label">Faturamento</div>
                <div className="metric-value" style={{ fontSize: 20 }}>{fmt(fatRows.reduce((s,r)=>s+Number(r.valor_receber),0))}</div>
              </div>
              <div className="metric-card">
                <div className="metric-label">Margem bruta</div>
                <div className="metric-value" style={{ fontSize: 20, color: 'var(--green)' }}>{fmt(fatRows.reduce((s,r)=>s+Number(r.margem),0))}</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="card fade-up fade-up-1">
                <div className="section-title mb-12">Faturamento vs Margem por veículo</div>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={fatRows} barSize={20} margin={{ left: -10, right: 4 }}>
                    <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="veiculo_tipo" tick={{ fontSize: 10, fill: 'var(--text3)' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: 'var(--text3)' }} axisLine={false} tickLine={false} tickFormatter={v=>'R$'+(v/1000).toFixed(0)+'k'} />
                    <Tooltip formatter={v => fmt(v)} contentStyle={{ background: 'var(--bg2)', border: '1px solid var(--border)', fontSize: 12 }} />
                    <Bar dataKey="valor_receber" name="Faturamento" radius={[4,4,0,0]}>
                      {fatRows.map((r, i) => <Cell key={i} fill={COLORS[r.veiculo_tipo] || '#4f6ef7'} />)}
                    </Bar>
                    <Bar dataKey="margem" name="Margem" fill="var(--green)" radius={[4,4,0,0]} opacity={0.7} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="card fade-up fade-up-2">
                <div className="section-title mb-12">Detalhamento por tipo de veículo</div>
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Veículo</th><th>Rotas</th><th>Entregas</th><th>Dev.</th><th>Faturado</th><th>Margem</th></tr></thead>
                    <tbody>
                      {fatRows.map(r => (
                        <tr key={r.veiculo_tipo}>
                          <td><span className="badge badge-teal">{r.veiculo_tipo}</span></td>
                          <td>{r.total_rotas}</td>
                          <td style={{ color: 'var(--green)' }}>{r.entregas_ok}</td>
                          <td style={{ color: 'var(--red)' }}>{r.devolucoes}</td>
                          <td className="fw-500">{fmt(r.valor_receber)}</td>
                          <td style={{ color: 'var(--green)' }}>{fmt(r.margem)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === 'pagar' && (
          <div className="card fade-up">
            <div className="section-title mb-12">Contas a Pagar por Transportadora</div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Transportadora</th><th>Lançamentos</th><th>Total</th><th>Em aberto</th><th>Pago</th><th>Vencido</th></tr></thead>
                <tbody>
                  {(cpR || []).map(r => (
                    <tr key={r.transportadora}>
                      <td className="fw-500">{r.transportadora || '(sem vínculo)'}</td>
                      <td>{r.lancamentos}</td>
                      <td>{fmt(r.total)}</td>
                      <td style={{ color: 'var(--amber)' }}>{fmt(r.em_aberto)}</td>
                      <td style={{ color: 'var(--green)' }}>{fmt(r.pago)}</td>
                      <td style={{ color: 'var(--red)' }}>{fmt(r.vencido)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'receber' && (
          <div className="card fade-up">
            <div className="section-title mb-12">Contas a Receber por Cliente (Top 50)</div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Cliente</th><th>Lançamentos</th><th>Total</th><th>Em aberto</th><th>Recebido</th><th>Vencido</th></tr></thead>
                <tbody>
                  {(crR || []).map(r => (
                    <tr key={r.cliente}>
                      <td className="fw-500">{r.cliente}</td>
                      <td>{r.lancamentos}</td>
                      <td>{fmt(r.total)}</td>
                      <td style={{ color: 'var(--amber)' }}>{fmt(r.em_aberto)}</td>
                      <td style={{ color: 'var(--green)' }}>{fmt(r.recebido)}</td>
                      <td style={{ color: 'var(--red)' }}>{fmt(r.vencido)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
