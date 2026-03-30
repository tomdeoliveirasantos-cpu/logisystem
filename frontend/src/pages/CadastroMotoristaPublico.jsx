import { useState, useRef, useEffect } from 'react';

const API = 'https://api.wsdevsoft.com/api';

/* ── Helpers ── */
const maskCPF = v => v.replace(/\D/g,'').replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d{1,2})$/,'$1-$2').slice(0,14);
const maskCNPJ = v => v.replace(/\D/g,'').replace(/^(\d{2})(\d)/,'$1.$2').replace(/^(\d{2})\.(\d{3})(\d)/,'$1.$2.$3').replace(/\.(\d{3})(\d)/,'.$1/$2').replace(/(\d{4})(\d)/,'$1-$2').slice(0,18);
const maskTel = v => { const d=v.replace(/\D/g,''); if(d.length<=10) return d.replace(/(\d{2})(\d)/,'($1) $2').replace(/(\d{4})(\d)/,'$1-$2'); return d.replace(/(\d{2})(\d)/,'($1) $2').replace(/(\d{5})(\d)/,'$1-$2').slice(0,15); };
const maskCEP = v => v.replace(/\D/g,'').replace(/(\d{5})(\d)/,'$1-$2').slice(0,9);
const maskPlaca = v => v.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,7);

export default function CadastroMotoristaPublico() {
  const token = window.location.pathname.split('/cadastro-motorista/')[1];
  const [status, setStatus] = useState('loading'); // loading, valid, filled, expired, error
  const [nomeConvite, setNomeConvite] = useState('');
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({});
  const [files, setFiles] = useState({});
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const canvasRef = useRef(null);
  const [drawing, setDrawing] = useState(false);
  const [hasSig, setHasSig] = useState(false);

  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  // Verificar convite
  useEffect(() => {
    if (!token) { setStatus('error'); return; }
    fetch(`${API}/cadastro-motorista/${token}`)
      .then(r => r.json())
      .then(d => {
        if (d.valid) { setStatus('valid'); setNomeConvite(d.nome_motorista || ''); }
        else if (d.error?.includes('preenchido')) setStatus('filled');
        else if (d.error?.includes('expirou')) setStatus('expired');
        else setStatus('error');
      })
      .catch(() => setStatus('error'));
  }, [token]);

  // ── Canvas de assinatura ──
  useEffect(() => {
    if (step !== 4) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    ctx.scale(2, 2);
    ctx.strokeStyle = '#1a2740';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, [step]);

  const getPos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const t = e.touches ? e.touches[0] : e;
    return { x: t.clientX - rect.left, y: t.clientY - rect.top };
  };

  const startDraw = (e) => {
    e.preventDefault();
    setDrawing(true);
    const ctx = canvasRef.current.getContext('2d');
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  };
  const draw = (e) => {
    if (!drawing) return;
    e.preventDefault();
    const ctx = canvasRef.current.getContext('2d');
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    setHasSig(true);
  };
  const endDraw = () => setDrawing(false);
  const clearSig = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSig(false);
  };

  // ── Submeter ──
  const submit = async () => {
    if (!hasSig) return alert('Por favor, assine o contrato antes de enviar.');
    setSending(true);
    try {
      // Converter canvas para blob
      const canvas = canvasRef.current;
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));

      const fd = new FormData();
      fd.append('dados', JSON.stringify(form));
      fd.append('assinatura', blob, 'assinatura.png');
      for (const [key, file] of Object.entries(files)) {
        if (file) fd.append(key, file);
      }

      const res = await fetch(`${API}/cadastro-motorista/${token}`, {
        method: 'POST',
        body: fd,
      });
      const data = await res.json();
      if (data.success) setSent(true);
      else alert(data.error || 'Erro ao enviar');
    } catch (e) {
      alert('Erro ao enviar: ' + e.message);
    }
    setSending(false);
  };

  // ── Estilos ──
  const styles = {
    container: { minHeight:'100vh', background:'#f0f2f5', fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif' },
    card: { maxWidth:640, margin:'0 auto', padding:'0 16px' },
    header: { background:'linear-gradient(135deg,#1a2740 0%,#2563eb 100%)', color:'#fff', padding:'32px 24px', textAlign:'center', marginBottom:24 },
    logo: { fontSize:22, fontWeight:700, marginBottom:4 },
    subtitle: { fontSize:13, opacity:0.8 },
    stepCard: { background:'#fff', borderRadius:12, padding:24, marginBottom:16, boxShadow:'0 1px 3px rgba(0,0,0,.08)' },
    label: { display:'block', fontSize:12, fontWeight:600, color:'#4a5568', marginBottom:4, marginTop:12 },
    input: { width:'100%', padding:'10px 12px', border:'1px solid #d1d5db', borderRadius:8, fontSize:14, fontFamily:'inherit', boxSizing:'border-box', outline:'none' },
    grid2: { display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0 16px' },
    btn: { padding:'12px 24px', borderRadius:10, border:'none', fontSize:14, fontWeight:600, cursor:'pointer', fontFamily:'inherit', transition:'all .15s' },
    btnPrimary: { background:'#2563eb', color:'#fff' },
    btnGhost: { background:'#f3f4f6', color:'#374151' },
    stepDots: { display:'flex', justifyContent:'center', gap:8, marginBottom:20 },
    dot: (active) => ({ width:10, height:10, borderRadius:'50%', background: active ? '#2563eb' : '#d1d5db', transition:'all .2s' }),
    fileBtn: { display:'flex', alignItems:'center', gap:8, padding:'10px 14px', border:'2px dashed #d1d5db', borderRadius:8, cursor:'pointer', fontSize:13, color:'#6b7280', background:'#fafafa', width:'100%', boxSizing:'border-box' },
    fileOk: { borderColor:'#22c55e', background:'#f0fdf4', color:'#15803d' },
  };

  if (status === 'loading') return (
    <div style={{...styles.container, display:'flex', alignItems:'center', justifyContent:'center'}}>
      <div style={{textAlign:'center'}}>
        <div style={{width:40,height:40,border:'3px solid #e5e7eb',borderTopColor:'#2563eb',borderRadius:'50%',animation:'spin .7s linear infinite',margin:'0 auto 12px'}}/>
        <div style={{fontSize:14,color:'#6b7280'}}>Verificando convite...</div>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    </div>
  );

  if (status !== 'valid' && !sent) return (
    <div style={{...styles.container, display:'flex', alignItems:'center', justifyContent:'center'}}>
      <div style={{textAlign:'center', padding:40, background:'#fff', borderRadius:16, boxShadow:'0 2px 8px rgba(0,0,0,.1)', maxWidth:400, margin:16}}>
        <div style={{fontSize:48, marginBottom:16}}>{status === 'filled' ? '✅' : status === 'expired' ? '⏰' : '❌'}</div>
        <h2 style={{fontSize:18, marginBottom:8, color:'#1a2740'}}>
          {status === 'filled' ? 'Formulário já preenchido' : status === 'expired' ? 'Convite expirado' : 'Link inválido'}
        </h2>
        <p style={{fontSize:14, color:'#6b7280'}}>
          {status === 'filled' ? 'Este cadastro já foi enviado com sucesso.' : status === 'expired' ? 'Solicite um novo link de convite.' : 'Verifique o link recebido ou solicite um novo.'}
        </p>
      </div>
    </div>
  );

  if (sent) return (
    <div style={{...styles.container, display:'flex', alignItems:'center', justifyContent:'center'}}>
      <div style={{textAlign:'center', padding:40, background:'#fff', borderRadius:16, boxShadow:'0 2px 8px rgba(0,0,0,.1)', maxWidth:400, margin:16}}>
        <div style={{fontSize:48, marginBottom:16}}>✅</div>
        <h2 style={{fontSize:18, marginBottom:8, color:'#1a2740'}}>Cadastro enviado!</h2>
        <p style={{fontSize:14, color:'#6b7280'}}>Seus dados e documentos foram recebidos com sucesso. Entraremos em contato em breve.</p>
      </div>
    </div>
  );

  const stepTitles = ['Dados Pessoais', 'Dados da Empresa', 'Veículo', 'Dados Bancários', 'Contrato e Assinatura'];

  const FileInput = ({ field, label }) => {
    const hasFile = !!files[field];
    return (
      <div>
        <label style={styles.label}>{label} *</label>
        <label style={{...styles.fileBtn, ...(hasFile ? styles.fileOk : {})}}>
          <span>{hasFile ? `✓ ${files[field].name}` : '📎 Selecionar arquivo (PDF, JPG, PNG)'}</span>
          <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" style={{display:'none'}}
            onChange={e => setFiles(f => ({...f, [field]: e.target.files[0]}))} />
        </label>
      </div>
    );
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.logo}>LogiSystem</div>
        <div style={styles.subtitle}>Cadastro de Motorista {nomeConvite ? `— ${nomeConvite}` : ''}</div>
      </div>

      <div style={styles.card}>
        {/* Step dots */}
        <div style={styles.stepDots}>
          {stepTitles.map((_, i) => <div key={i} style={styles.dot(i <= step)} />)}
        </div>

        <div style={{fontSize:15, fontWeight:600, color:'#1a2740', marginBottom:16, textAlign:'center'}}>
          {step + 1}. {stepTitles[step]}
        </div>

        {/* STEP 0: Dados PF */}
        {step === 0 && (
          <div style={styles.stepCard}>
            <div style={styles.grid2}>
              <div style={{gridColumn:'span 2'}}>
                <label style={styles.label}>Nome Completo *</label>
                <input style={styles.input} value={form.nome||''} onChange={e=>set('nome',e.target.value)} placeholder="Nome completo" />
              </div>
              <div>
                <label style={styles.label}>CPF *</label>
                <input style={styles.input} value={form.cpf||''} onChange={e=>set('cpf',maskCPF(e.target.value))} placeholder="000.000.000-00" />
              </div>
              <div>
                <label style={styles.label}>RG *</label>
                <input style={styles.input} value={form.rg||''} onChange={e=>set('rg',e.target.value)} placeholder="RG" />
              </div>
              <div>
                <label style={styles.label}>Nº CNH *</label>
                <input style={styles.input} value={form.cnh_numero||''} onChange={e=>set('cnh_numero',e.target.value)} placeholder="Número da CNH" />
              </div>
              <div>
                <label style={styles.label}>Categoria CNH *</label>
                <select style={styles.input} value={form.cnh_categoria||''} onChange={e=>set('cnh_categoria',e.target.value)}>
                  <option value="">Selecione</option>
                  {['A','B','C','D','E','AB','AC','AD','AE'].map(c=><option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={styles.label}>Validade CNH *</label>
                <input type="date" style={styles.input} value={form.cnh_validade||''} onChange={e=>set('cnh_validade',e.target.value)} />
              </div>
              <div>
                <label style={styles.label}>Telefone *</label>
                <input style={styles.input} value={form.telefone||''} onChange={e=>set('telefone',maskTel(e.target.value))} placeholder="(11) 99999-0000" />
              </div>
              <div style={{gridColumn:'span 2'}}>
                <label style={styles.label}>Email</label>
                <input type="email" style={styles.input} value={form.email||''} onChange={e=>set('email',e.target.value)} placeholder="email@exemplo.com" />
              </div>
              <div style={{gridColumn:'span 2'}}>
                <label style={styles.label}>Endereço *</label>
                <input style={styles.input} value={form.endereco||''} onChange={e=>set('endereco',e.target.value)} placeholder="Rua, número" />
              </div>
              <div>
                <label style={styles.label}>Bairro</label>
                <input style={styles.input} value={form.bairro||''} onChange={e=>set('bairro',e.target.value)} />
              </div>
              <div>
                <label style={styles.label}>Cidade *</label>
                <input style={styles.input} value={form.cidade||''} onChange={e=>set('cidade',e.target.value)} />
              </div>
              <div>
                <label style={styles.label}>Estado *</label>
                <select style={styles.input} value={form.estado||''} onChange={e=>set('estado',e.target.value)}>
                  <option value="">UF</option>
                  {['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'].map(u=><option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div>
                <label style={styles.label}>CEP</label>
                <input style={styles.input} value={form.cep||''} onChange={e=>set('cep',maskCEP(e.target.value))} placeholder="00000-000" />
              </div>
            </div>
          </div>
        )}

        {/* STEP 1: Dados PJ */}
        {step === 1 && (
          <div style={styles.stepCard}>
            <div style={styles.grid2}>
              <div style={{gridColumn:'span 2'}}>
                <label style={styles.label}>Razão Social *</label>
                <input style={styles.input} value={form.razao_social||''} onChange={e=>set('razao_social',e.target.value)} placeholder="Razão social da empresa" />
              </div>
              <div>
                <label style={styles.label}>CNPJ *</label>
                <input style={styles.input} value={form.cnpj||''} onChange={e=>set('cnpj',maskCNPJ(e.target.value))} placeholder="00.000.000/0000-00" />
              </div>
              <div>
                <label style={styles.label}>Data de Abertura *</label>
                <input type="date" style={styles.input} value={form.data_abertura||''} onChange={e=>set('data_abertura',e.target.value)} />
              </div>
              <div style={{gridColumn:'span 2'}}>
                <label style={styles.label}>Endereço PJ *</label>
                <input style={styles.input} value={form.endereco_pj||''} onChange={e=>set('endereco_pj',e.target.value)} placeholder="Endereço da empresa" />
              </div>
              <div>
                <label style={styles.label}>Bairro</label>
                <input style={styles.input} value={form.bairro_pj||''} onChange={e=>set('bairro_pj',e.target.value)} />
              </div>
              <div>
                <label style={styles.label}>Cidade *</label>
                <input style={styles.input} value={form.cidade_pj||''} onChange={e=>set('cidade_pj',e.target.value)} />
              </div>
              <div>
                <label style={styles.label}>Estado *</label>
                <select style={styles.input} value={form.estado_pj||''} onChange={e=>set('estado_pj',e.target.value)}>
                  <option value="">UF</option>
                  {['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'].map(u=><option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div>
                <label style={styles.label}>CEP</label>
                <input style={styles.input} value={form.cep_pj||''} onChange={e=>set('cep_pj',maskCEP(e.target.value))} placeholder="00000-000" />
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: Veículo */}
        {step === 2 && (
          <div style={styles.stepCard}>
            <div style={styles.grid2}>
              <div>
                <label style={styles.label}>Placa *</label>
                <input style={styles.input} value={form.veiculo_placa||''} onChange={e=>set('veiculo_placa',maskPlaca(e.target.value))} placeholder="ABC1D23" />
              </div>
              <div>
                <label style={styles.label}>Modelo *</label>
                <input style={styles.input} value={form.veiculo_modelo||''} onChange={e=>set('veiculo_modelo',e.target.value)} placeholder="Ex: VW Constellation" />
              </div>
              <div>
                <label style={styles.label}>Ano *</label>
                <input style={styles.input} value={form.veiculo_ano||''} onChange={e=>set('veiculo_ano',e.target.value.replace(/\D/g,'').slice(0,4))} placeholder="2024" />
              </div>
              <div>
                <label style={styles.label}>RNTRC (ANTT) *</label>
                <input style={styles.input} value={form.veiculo_rntrc||''} onChange={e=>set('veiculo_rntrc',e.target.value)} placeholder="Nº RNTRC" />
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: Dados Bancários */}
        {step === 3 && (
          <div style={styles.stepCard}>
            <div style={styles.grid2}>
              <div style={{gridColumn:'span 2'}}>
                <label style={styles.label}>Banco *</label>
                <input style={styles.input} value={form.banco||''} onChange={e=>set('banco',e.target.value)} placeholder="Ex: Bradesco, Itaú, Nubank..." />
              </div>
              <div>
                <label style={styles.label}>Agência</label>
                <input style={styles.input} value={form.agencia||''} onChange={e=>set('agencia',e.target.value)} placeholder="0000" />
              </div>
              <div>
                <label style={styles.label}>Conta</label>
                <input style={styles.input} value={form.conta||''} onChange={e=>set('conta',e.target.value)} placeholder="00000-0" />
              </div>
              <div>
                <label style={styles.label}>Tipo de Conta</label>
                <select style={styles.input} value={form.tipo_conta||''} onChange={e=>set('tipo_conta',e.target.value)}>
                  <option value="">Selecione</option>
                  <option value="corrente">Corrente</option>
                  <option value="poupanca">Poupança</option>
                </select>
              </div>
              <div>
                <label style={styles.label}>Chave PIX *</label>
                <input style={styles.input} value={form.pix||''} onChange={e=>set('pix',e.target.value)} placeholder="CPF, CNPJ, email, telefone ou aleatória" />
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: Documentos + Contrato + Assinatura */}
        {step === 4 && (
          <div>
            <div style={styles.stepCard}>
              <h3 style={{fontSize:14, fontWeight:600, marginBottom:16, color:'#1a2740'}}>Upload de Documentos</h3>
              <div style={{display:'grid', gap:12}}>
                <FileInput field="cnh" label="CNH (frente e verso)" />
                <FileInput field="cnpj_contrato_social" label="Cartão CNPJ / Contrato Social" />
                <FileInput field="rntrc" label="RNTRC (ANTT)" />
                <FileInput field="comprovante_endereco" label="Comprovante de Endereço" />
              </div>
            </div>

            <div style={styles.stepCard}>
              <h3 style={{fontSize:14, fontWeight:600, marginBottom:8, color:'#1a2740'}}>Contrato de Prestação de Serviços</h3>
              <div style={{background:'#f8f9fa', borderRadius:8, padding:16, maxHeight:300, overflow:'auto', fontSize:11, color:'#4a5568', lineHeight:1.6, marginBottom:16, border:'1px solid #e5e7eb'}}>
                <p><strong>CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE TRANSPORTE</strong></p>
                <p>Pelo presente instrumento particular, de um lado a <strong>CONTRATANTE</strong> e de outro o <strong>CONTRATADO</strong> ({form.razao_social || form.nome || '—'}), CNPJ: {form.cnpj || '—'}, têm entre si justo e contratado:</p>
                <p><strong>CLÁUSULA 1 – DO OBJETO</strong><br/>Prestação de serviços de transporte rodoviário de cargas pelo CONTRATADO, com fornecimento de veículo próprio e mão de obra, conforme demanda da CONTRATANTE, sem exclusividade.</p>
                <p><strong>CLÁUSULA 2 – DAS OBRIGAÇÕES</strong><br/>Conferir a carga, zelar pela integridade, arcar com despesas do veículo, manter-se inscrito no RNTRC.</p>
                <p><strong>CLÁUSULA 3 – HORÁRIOS</strong><br/>Segunda a sábado, nos locais e horários definidos pela CONTRATANTE.</p>
                <p><strong>CLÁUSULA 4 – REMUNERAÇÃO</strong><br/>Calculada pela tabela de frete vigente. Pagamento quinzenal.</p>
                <p><strong>CLÁUSULA 5 – VÍNCULO</strong><br/>Contrato de natureza civil e autônoma, sem vínculo empregatício.</p>
                <p><strong>CLÁUSULAS 6 a 16</strong><br/>Exigências fiscais, responsabilidade, sigilo, caso fortuito, responsabilidade pela carga, não concorrência (12 meses), penalidades (100% dos últimos 3 meses), LGPD, ausência de subordinação, multiplicidade de tomadores, foro de Barueri/SP.</p>
                <p style={{marginTop:12}}><em>Ao assinar abaixo, declaro que li e concordo com todos os termos deste contrato.</em></p>
              </div>

              <h3 style={{fontSize:14, fontWeight:600, marginBottom:8, color:'#1a2740'}}>Assinatura</h3>
              <p style={{fontSize:12, color:'#6b7280', marginBottom:8}}>Desenhe sua assinatura no campo abaixo:</p>
              <div style={{border:'2px solid #d1d5db', borderRadius:8, overflow:'hidden', position:'relative', background:'#fff', touchAction:'none'}}>
                <canvas
                  ref={canvasRef}
                  style={{width:'100%', height:150, display:'block', cursor:'crosshair'}}
                  onMouseDown={startDraw} onMouseMove={draw} onMouseUp={endDraw} onMouseLeave={endDraw}
                  onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={endDraw}
                />
                {!hasSig && (
                  <div style={{position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', color:'#d1d5db', fontSize:14, pointerEvents:'none'}}>
                    Assine aqui
                  </div>
                )}
              </div>
              <button onClick={clearSig} style={{...styles.btn, ...styles.btnGhost, marginTop:8, padding:'6px 16px', fontSize:12}}>Limpar assinatura</button>
            </div>
          </div>
        )}

        {/* Navegação */}
        <div style={{display:'flex', justifyContent:'space-between', marginBottom:40, marginTop:8}}>
          {step > 0 ? (
            <button style={{...styles.btn, ...styles.btnGhost}} onClick={()=>setStep(s=>s-1)}>← Anterior</button>
          ) : <div/>}
          {step < 4 ? (
            <button style={{...styles.btn, ...styles.btnPrimary}} onClick={()=>setStep(s=>s+1)}>Próximo →</button>
          ) : (
            <button
              style={{...styles.btn, ...styles.btnPrimary, opacity: sending ? 0.6 : 1}}
              onClick={submit}
              disabled={sending}
            >
              {sending ? 'Enviando...' : '✓ Enviar Cadastro'}
            </button>
          )}
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg) } } * { box-sizing: border-box; margin: 0; }`}</style>
    </div>
  );
}
