import { useFetch } from '../hooks/useFetch';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

const fmt = v => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',minimumFractionDigits:0}).format(v||0);

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:8,padding:'8px 12px',fontSize:12}}>
      <div style={{color:'var(--text3)',marginBottom:4}}>{label}</div>
      {payload.map(p=>(
        <div key={p.name} style={{color:p.color}}>
          {p.name==='entregas'?p.value+' entregas':fmt(p.value)}
        </div>
      ))}
    </div>
  );
};

export default function Dashboard() {
  const hoje = new Date().toISOString().split('T')[0];
  const mesAtual = new Date().toISOString().slice(0,7);

  const { data: resumo }  = useFetch(`/relatorios/resumo-diario?data=${hoje}`);
  const { data: fat }     = useFetch(`/relatorios/faturamento?mes=${mesAtual}`);
  const { data: evolucao} = useFetch(`/relatorios/evolucao-diaria?inicio=${mesAtual}-01&fim=${hoje}`);

  const fatRows   = fat || [];
  const evoRows   = (evolucao||[]).map(r=>({
    dia: r.data ? r.data.substring(8,10) : '',
    entregas: Number(r.entregas)||0,
    faturado: Number(r.faturado)||0,
  }));

  const totalEntregas   = fatRows.reduce((s,r)=>s+Number(r.total_entregas),0);
  const totalFaturado   = fatRows.reduce((s,r)=>s+Number(r.valor_receber),0);
  const totalMargem     = fatRows.reduce((s,r)=>s+Number(r.margem),0);
  const totalRotas      = fatRows.reduce((s,r)=>s+Number(r.total_rotas),0);

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Dashboard</div>
          <div className="page-desc">Visão geral — {new Date().toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long'})}</div>
        </div>
      </div>

      <div className="page-body">
        {/* KPIs reais do banco */}
        <div className="metrics-grid cols-4 mb-20 fade-up">
          <div className="metric-card">
            <div className="metric-label">Rotas no mês</div>
            <div className="metric-value">{totalRotas}</div>
            <div className="metric-sub text-muted">mês atual</div>
          </div>
          <div className="metric-card green">
            <div className="metric-label">Entregas no mês</div>
            <div className="metric-value" style={{color:'var(--green)'}}>{totalEntregas}</div>
            <div className="metric-sub text-muted">mês atual</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Faturamento (mês)</div>
            <div className="metric-value" style={{fontSize:20}}>{fmt(totalFaturado)}</div>
            <div className="metric-sub text-muted">a receber</div>
          </div>
          <div className="metric-card green">
            <div className="metric-label">Margem bruta</div>
            <div className="metric-value" style={{fontSize:20,color:'var(--green)'}}>{fmt(totalMargem)}</div>
            <div className="metric-sub text-muted">faturado - pago</div>
          </div>
        </div>

        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}} className="mb-16">
          {/* Evolução real */}
          <div className="card fade-up fade-up-1">
            <div className="section-header mb-12">
              <span className="section-title">Evolução de entregas — mês atual</span>
            </div>
            {evoRows.length === 0 ? (
              <div style={{textAlign:'center',color:'var(--text3)',padding:'40px 0',fontSize:13}}>Nenhum dado no mês atual</div>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={evoRows} margin={{top:4,right:4,left:-20,bottom:0}}>
                  <defs>
                    <linearGradient id="grad1" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="var(--accent)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false}/>
                  <XAxis dataKey="dia" tick={{fontSize:10,fill:'var(--text3)'}} axisLine={false} tickLine={false}/>
                  <YAxis tick={{fontSize:10,fill:'var(--text3)'}} axisLine={false} tickLine={false}/>
                  <Tooltip content={<CustomTooltip/>}/>
                  <Area type="monotone" dataKey="entregas" stroke="var(--accent)" strokeWidth={2} fill="url(#grad1)" name="entregas"/>
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Faturamento por veículo */}
          <div className="card fade-up fade-up-2">
            <div className="section-header mb-12">
              <span className="section-title">Faturamento por tipo de veículo</span>
            </div>
            {fatRows.length === 0 ? (
              <div style={{textAlign:'center',color:'var(--text3)',padding:'40px 0',fontSize:13}}>Nenhum dado no mês atual</div>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={fatRows} margin={{top:4,right:4,left:-20,bottom:0}} barSize={18}>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false}/>
                  <XAxis dataKey="veiculo_tipo" tick={{fontSize:10,fill:'var(--text3)'}} axisLine={false} tickLine={false}/>
                  <YAxis tick={{fontSize:10,fill:'var(--text3)'}} axisLine={false} tickLine={false} tickFormatter={v=>'R$'+(v/1000).toFixed(0)+'k'}/>
                  <Tooltip content={<CustomTooltip/>}/>
                  <Bar dataKey="valor_receber" fill="var(--accent)" radius={[4,4,0,0]} name="faturado"/>
                  <Bar dataKey="margem" fill="var(--green)" radius={[4,4,0,0]} name="margem"/>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Resumo diário */}
        <div className="card fade-up fade-up-3">
          <div className="section-header">
            <span className="section-title">Resumo de rotas — hoje</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Rota</th><th>Motorista</th><th>Veículo</th><th>Paradas</th><th>Entregues</th><th>Devoluções</th><th>% Entrega</th></tr></thead>
              <tbody>
                {(!resumo||!resumo.length) && (
                  <tr><td colSpan={7} style={{textAlign:'center',color:'var(--text3)',padding:'24px 0',fontSize:13}}>
                    Nenhuma rota lançada hoje
                  </td></tr>
                )}
                {(resumo||[]).map(r=>(
                  <tr key={r.numero_rota}>
                    <td className="font-mono fw-600">{r.numero_rota}</td>
                    <td>{r.motorista}</td>
                    <td><span className="badge badge-teal">{r.veiculo}</span></td>
                    <td>{r.paradas}</td>
                    <td style={{color:'var(--green)'}}>{r.entregues}</td>
                    <td style={{color:r.devolucoes>0?'var(--red)':'var(--text3)'}}>{r.devolucoes}</td>
                    <td>
                      <div style={{display:'flex',alignItems:'center',gap:8}}>
                        <div style={{flex:1,height:4,background:'var(--bg3)',borderRadius:2}}>
                          <div style={{width:(r.pct_entrega||0)+'%',height:'100%',background:r.pct_entrega===100?'var(--green)':'var(--amber)',borderRadius:2}}/>
                        </div>
                        <span style={{fontSize:11,color:'var(--text2)',minWidth:36}}>{r.pct_entrega||0}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
