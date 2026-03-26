import { useState, useRef } from 'react';
import { useFetch } from '../hooks/useFetch';
import { api } from '../lib/api';
import { Field, Input, Select, useToast, Toast } from '../components/UI';

const fmt = v => v !== null && v !== undefined ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v) : '—';

function parsePlanilha(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = window.XLSX.read(e.target.result, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const raw = window.XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

        // Dados começam na linha 4 (index 4), ignorar headers
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
            endereco: String(row[13] || '').trim(),
            cidade: String(row[14] || '').trim(),
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
  const [atribuicoes, setAtribuicoes] = useState({});
  const [importando, setImportando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const fileRef = useRef();
  const { toast, showToast } = useToast();

  const { data: motoristas } = useFetch('/motoristas');
  const { data: veiculos } = useFetch('/veiculos');
  const { data: regioes } = useFetch('/financeiro/fretes/regioes');

  const setAttr = (rota, key, val) => {
    setAtribuicoes(a => ({ ...a, [rota]: { ...(a[rota] || {}), [key]: val } }));
  };

  // Auto-preencher veículo quando seleciona motorista
  const onMotoristaChange = (rota, motoristaId) => {
    setAttr(rota, 'motorista_id', motoristaId);
    const mot = (motoristas || []).find(m => String(m.id) === String(motoristaId));
    if (mot?.veiculo_padrao_id) {
      setAttr(rota, 'veiculo_id', mot.veiculo_padrao_id);
    }
  };

  const onFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const parsed = await parsePlanilha(file);
      setRotas(parsed);
      setAtribuicoes({});
      setResultado(null);
      showToast(`${parsed.length} rotas encontradas com ${parsed.reduce((s,r) => s + r.paradas.length, 0)} paradas`);
    } catch(err) {
      showToast('Erro ao ler planilha: ' + err.message, 'error');
    }
  };

  const importar = async () => {
    // Validar que todas as rotas têm motorista e veículo
    const faltando = (rotas || []).filter(r => {
      const a = atribuicoes[r.numero_rota] || {};
      return !a.motorista_id || !a.veiculo_id;
    });
    if (faltando.length) {
      showToast(`Preencha Motorista e Veículo para ${faltando.length} rota(s): ${faltando.map(r=>r.numero_rota).join(', ')}`, 'error');
      return;
    }

    setImportando(true);
    try {
      const payload = {
        data,
        rotas: (rotas || []).map(r => {
          const a = atribuicoes[r.numero_rota] || {};
          return {
            numero_rota: r.numero_rota,
            motorista_id: a.motorista_id,
            veiculo_id: a.veiculo_id,
            ajudante_nome: a.ajudante_nome || null,
            regiao: a.regiao || null,
            tipo: a.tipo || 'INTEIRO',
            tabela_frete_id: a.tabela_frete_id || null,
            paradas: r.paradas,
          };
        }),
      };

      const res = await api.post('/ordens/importar', payload);
      setResultado(res);
      showToast(`${res.total} ordens criadas com sucesso!`);
    } catch(e) { showToast('Erro: ' + e.message, 'error'); }
    finally { setImportando(false); }
  };

  const totalParadas = (rotas || []).reduce((s, r) => s + r.paradas.length, 0);

  return (
    <div>
      <div className="page-header">
        <div style={{flex:1}}>
          <div className="page-title">Importar Roteirização</div>
          <div className="page-desc">Importar planilha da Léo Madeiras e atribuir motorista/veículo</div>
        </div>
      </div>

      <div className="page-body">
        {/* Upload */}
        <div className="card mb-16">
          <div style={{display:'flex',gap:10,alignItems:'flex-end',flexWrap:'wrap'}}>
            <div style={{flex:'1 1 150px'}}>
              <Field label="Data da entrega *">
                <Input type="date" value={data} onChange={e=>setData(e.target.value)} />
              </Field>
            </div>
            <div style={{flex:'2 1 200px'}}>
              <Field label="Planilha de Roteirização (.xlsx / .xlsm)">
                <input ref={fileRef} type="file" accept=".xlsx,.xlsm,.xls"
                  className="form-input" style={{padding:'8px'}}
                  onChange={onFileChange} />
              </Field>
            </div>
          </div>
        </div>

        {/* Resultado da importação */}
        {resultado && (
          <div style={{padding:'14px 16px',background:'#F0FDF4',border:'1px solid #BBF7D0',borderRadius:'var(--radius)',marginBottom:16,fontSize:13,color:'#16A34A'}}>
            ✅ <strong>{resultado.total} ordens</strong> importadas com sucesso! Vá para <a href="/ordens" style={{color:'#16A34A',fontWeight:600}}>Ordens de Transporte</a> para visualizar.
          </div>
        )}

        {/* Preview das rotas */}
        {rotas && !resultado && (
          <>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16,flexWrap:'wrap',gap:8}}>
              <div style={{fontSize:14,fontWeight:600}}>
                {rotas.length} rotas — {totalParadas} paradas
              </div>
              <button className="btn btn-primary" onClick={importar} disabled={importando}
                style={{background:'#16a34a',boxShadow:'0 2px 8px rgba(22,163,74,.25)'}}>
                {importando ? 'Importando...' : `✅ Importar ${totalParadas} ordens`}
              </button>
            </div>

            {rotas.map(rota => {
              const a = atribuicoes[rota.numero_rota] || {};
              return (
                <div key={rota.numero_rota} className="card mb-16 fade-up">
                  {/* Header da rota */}
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12,flexWrap:'wrap',gap:8}}>
                    <div>
                      <div style={{fontSize:16,fontWeight:700,color:'var(--accent)'}}>Rota {rota.numero_rota}</div>
                      <div style={{fontSize:11,color:'var(--text3)'}}>
                        {rota.paradas.length} paradas — Placa ref: {rota.placa_ref || '—'} — Operador: {rota.operador_ref || '—'}
                      </div>
                    </div>
                    <div style={{
                      padding:'4px 12px', borderRadius:99, fontSize:12, fontWeight:600,
                      background: a.motorista_id && a.veiculo_id ? '#dcfce7' : '#fee2e2',
                      color: a.motorista_id && a.veiculo_id ? '#16a34a' : '#dc2626',
                    }}>
                      {a.motorista_id && a.veiculo_id ? '✓ Pronto' : '⚠ Pendente'}
                    </div>
                  </div>

                  {/* Atribuições — o que o operador precisa preencher */}
                  <div style={{padding:'12px',background:'var(--bg3)',borderRadius:'var(--radius)',marginBottom:12}}>
                    <div style={{display:'grid',gap:10}}>
                      <div className="form-grid cols-2">
                        <Field label="Motorista *">
                          <Select value={a.motorista_id||''} onChange={e=>onMotoristaChange(rota.numero_rota, e.target.value)}
                            options={(motoristas||[]).map(m=>({value:m.id,label:m.nome}))} />
                        </Field>
                        <Field label="Veículo *">
                          <Select value={a.veiculo_id||''} onChange={e=>setAttr(rota.numero_rota,'veiculo_id',e.target.value)}
                            options={(veiculos||[]).map(v=>({value:v.id,label:`${v.placa} — ${v.tipo}`}))} />
                        </Field>
                      </div>
                      <div className="form-grid cols-2">
                        <Field label="Ajudante">
                          <Input value={a.ajudante_nome||''} onChange={e=>setAttr(rota.numero_rota,'ajudante_nome',e.target.value)}
                            placeholder="Opcional" />
                        </Field>
                        <Field label="Região (frete)">
                          <Select value={a.regiao||''} onChange={e=>setAttr(rota.numero_rota,'regiao',e.target.value)}
                            options={(regioes||[]).map(r=>({value:r,label:r}))} />
                        </Field>
                      </div>
                    </div>
                  </div>

                  {/* Tabela de paradas (resumida) */}
                  <div className="table-wrap">
                    <table>
                      <thead><tr><th>Seq</th><th>Cliente</th><th>Região</th><th>Peso</th><th>Remessa</th></tr></thead>
                      <tbody>
                        {rota.paradas.map((p,i) => (
                          <tr key={i}>
                            <td className="fw-600">{p.seq}</td>
                            <td>
                              <div className="fw-500" style={{fontSize:12}}>{p.cliente_nome}</div>
                              {p.endereco && <div style={{fontSize:10,color:'var(--text3)'}}>{p.endereco.substring(0,50)}</div>}
                            </td>
                            <td style={{fontSize:12}}>{p.regiao || '—'}</td>
                            <td style={{fontSize:12}}>{p.peso ? p.peso.toFixed(1)+' kg' : '—'}</td>
                            <td className="font-mono" style={{fontSize:10}}>{p.remessa || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}

            {/* Botão importar no final também */}
            <div style={{textAlign:'center',padding:'20px 0'}}>
              <button className="btn btn-primary" onClick={importar} disabled={importando}
                style={{background:'#16a34a',padding:'12px 32px',fontSize:14}}>
                {importando ? 'Importando...' : `✅ Importar ${totalParadas} ordens`}
              </button>
            </div>
          </>
        )}

        {!rotas && !resultado && (
          <div className="card" style={{textAlign:'center',padding:'40px 0',color:'var(--text3)'}}>
            <div style={{fontSize:32,marginBottom:8}}>📁</div>
            <div>Faça o upload da planilha de roteirização para começar.</div>
            <div style={{fontSize:12,marginTop:4}}>Formato aceito: .xlsx, .xlsm (planilha da Léo Madeiras)</div>
          </div>
        )}
      </div>
      {toast && <Toast {...toast} />}
    </div>
  );
}
