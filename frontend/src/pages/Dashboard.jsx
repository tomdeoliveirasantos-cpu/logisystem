import { useFetch } from '../hooks/useFetch';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

const fmt = v => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 }).format(v || 0);

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', fontSize: 12 }}>
      <div style={{ color: 'var(--text3)', marginBottom: 4 }}>{label}</div>
      {payload.map(p => (
        <div key={p.name} style={{ color: p.color }}>
          {p.name === 'entregas' ? p.value + ' entregas' : fmt(p.value)}
        </div>
      ))}
    </div>
  );
};

export default function Dashboard() {
  const hoje = new Date().toISOString().split('T')[0];
  const mesAtual = new Date().toISOString().slice(0, 7);

  const { data: resumo } = useFetch(`/relatorios/resumo-diario?data=${hoje}`);
  const { data: fat } = useFetch(`/relatorios/faturamento?mes=${mesAtual}`);
  const { data: evolucao } = useFetch(`/relatorios/evolucao-diaria?inicio=${mesAtual}-01&fim=${hoje}`);
  const { data: rentRegiao } = useFetch(`/relatorios/rentabilidade-regiao?mes=${mesAtual}`);
  const { data: fechamento } = useFetch(`/relatorios/fechamento-mensal?mes=${mesAtual}`);
  const { data: notif } = useFetch('/relatorios/notificacoes');
  const { data: kmVeiculos } = useFetch(`/relatorios/km-por-veiculo?mes=${mesAtual}`);

  const fatRows = fat || [];
  const evoRows = (evolucao || []).map(r => ({
    dia: r.data ? r.data.substring(8, 10) : '',
    entregas: Number(r.entregas) || 0,
    faturado: Number(r.faturado) || 0,
  }));

  const totalEntregas = fatRows.reduce((s, r) => s + Number(r.total_entregas), 0);
  const totalFaturado = fatRows.reduce((s, r) => s + Number(r.valor_receber), 0);
  const totalMargem = fatRows.reduce((s, r) => s + Number(r.margem), 0);
  const totalRotas = fatRows.reduce((s, r) => s + Number(r.total_rotas), 0);

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Dashboard</div>
          <div className="page-desc">{new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
        </div>
      </div>

      <div className="page-body">
        {/* Alertas de vencimento */}
        {notif && (Number(notif.pagar_vencidas?.c) > 0 || Number(notif.receber_vencidas?.c) > 0) && (
          <div style={{ padding: '10px 14px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 'var(--radius)', marginBottom: 12, fontSize: 12, lineHeight: 1.5 }}>
            {Number(notif.pagar_vencidas?.c) > 0 && (
              <div style={{ color: '#DC2626' }}>⚠️ <strong>{notif.pagar_vencidas.c}</strong> conta(s) a pagar vencida(s) — {fmt(notif.pagar_vencidas.v)}</div>
            )}
            {Number(notif.receber_vencidas?.c) > 0 && (
              <div style={{ color: '#DC2626' }}>⚠️ <strong>{notif.receber_vencidas.c}</strong> conta(s) a receber vencida(s) — {fmt(notif.receber_vencidas.v)}</div>
            )}
          </div>
        )}
        {notif && (Number(notif.pagar_vencendo_7d?.c) > 0 || Number(notif.receber_vencendo_7d?.c) > 0) && (
          <div style={{ padding: '10px 14px', background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: 'var(--radius)', marginBottom: 12, fontSize: 12, lineHeight: 1.5 }}>
            {Number(notif.pagar_vencendo_7d?.c) > 0 && (
              <div style={{ color: '#B45309' }}>🔔 <strong>{notif.pagar_vencendo_7d.c}</strong> a pagar nos próximos 7 dias — {fmt(notif.pagar_vencendo_7d.v)}</div>
            )}
            {Number(notif.receber_vencendo_7d?.c) > 0 && (
              <div style={{ color: '#B45309' }}>🔔 <strong>{notif.receber_vencendo_7d.c}</strong> a receber nos próximos 7 dias — {fmt(notif.receber_vencendo_7d.v)}</div>
            )}
          </div>
        )}

        {/* KPIs — 2x2 no mobile, 4 em linha no desktop */}
        <div className="metrics-grid cols-4 metrics-compact fade-up" style={{ marginBottom: 14 }}>
          {[
            { label: 'Rotas', val: totalRotas, sub: 'mês' },
            { label: 'Entregas', val: totalEntregas, sub: 'mês', color: 'var(--green)' },
            { label: 'Faturamento', val: fmt(totalFaturado), sub: 'a receber', small: true },
            { label: 'Margem', val: fmt(totalMargem), sub: 'faturado - pago', color: 'var(--green)', small: true },
          ].map(k => (
            <div key={k.label} className="metric-card">
              <div className="metric-label">{k.label}</div>
              <div className="metric-value" style={{ color: k.color, fontSize: k.small ? 16 : undefined }}>{k.val}</div>
              <div className="metric-sub text-muted" style={{ fontSize: 10 }}>{k.sub}</div>
            </div>
          ))}
        </div>

        {/* Gráficos — empilham no mobile */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12, marginBottom: 14 }}>
          <div className="card fade-up fade-up-1">
            <div className="section-title" style={{ fontSize: 13, marginBottom: 10 }}>Entregas — mês</div>
            {evoRows.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text3)', padding: '24px 0', fontSize: 12 }}>Nenhum dado</div>
            ) : (
              <ResponsiveContainer width="100%" height={140}>
                <AreaChart data={evoRows} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                  <defs>
                    <linearGradient id="grad1" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="dia" tick={{ fontSize: 9, fill: 'var(--text3)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: 'var(--text3)' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="entregas" stroke="var(--accent)" strokeWidth={2} fill="url(#grad1)" name="entregas" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="card fade-up fade-up-2">
            <div className="section-title" style={{ fontSize: 13, marginBottom: 10 }}>Faturamento por veículo</div>
            {fatRows.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text3)', padding: '24px 0', fontSize: 12 }}>Nenhum dado</div>
            ) : (
              <ResponsiveContainer width="100%" height={140}>
                <BarChart data={fatRows} margin={{ top: 4, right: 4, left: -24, bottom: 0 }} barSize={14}>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="veiculo_tipo" tick={{ fontSize: 9, fill: 'var(--text3)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: 'var(--text3)' }} axisLine={false} tickLine={false} tickFormatter={v => (v / 1000).toFixed(0) + 'k'} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="valor_receber" fill="var(--accent)" radius={[3, 3, 0, 0]} name="faturado" />
                  <Bar dataKey="margem" fill="var(--green)" radius={[3, 3, 0, 0]} name="margem" opacity={0.7} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Resumo de rotas — hoje */}
        <div className="card fade-up" style={{ marginBottom: 14 }}>
          <div className="section-title" style={{ fontSize: 13, marginBottom: 8 }}>Rotas — hoje</div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Rota</th><th>Motorista</th><th>Veículo</th><th>Paradas</th><th>Entregues</th><th>%</th></tr></thead>
              <tbody>
                {(!resumo || !resumo.length) && (
                  <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text3)', padding: '20px 0', fontSize: 12 }}>Nenhuma rota hoje</td></tr>
                )}
                {(resumo || []).map(r => (
                  <tr key={r.numero_rota}>
                    <td className="font-mono fw-600">{r.numero_rota}</td>
                    <td style={{ fontSize: 11 }}>{r.motorista}</td>
                    <td><span className="badge badge-teal" style={{ fontSize: 10 }}>{r.veiculo}</span></td>
                    <td>{r.paradas}</td>
                    <td style={{ color: 'var(--green)' }}>{r.entregues}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ flex: 1, height: 4, background: 'var(--bg3)', borderRadius: 2, minWidth: 30 }}>
                          <div style={{ width: (r.pct_entrega || 0) + '%', height: '100%', background: r.pct_entrega >= 100 ? 'var(--green)' : 'var(--amber)', borderRadius: 2 }} />
                        </div>
                        <span style={{ fontSize: 10, color: 'var(--text2)', minWidth: 28 }}>{r.pct_entrega || 0}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Rentabilidade por região */}
        <div className="card fade-up" style={{ marginBottom: 14 }}>
          <div className="section-title" style={{ fontSize: 13, marginBottom: 8 }}>Rentabilidade por região — mês</div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Região</th><th>Ordens</th><th>Receber</th><th>Pagar</th><th>Margem</th><th>%</th></tr></thead>
              <tbody>
                {(!rentRegiao || !rentRegiao.length) && (
                  <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text3)', padding: '20px 0', fontSize: 12 }}>Sem dados</td></tr>
                )}
                {(rentRegiao || []).map(r => (
                  <tr key={r.regiao}>
                    <td style={{ fontSize: 11, fontWeight: 500 }}>{r.regiao}</td>
                    <td>{r.total_ordens}</td>
                    <td style={{ color: 'var(--green)', fontSize: 11 }}>{fmt(r.valor_receber)}</td>
                    <td style={{ color: 'var(--red)', fontSize: 11 }}>{fmt(r.valor_pagar)}</td>
                    <td className="fw-600" style={{ color: Number(r.margem) >= 0 ? 'var(--green)' : 'var(--red)', fontSize: 11 }}>{fmt(r.margem)}</td>
                    <td>
                      <span className={`badge ${Number(r.pct_margem) >= 20 ? 'badge-green' : Number(r.pct_margem) >= 0 ? 'badge-amber' : 'badge-red'}`} style={{ fontSize: 9 }}>
                        {r.pct_margem}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Fechamento mensal — 3 cards empilháveis */}
        {fechamento && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 14 }}>
            <div className="card fade-up">
              <div className="section-title" style={{ fontSize: 12, marginBottom: 10 }}>Operacional</div>
              <div style={{ display: 'grid', gap: 6, fontSize: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text3)' }}>Ordens</span><span className="fw-600">{fechamento.ordens?.total_ordens || 0}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text3)' }}>Entregues</span><span className="fw-600" style={{ color: 'var(--green)' }}>{fechamento.ordens?.entregues || 0}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text3)' }}>Devoluções</span><span className="fw-600" style={{ color: 'var(--red)' }}>{fechamento.ordens?.devolucoes || 0}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text3)' }}>Rotas</span><span className="fw-600">{fechamento.ordens?.total_rotas || 0}</span></div>
              </div>
            </div>
            <div className="card fade-up">
              <div className="section-title" style={{ fontSize: 12, marginBottom: 10, color: 'var(--green)' }}>Receber</div>
              <div style={{ display: 'grid', gap: 6, fontSize: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text3)' }}>Total</span><span className="fw-600">{fmt(fechamento.receber?.total)}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text3)' }}>Recebido</span><span className="fw-600" style={{ color: 'var(--green)' }}>{fmt(fechamento.receber?.recebido)}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text3)' }}>Em aberto</span><span className="fw-600" style={{ color: 'var(--amber)' }}>{fmt(fechamento.receber?.em_aberto)}</span></div>
              </div>
            </div>
            <div className="card fade-up">
              <div className="section-title" style={{ fontSize: 12, marginBottom: 10, color: 'var(--red)' }}>Pagar</div>
              <div style={{ display: 'grid', gap: 6, fontSize: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text3)' }}>Total</span><span className="fw-600">{fmt(fechamento.pagar?.total)}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text3)' }}>Pago</span><span className="fw-600" style={{ color: 'var(--green)' }}>{fmt(fechamento.pagar?.pago)}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text3)' }}>Em aberto</span><span className="fw-600" style={{ color: 'var(--amber)' }}>{fmt(fechamento.pagar?.em_aberto)}</span></div>
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 6, marginTop: 2, display: 'flex', justifyContent: 'space-between' }}>
                  <span className="fw-600">Margem</span>
                  <span className="fw-600" style={{ color: fechamento.margem >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmt(fechamento.margem)}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* KM por veículo */}
        {kmVeiculos && kmVeiculos.length > 0 && (
          <div className="card fade-up" style={{ marginBottom: 14 }}>
            <div className="section-title" style={{ fontSize: 13, marginBottom: 8 }}>KM — mês</div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Veículo</th><th>Tipo</th><th>Viagens</th><th>KM Total</th><th>KM Médio</th></tr></thead>
                <tbody>
                  {kmVeiculos.map(r => (
                    <tr key={r.placa}>
                      <td className="font-mono fw-500" style={{ fontSize: 11 }}>{r.placa}</td>
                      <td><span className="badge badge-teal" style={{ fontSize: 10 }}>{r.tipo}</span></td>
                      <td>{r.viagens}</td>
                      <td className="fw-600">{Number(r.km_total).toLocaleString('pt-BR')} km</td>
                      <td style={{ color: 'var(--text2)', fontSize: 11 }}>{Number(r.km_medio).toFixed(0)} km</td>
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
