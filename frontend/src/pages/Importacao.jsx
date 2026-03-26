import { useState, useRef } from 'react';
import { api } from '../lib/api';
import { Field, Input, useToast, Toast } from '../components/UI';

function parsePlanilha(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = window.XLSX.read(e.target.result, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const raw = window.XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

        const rotas = {};
        for (let i = 4; i < raw.length; i++) {
          const row = raw[i];
          const numRota = row[1];
          if (!numRota) continue;

          const rota = String(numRota);
          if (!rotas[rota]) {
            rotas[rota] = {
              numero_rota: rota,
              placa_ref: String(row[11] || '').trim().toUpperCase(),
              operador_ref: String(row[3] || '').trim(),
              paradas: [],
            };
          }

          rotas[rota].paradas.push({
            seq: row[4] || rotas[rota].paradas.length + 1,
            pedido: String(row[2] || ''),
            cliente_nome: String(row[6] || '').trim(),
            regiao: String(row[7] || '').trim(),
            peso: row[9] ? parseFloat(row[9]) || null : null,
            nf: String(row[5] || '').trim() || null,
            remessa: String(row[12] || '').trim() || null,
            obs: String(row[8] || '').trim() || null,
          });
        }

        resolve(Object.values(rotas));
      } catch(err) { reject(err); }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

export default function Importacao() {
  const today = new Date().toISOString().split('T')[0];
  const [data, setData] = useState(today);
  const [rotas, setRotas] = useState(null);
  const [duplicados, setDuplicados] = useState([]);
  const [importando, setImportando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const fileRef = useRef();
  const { toast, showToast } = useToast();

  const onFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const parsed = await parsePlanilha(file);
      setRotas(parsed);
      setResultado(null);

      // Checar duplicados imediatamente
      const todosPedidos = [];
      parsed.forEach(r => r.paradas.forEach(p => { if (p.pedido) todosPedidos.push(p.pedido); }));

      if (todosPedidos.length) {
        try {
          const res = await api.post('/ordens/checar-duplicados', { pedidos: todosPedidos });
          setDuplicados(res.duplicados || []);
          const numDup = res.duplicados?.length || 0;
          const total = todosPedidos.length;
          if (numDup > 0) {
            showToast(`${parsed.length} rotas encontradas. ${numDup} de ${total} pedidos já existem no sistema.`, 'error');
          } else {
            showToast(`${parsed.length} rotas com ${total} paradas — tudo novo!`);
          }
        } catch { setDuplicados([]); }
      } else {
        setDuplicados([]);
        showToast(`${parsed.length} rotas encontradas`);
      }
    } catch(err) {
      showToast('Erro ao ler planilha: ' + err.message, 'error');
    }
  };

  const importar = async () => {
    if (!rotas?.length) return;
    setImportando(true);
    try {
      const payload = {
        data,
        rotas: rotas.map(r => ({
          numero_rota: r.numero_rota,
          motorista_id: null,
          veiculo_id: null,
          paradas: r.paradas,
        })),
      };

      const res = await api.post('/ordens/importar', payload);
      setResultado(res);
      if (res.total > 0 && res.ignoradas > 0) {
        showToast(`${res.total} importadas, ${res.ignoradas} ignoradas (duplicadas)`);
      } else if (res.total > 0) {
        showToast(`${res.total} ordens importadas!`);
      } else {
        showToast('Nenhuma ordem nova para importar (todas já existem)', 'error');
      }
    } catch(e) { showToast('Erro: ' + e.message, 'error'); }
    finally { setImportando(false); }
  };

  const totalParadas = (rotas || []).reduce((s, r) => s + r.paradas.length, 0);
  const totalNovas = (rotas || []).reduce((s, r) => s + r.paradas.filter(p => !duplicados.includes(p.pedido)).length, 0);
  const totalDup = totalParadas - totalNovas;

  return (
    <div>
      <div className="page-header">
        <div style={{flex:1}}>
          <div className="page-title">Importar Roteirização</div>
          <div className="page-desc">Upload da planilha Léo Madeiras → ordens pendentes</div>
        </div>
      </div>

      <div className="page-body">
        {/* Upload */}
        <div className="card mb-16">
          <div style={{fontSize:12,color:'var(--text3)',marginBottom:12}}>
            Faça o upload da planilha de roteirização. As paradas serão importadas como <strong>ordens pendentes</strong>.
            Depois, edite cada rota em <strong>Ordens de Transporte</strong> para atribuir motorista, veículo e região.
          </div>
          <div style={{display:'flex',gap:10,alignItems:'flex-end',flexWrap:'wrap'}}>
            <div style={{flex:'1 1 140px'}}>
              <Field label="Data da entrega *">
                <Input type="date" value={data} onChange={e=>setData(e.target.value)} />
              </Field>
            </div>
            <div style={{flex:'2 1 200px'}}>
              <Field label="Planilha (.xlsx / .xlsm)">
                <input ref={fileRef} type="file" accept=".xlsx,.xlsm,.xls"
                  className="form-input" style={{padding:'8px'}}
                  onChange={onFileChange} />
              </Field>
            </div>
          </div>
        </div>

        {/* Resultado da importação */}
        {resultado && (
          <div className="card mb-16" style={{background:'#F0FDF4',border:'1px solid #BBF7D0'}}>
            <div style={{fontSize:15,fontWeight:700,color:'#16A34A',marginBottom:8}}>
              ✅ {resultado.total} ordens importadas!
            </div>
            {resultado.ignoradas > 0 && (
              <div style={{padding:'8px 12px',background:'#FEF3C7',borderRadius:'var(--radius)',marginBottom:8,fontSize:12,color:'#B45309'}}>
                ⚠️ {resultado.ignoradas} pedidos ignorados (já existiam)
              </div>
            )}
            <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
              <a href="/ordens" className="btn btn-primary" style={{textDecoration:'none'}}>Ir para Ordens →</a>
              <button className="btn btn-ghost" onClick={()=>{setRotas(null);setResultado(null);setDuplicados([]);if(fileRef.current)fileRef.current.value='';}}>
                Importar outra
              </button>
            </div>
          </div>
        )}

        {/* Preview */}
        {rotas && !resultado && (
          <>
            {/* Resumo com alerta de duplicados */}
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12,flexWrap:'wrap',gap:8}}>
              <div>
                <span style={{fontSize:14,fontWeight:600}}>{rotas.length} rotas — {totalParadas} paradas</span>
                {totalDup > 0 && (
                  <span style={{marginLeft:8,fontSize:12,color:'#DC2626',fontWeight:600}}>
                    ({totalDup} já existem)
                  </span>
                )}
              </div>
              <button className="btn btn-primary" onClick={importar} disabled={importando || totalNovas === 0}
                style={{background: totalNovas > 0 ? '#16a34a' : '#9ca3af'}}>
                {importando ? 'Importando...' : totalNovas > 0 ? `✅ Importar ${totalNovas} novas` : '⚠️ Todas já existem'}
              </button>
            </div>

            {/* Alerta geral */}
            {totalDup > 0 && (
              <div style={{padding:'10px 14px',background:'#FEF3C7',border:'1px solid #FCD34D',borderRadius:'var(--radius)',marginBottom:12,fontSize:12,color:'#B45309'}}>
                ⚠️ <strong>{totalDup} pedidos</strong> já foram importados anteriormente e serão ignorados (marcados em vermelho abaixo).
              </div>
            )}

            {/* Tabela por rota */}
            {rotas.map(rota => {
              const dupCount = rota.paradas.filter(p => duplicados.includes(p.pedido)).length;
              const newCount = rota.paradas.length - dupCount;
              const todaDuplicada = dupCount === rota.paradas.length;

              return (
                <div key={rota.numero_rota} className="card mb-16 fade-up" style={todaDuplicada ? {opacity:0.5} : {}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8,flexWrap:'wrap',gap:4}}>
                    <div>
                      <span style={{fontSize:15,fontWeight:700,color:'var(--accent)'}}>Rota {rota.numero_rota}</span>
                      <span style={{fontSize:12,color:'var(--text3)',marginLeft:8}}>
                        {rota.paradas.length} paradas — Placa: {rota.placa_ref || '—'}
                      </span>
                    </div>
                    <div style={{display:'flex',gap:6}}>
                      {newCount > 0 && (
                        <span style={{padding:'3px 10px',borderRadius:99,fontSize:11,fontWeight:600,background:'#dcfce7',color:'#16a34a'}}>
                          {newCount} novas
                        </span>
                      )}
                      {dupCount > 0 && (
                        <span style={{padding:'3px 10px',borderRadius:99,fontSize:11,fontWeight:600,background:'#fee2e2',color:'#dc2626'}}>
                          {dupCount} duplicadas
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="table-wrap">
                    <table>
                      <thead><tr><th>Seq</th><th>Pedido</th><th>Cliente</th><th>Região</th><th>Peso</th><th>Status</th></tr></thead>
                      <tbody>
                        {rota.paradas.map((p, i) => {
                          const isDup = duplicados.includes(p.pedido);
                          return (
                            <tr key={i} style={isDup ? {background:'#fef2f2',textDecoration:'line-through',opacity:0.6} : {}}>
                              <td className="fw-600">{p.seq}</td>
                              <td className="font-mono" style={{fontSize:10}}>{p.pedido || '—'}</td>
                              <td style={{fontSize:12}}>{p.cliente_nome}</td>
                              <td style={{fontSize:12}}>{p.regiao || '—'}</td>
                              <td style={{fontSize:12}}>{p.peso ? p.peso.toFixed(1)+' kg' : '—'}</td>
                              <td>
                                {isDup ? (
                                  <span style={{padding:'2px 8px',borderRadius:99,fontSize:10,fontWeight:600,background:'#fee2e2',color:'#dc2626'}}>
                                    Já existe
                                  </span>
                                ) : (
                                  <span style={{padding:'2px 8px',borderRadius:99,fontSize:10,fontWeight:600,background:'#dcfce7',color:'#16a34a'}}>
                                    Nova
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </>
        )}

        {!rotas && !resultado && (
          <div className="card" style={{textAlign:'center',padding:'40px 0',color:'var(--text3)'}}>
            <div style={{fontSize:32,marginBottom:8}}>📁</div>
            <div>Faça o upload da planilha de roteirização para começar.</div>
            <div style={{fontSize:12,marginTop:4}}>Formato: .xlsx ou .xlsm (planilha da Léo Madeiras)</div>
          </div>
        )}
      </div>
      {toast && <Toast {...toast} />}
    </div>
  );
}
