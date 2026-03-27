import { useState } from 'react';
import { useFetch } from '../hooks/useFetch';
import { ExportBtn } from '../components/UI';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Cell,
} from 'recharts';

const fmt = v => v !== null ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 }).format(v) : '—';
const fmtKm = v => v !== null ? Number(v).toFixed(0) + ' km' : '—';

const COLORS = { TRUCK: '#4f6ef7', TOCO: '#14b8a6', IVECO: '#f59e0b', '3/4': '#22c55e', HR: '#a855f7' };

export default function Relatorios() {
  const [tab, setTab]   = useState('faturamento');
  const [mes, setMes]   = useState(new Date().toISOString().slice(0, 7));

  const { data: fat }  = useFetch(`/relatorios/faturamento?mes=${mes}`, [mes]);
  const { data: cpR }  = useFetch('/relatorios/contas-pagar-resumo');
  const { data: crR }  = useFetch('/relatorios/contas-receber-resumo');
  const { data: kmVeiculo } = useFetch(`/relatorios/km-por-veiculo?mes=${mes}`, [mes]);
  const { data: kmRegiao } = useFetch(`/relatorios/km-por-regiao?mes=${mes}`, [mes]);
  const { data: kmMotorista } = useFetch(`/relatorios/km-por-motorista?mes=${mes}`, [mes]);
  const { data: kmEvolucao } = useFetch(`/relatorios/km-evolucao-diaria?mes=${mes}`, [mes]);

  const fatRows = fat || [];
  const kmEvoRows = (kmEvolucao || []).map(r => ({
    dia: r.data ? r.data.substring(8,10) : '',
    km: Number(r.km_total) || 0,
    viagens: Number(r.viagens) || 0,
  }));

  const totalKmMes = (kmVeiculo || []).reduce((s,r) => s + Number(r.km_total), 0);
  const totalViagensMes = (kmVeiculo || []).reduce((s,r) => s + Number(r.viagens), 0);

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
        <div style={{display:'flex',gap:0,marginBottom:16,borderBottom:'2px solid var(--border)',flexWrap:'wrap'}}>
          {[
            { id: 'faturamento', label: 'Faturamento' },
            { id: 'km',          label: 'KM & Rotas' },
            { id: 'pagar',       label: 'Contas a Pagar' },
            { id: 'receber',     label: 'Contas a Receber' },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{
                padding:'10px 16px', border:'none', cursor:'pointer',
                fontSize:13, fontWeight:600, fontFamily:'inherit',
                background:'transparent',
                color: tab === t.id ? 'var(--accent)' : 'var(--text3)',
                borderBottom: tab === t.id ? '2px solid var(--accent)' : '2px solid transparent',
                marginBottom:-2, transition:'all .15s',
              }}>
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
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
                  <div className="section-title">Detalhamento por tipo de veículo</div>
                  <ExportBtn rows={fatRows} filename="faturamento_por_veiculo" columns={[
                    {key:'veiculo_tipo',label:'Veículo'},{key:'total_rotas',label:'Rotas'},
                    {key:'entregas_ok',label:'Entregas'},{key:'devolucoes',label:'Devoluções'},
                    {key:'valor_receber',label:'Faturado',fmt:v=>fmt(v)},{key:'margem',label:'Margem',fmt:v=>fmt(v)},
                  ]} />
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
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
              <div className="section-title">Contas a Pagar por Transportadora</div>
              <ExportBtn rows={cpR||[]} filename="contas_pagar" columns={[
                {key:'transportadora',label:'Transportadora'},{key:'lancamentos',label:'Lançamentos'},
                {key:'total',label:'Total',fmt:v=>fmt(v)},{key:'em_aberto',label:'Em aberto',fmt:v=>fmt(v)},
                {key:'pago',label:'Pago',fmt:v=>fmt(v)},{key:'vencido',label:'Vencido',fmt:v=>fmt(v)},
              ]} />
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
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
              <div className="section-title">Contas a Receber por Cliente (Top 50)</div>
              <ExportBtn rows={crR||[]} filename="contas_receber" columns={[
                {key:'cliente',label:'Cliente'},{key:'lancamentos',label:'Lançamentos'},
                {key:'total',label:'Total',fmt:v=>fmt(v)},{key:'em_aberto',label:'Em aberto',fmt:v=>fmt(v)},
                {key:'recebido',label:'Recebido',fmt:v=>fmt(v)},{key:'vencido',label:'Vencido',fmt:v=>fmt(v)},
              ]} />
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
        {tab === 'km' && (
          <div>
            {/* KPIs de KM */}
            <div className="metrics-grid cols-4 mb-16 fade-up">
              <div className="metric-card">
                <div className="metric-label">KM Total (mês)</div>
                <div className="metric-value" style={{fontSize:18}}>{totalKmMes.toLocaleString('pt-BR')} km</div>
              </div>
              <div className="metric-card">
                <div className="metric-label">Viagens com KM</div>
                <div className="metric-value">{totalViagensMes}</div>
              </div>
              <div className="metric-card">
                <div className="metric-label">KM Médio/viagem</div>
                <div className="metric-value" style={{fontSize:18}}>{totalViagensMes > 0 ? (totalKmMes / totalViagensMes).toFixed(0) : 0} km</div>
              </div>
              <div className="metric-card">
                <div className="metric-label">Regiões atendidas</div>
                <div className="metric-value">{(kmRegiao||[]).length}</div>
              </div>
            </div>

            {/* Gráfico evolução diária KM */}
            {kmEvoRows.length > 0 && (
              <div className="card fade-up fade-up-1 mb-16">
                <div className="section-title mb-12">Evolução diária de KM</div>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={kmEvoRows} margin={{top:4,right:4,left:-20,bottom:0}}>
                    <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false}/>
                    <XAxis dataKey="dia" tick={{fontSize:10,fill:'var(--text3)'}} axisLine={false} tickLine={false}/>
                    <YAxis tick={{fontSize:10,fill:'var(--text3)'}} axisLine={false} tickLine={false} tickFormatter={v=>v+' km'}/>
                    <Tooltip formatter={v => [v + ' km']} contentStyle={{background:'var(--bg2)',border:'1px solid var(--border)',fontSize:12}}/>
                    <Line type="monotone" dataKey="km" stroke="var(--accent)" strokeWidth={2} dot={{r:3}} name="KM"/>
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* KM por Região — principal para otimização de rotas */}
            <div className="card fade-up fade-up-1 mb-16">
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
                <div className="section-title">KM por Região — Eficiência de Rotas</div>
                <ExportBtn rows={kmRegiao||[]} filename="km_por_regiao" columns={[
                  {key:'regiao',label:'Região'},{key:'viagens',label:'Viagens'},
                  {key:'km_total',label:'KM Total',fmt:v=>Number(v).toLocaleString('pt-BR')},
                  {key:'km_medio',label:'KM Médio',fmt:v=>Number(v).toFixed(0)},
                  {key:'faturado',label:'Faturado',fmt:v=>fmt(v)},
                  {key:'receita_por_km',label:'R$/km',fmt:v=>'R$ '+Number(v).toFixed(2)},
                ]} />
              <div style={{padding:'8px 12px',background:'var(--accent-lt)',borderRadius:'var(--radius)',marginBottom:12,fontSize:12,color:'var(--accent)'}}>
                Regiões com KM médio alto e receita/km baixa podem indicar rotas que precisam ser otimizadas.
              </div>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Região</th><th>Viagens</th><th>KM Total</th><th>KM Médio</th><th>KM Mín</th><th>KM Máx</th><th>Faturado</th><th>R$/km</th></tr></thead>
                  <tbody>
                    {!(kmRegiao||[]).length && (
                      <tr><td colSpan={8} style={{textAlign:'center',color:'var(--text3)',padding:'24px 0',fontSize:13}}>
                        Nenhum dado de KM registrado neste mês. Preencha KM Saída/Chegada nas ordens.
                      </td></tr>
                    )}
                    {(kmRegiao||[]).map(r => (
                      <tr key={r.regiao}>
                        <td className="fw-500" style={{fontSize:12}}>{r.regiao}</td>
                        <td>{r.viagens}</td>
                        <td className="fw-600">{Number(r.km_total).toLocaleString('pt-BR')} km</td>
                        <td>{Number(r.km_medio).toFixed(0)} km</td>
                        <td style={{fontSize:11,color:'var(--text3)'}}>{Number(r.km_min).toFixed(0)} km</td>
                        <td style={{fontSize:11,color:'var(--text3)'}}>{Number(r.km_max).toFixed(0)} km</td>
                        <td style={{color:'var(--green)'}}>{fmt(r.faturado)}</td>
                        <td>
                          <span className={`badge ${Number(r.receita_por_km) >= 5 ? 'badge-green' : Number(r.receita_por_km) >= 3 ? 'badge-amber' : 'badge-red'}`}>
                            R$ {Number(r.receita_por_km).toFixed(2)}/km
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(300px, 1fr))',gap:16}}>
              {/* KM por Veículo */}
              <div className="card fade-up fade-up-2">
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
                  <div className="section-title">KM por Veículo</div>
                  <ExportBtn rows={kmVeiculo||[]} filename="km_por_veiculo" columns={[
                    {key:'placa',label:'Placa'},{key:'tipo',label:'Tipo'},{key:'viagens',label:'Viagens'},
                    {key:'km_total',label:'KM Total',fmt:v=>Number(v).toLocaleString('pt-BR')},
                    {key:'km_medio',label:'KM Médio',fmt:v=>Number(v).toFixed(0)},
                  ]} />
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Veículo</th><th>Tipo</th><th>Viagens</th><th>KM Total</th><th>KM Médio</th></tr></thead>
                    <tbody>
                      {(kmVeiculo||[]).map(r => (
                        <tr key={r.placa}>
                          <td className="font-mono fw-500">{r.placa}</td>
                          <td><span className="badge badge-teal">{r.tipo}</span></td>
                          <td>{r.viagens}</td>
                          <td className="fw-600">{Number(r.km_total).toLocaleString('pt-BR')} km</td>
                          <td>{Number(r.km_medio).toFixed(0)} km</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* KM por Motorista */}
              <div className="card fade-up fade-up-2">
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
                  <div className="section-title">KM por Motorista</div>
                  <ExportBtn rows={kmMotorista||[]} filename="km_por_motorista" columns={[
                    {key:'motorista',label:'Motorista'},{key:'viagens',label:'Viagens'},
                    {key:'km_total',label:'KM Total',fmt:v=>Number(v).toLocaleString('pt-BR')},
                    {key:'km_medio',label:'KM Médio',fmt:v=>Number(v).toFixed(0)},
                    {key:'regioes_atendidas',label:'Regiões'},
                  ]} />
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Motorista</th><th>Viagens</th><th>KM Total</th><th>KM Médio</th><th>Regiões</th></tr></thead>
                    <tbody>
                      {(kmMotorista||[]).map(r => (
                        <tr key={r.motorista}>
                          <td className="fw-500">{r.motorista}</td>
                          <td>{r.viagens}</td>
                          <td className="fw-600">{Number(r.km_total).toLocaleString('pt-BR')} km</td>
                          <td>{Number(r.km_medio).toFixed(0)} km</td>
                          <td>{r.regioes_atendidas}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
