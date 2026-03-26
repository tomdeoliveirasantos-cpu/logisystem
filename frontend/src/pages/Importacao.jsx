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

        // Dados começam na linha 4 (index 4)
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
      showToast(`${parsed.length} rotas com ${parsed.reduce((s,r) => s + r.paradas.length, 0)} paradas`);
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
      showToast(`${res.total} ordens importadas!`);
    } catch(e) { showToast('Erro: ' + e.message, 'error'); }
    finally { setImportando(false); }
  };

  const totalParadas = (rotas || []).reduce((s, r) => s + r.paradas.length, 0);

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
            Faça o upload da planilha de roteirização. Todas as paradas serão importadas como <strong>ordens pendentes</strong>.
            Depois, vá em <strong>Ordens de Transporte</strong> e edite cada rota para atribuir motorista, veículo e região.
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

        {/* Resultado */}
        {resultado && (
          <div className="card mb-16" style={{background:'#F0FDF4',border:'1px solid #BBF7D0'}}>
            <div style={{fontSize:15,fontWeight:700,color:'#16A34A',marginBottom:8}}>
              ✅ {resultado.total} ordens importadas com sucesso!
            </div>
            {resultado.ignoradas > 0 && (
              <div style={{fontSize:13,color:'#B45309',marginBottom:8,padding:'8px 12px',background:'#FEF3C7',borderRadius:'var(--radius)'}}>
                ⚠️ <strong>{resultado.ignoradas} pedidos ignorados</strong> (já existem no sistema):
                <div style={{fontSize:11,marginTop:4,color:'#92400E'}}>
                  {resultado.duplicados.map(d => `Pedido ${d.pedido} (${d.cliente}, Rota ${d.rota})`).join(' | ')}
                </div>
              </div>
            )}
            <div style={{fontSize:13,color:'#15803d',marginBottom:12}}>
              Vá em Ordens de Transporte para atribuir motorista, veículo e região.
            </div>
            <div style={{display:'flex',gap:8}}>
              <a href="/ordens" className="btn btn-primary" style={{textDecoration:'none'}}>
                Ir para Ordens →
              </a>
              <button className="btn btn-ghost" onClick={()=>{setRotas(null);setResultado(null);if(fileRef.current)fileRef.current.value='';}}>
                Importar outra planilha
              </button>
            </div>
          </div>
        )}

        {/* Preview resumido */}
        {rotas && !resultado && (
          <>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12,flexWrap:'wrap',gap:8}}>
              <div>
                <span style={{fontSize:14,fontWeight:600}}>{rotas.length} rotas</span>
                <span style={{color:'var(--text3)',marginLeft:8}}>{totalParadas} paradas no total</span>
              </div>
              <button className="btn btn-primary" onClick={importar} disabled={importando}
                style={{background:'#16a34a',boxShadow:'0 2px 8px rgba(22,163,74,.25)'}}>
                {importando ? 'Importando...' : `✅ Importar ${totalParadas} ordens`}
              </button>
            </div>

            <div className="card fade-up">
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Rota</th>
                      <th>Paradas</th>
                      <th>Placa (ref.)</th>
                      <th>Operador (ref.)</th>
                      <th>Peso total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rotas.map(r => (
                      <tr key={r.numero_rota}>
                        <td className="font-mono fw-600" style={{color:'var(--accent)'}}>{r.numero_rota}</td>
                        <td>{r.paradas.length}</td>
                        <td className="font-mono" style={{fontSize:11}}>{r.placa_ref || '—'}</td>
                        <td style={{fontSize:12}}>{r.operador_ref ? r.operador_ref.substring(0, 25) : '—'}</td>
                        <td style={{fontSize:12}}>
                          {r.paradas.reduce((s, p) => s + (p.peso || 0), 0).toFixed(1)} kg
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
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
