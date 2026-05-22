import { useState, useRef, useEffect } from 'react';

const API = 'https://api.wsdevsoft.com/api';

/* ── Helpers ── */
const maskCPF = v => v.replace(/\D/g,'').replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d{1,2})$/,'$1-$2').slice(0,14);
const maskCNPJ = v => v.replace(/\D/g,'').replace(/^(\d{2})(\d)/,'$1.$2').replace(/^(\d{2})\.(\d{3})(\d)/,'$1.$2.$3').replace(/\.(\d{3})(\d)/,'.$1/$2').replace(/(\d{4})(\d)/,'$1-$2').slice(0,18);
const maskTel = v => { const d=v.replace(/\D/g,''); if(d.length<=10) return d.replace(/(\d{2})(\d)/,'($1) $2').replace(/(\d{4})(\d)/,'$1-$2'); return d.replace(/(\d{2})(\d)/,'($1) $2').replace(/(\d{5})(\d)/,'$1-$2').slice(0,15); };
const maskCEP = v => v.replace(/\D/g,'').replace(/(\d{5})(\d)/,'$1-$2').slice(0,9);
const maskPlaca = v => v.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,7);

async function buscaCEP(cep) {
  const clean = cep.replace(/\D/g, '');
  if (clean.length !== 8) return null;
  try {
    const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
    const data = await res.json();
    if (data.erro) return null;
    return {
      endereco: data.logradouro || '',
      bairro: data.bairro || '',
      cidade: data.localidade || '',
      estado: data.uf || '',
    };
  } catch { return null; }
}

export default function CadastroMotoristaPublico() {
  const token = window.location.pathname.split('/cadastro-motorista/')[1];
  const [status, setStatus] = useState('loading');
  const [nomeConvite, setNomeConvite] = useState('');
  const [parametros, setParametros] = useState({});
  const [catalogo, setCatalogo] = useState({ campos: [], passos: [] });
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({});
  const [files, setFiles] = useState({});
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [buscandoCep, setBuscandoCep] = useState('');
  const canvasRef = useRef(null);
  const [drawing, setDrawing] = useState(false);
  const [hasSig, setHasSig] = useState(false);

  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  const isReq    = (chave) => parametros[chave] === 'obrigatorio';
  const isHidden = (chave) => parametros[chave] === 'oculto';
  const mark     = (label, chave) => isReq(chave) ? `${label} *` : label;

  const handleCEP = async (cepValue, prefix) => {
    const cepField = prefix ? `cep_${prefix}` : 'cep';
    set(cepField, maskCEP(cepValue));
    const clean = cepValue.replace(/\D/g, '');
    if (clean.length === 8) {
      setBuscandoCep(cepField);
      const dados = await buscaCEP(clean);
      if (dados) {
        if (prefix) {
          set(`endereco_${prefix}`, dados.endereco);
          set(`bairro_${prefix}`, dados.bairro);
          set(`cidade_${prefix}`, dados.cidade);
          set(`estado_${prefix}`, dados.estado);
        } else {
          set('endereco', dados.endereco);
          set('bairro', dados.bairro);
          set('cidade', dados.cidade);
          set('estado', dados.estado);
        }
      }
      setBuscandoCep('');
    }
  };

  useEffect(() => {
    if (!token) { setStatus('error'); return; }
    fetch(`${API}/cadastro-motorista/${token}`)
      .then(r => r.json())
      .then(d => {
        if (d.valid) {
          setStatus('valid');
          setNomeConvite(d.nome_motorista || '');
          setParametros(d.parametros || {});
          setCatalogo(d.catalogo || { campos: [], passos: [] });
        }
        else if (d.error?.includes('preenchido')) setStatus('filled');
        else if (d.error?.includes('expirou')) setStatus('expired');
        else setStatus('error');
      })
      .catch(() => setStatus('error'));
  }, [token]);

  useEffect(() => {
    if (step !== 4) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = '#1a2740'; ctx.lineWidth = 2; ctx.lineCap = 'round';
  }, [step]);

  const getPos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const sx = canvas.width / rect.width;
    const sy = canvas.height / rect.height;
    const t = e.touches?.[0];
    const x = (t ? t.clientX : e.clientX) - rect.left;
    const y = (t ? t.clientY : e.clientY) - rect.top;
    return { x: x * sx, y: y * sy };
  };
  const startDraw = (e) => { e.preventDefault(); const { x, y } = getPos(e); const ctx = canvasRef.current.getContext('2d'); ctx.beginPath(); ctx.moveTo(x, y); setDrawing(true); };
  const draw = (e) => { if (!drawing) return; e.preventDefault(); const { x, y } = getPos(e); const ctx = canvasRef.current.getContext('2d'); ctx.lineTo(x, y); ctx.stroke(); setHasSig(true); };
  const endDraw = () => setDrawing(false);
  const clearSig = () => { const canvas = canvasRef.current; const ctx = canvas.getContext('2d'); ctx.clearRect(0, 0, canvas.width, canvas.height); setHasSig(false); };

  const camposVisiveis = (passoId) =>
    (catalogo.campos || []).filter(c => c.passo === passoId && !isHidden(c.chave));

  const passosVisiveis = () => {
    const arr = [];
    for (const p of (catalogo.passos || [])) {
      if (p.id === 4) { arr.push(p); continue; }
      if (camposVisiveis(p.id).length > 0) arr.push(p);
    }
    return arr;
  };

  const proxStep = () => {
    const ehSimples = form.tipo_colaborador === 'ajudante' || form.tipo_colaborador === 'administrativo';
    if (ehSimples && step === 0) return 4;
    let n = step + 1;
    while (n < 4 && camposVisiveis(n).length === 0) n++;
    return n;
  };
  const antStep = () => {
    const ehSimples = form.tipo_colaborador === 'ajudante' || form.tipo_colaborador === 'administrativo';
    if (ehSimples && step === 4) return 0;
    let n = step - 1;
    while (n > 0 && camposVisiveis(n).length === 0) n--;
    return Math.max(0, n);
  };

  const submit = async () => {
    const ehSimples = form.tipo_colaborador === 'ajudante' || form.tipo_colaborador === 'administrativo';
    for (const c of (catalogo.campos || [])) {
      if (!isReq(c.chave) || isHidden(c.chave)) continue;
      if (ehSimples && c.passo > 0 && c.passo < 4) continue;
      let preenchido;
      if (c.tipo === 'arquivo') {
        const fieldName = c.chave.replace(/^doc_/, '');
        preenchido = !!files[fieldName];
      } else {
        const v = form[c.chave];
        preenchido = v != null && String(v).trim() !== '';
      }
      if (!preenchido) return alert(`${c.label} é obrigatório.`);
    }

    if (!hasSig) return alert('Por favor, assine o contrato antes de enviar.');

    setSending(true);
    try {
      const canvas = canvasRef.current;
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      const fd = new FormData();
      fd.append('dados', JSON.stringify(form));
      fd.append('assinatura', blob, 'assinatura.png');

      // Calcula tamanho total dos arquivos para alertar conexão lenta
      let totalMB = blob.size / 1024 / 1024;
      for (const [key, file] of Object.entries(files)) {
        if (file) {
          fd.append(key, file);
          totalMB += file.size / 1024 / 1024;
        }
      }

      // Avisa caso seja envio grande (provável fonte de timeout em 3G/4G fraco)
      if (totalMB > 5) {
        const ok = confirm(`Você está enviando aproximadamente ${totalMB.toFixed(1)}MB de arquivos.\nEm conexões fracas o envio pode demorar ou falhar.\n\nDeseja continuar?`);
        if (!ok) { setSending(false); return; }
      }

      // Timeout de 90s para evitar travar pra sempre
      const ctrl = new AbortController();
      const timeoutId = setTimeout(() => ctrl.abort(), 90000);

      let res;
      try {
        res = await fetch(`${API}/cadastro-motorista/${token}`, {
          method: 'POST',
          body: fd,
          signal: ctrl.signal,
        });
      } finally {
        clearTimeout(timeoutId);
      }

      // Trata resposta — pode não ser JSON em alguns casos de erro do servidor/proxy
      let data;
      try { data = await res.json(); }
      catch { data = null; }

      if (res.ok && data?.success) {
        setSent(true);
      } else if (data?.error) {
        alert('Não foi possível enviar: ' + data.error);
      } else if (res.status >= 500) {
        alert(`Servidor não respondeu corretamente (HTTP ${res.status}).\nTente novamente em alguns instantes.`);
      } else if (res.status === 413) {
        alert('Arquivos muito grandes. Reduza o tamanho ou envie menos anexos.');
      } else {
        alert(`Erro ao enviar (HTTP ${res.status}). Tente novamente.`);
      }
    } catch (e) {
      if (e.name === 'AbortError') {
        alert('O envio demorou muito (mais de 1min30s) e foi cancelado.\nVerifique sua conexão de internet e tente novamente. Se possível, conecte-se ao Wi-Fi.');
      } else if (e.message === 'Failed to fetch' || /network/i.test(e.message)) {
        alert('Falha de conexão com o servidor.\nPossíveis causas:\n• Internet instável (tente Wi-Fi)\n• Arquivos muito grandes\n\nTente novamente.');
      } else {
        alert('Erro ao enviar: ' + e.message);
      }
    }
    setSending(false);
  };

  const s = {
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
    cepLoading: { fontSize:11, color:'#2563eb', marginTop:2 },
  };

  if (status === 'loading') return (
    <div style={{...s.container, display:'flex', alignItems:'center', justifyContent:'center'}}>
      <div style={{textAlign:'center'}}>
        <div style={{width:40,height:40,border:'3px solid #e5e7eb',borderTopColor:'#2563eb',borderRadius:'50%',animation:'spin .7s linear infinite',margin:'0 auto 12px'}}/>
        <div style={{fontSize:14,color:'#6b7280'}}>Verificando convite...</div>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    </div>
  );

  if (status !== 'valid' && !sent) return (
    <div style={{...s.container, display:'flex', alignItems:'center', justifyContent:'center'}}>
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
    <div style={{...s.container, display:'flex', alignItems:'center', justifyContent:'center'}}>
      <div style={{textAlign:'center', padding:40, background:'#fff', borderRadius:16, boxShadow:'0 2px 8px rgba(0,0,0,.1)', maxWidth:400, margin:16}}>
        <div style={{fontSize:48, marginBottom:16}}>✅</div>
        <h2 style={{fontSize:18, marginBottom:8, color:'#1a2740'}}>Cadastro enviado!</h2>
        <p style={{fontSize:14, color:'#6b7280'}}>Seus dados e documentos foram recebidos com sucesso. Entraremos em contato em breve.</p>
      </div>
    </div>
  );

  // Comprime imagem grande via canvas: reduz para máximo 1600px no maior lado e qualidade 0.75
  // Retorna File. PDFs e arquivos pequenos passam direto.
  const compressImage = (file) => new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) return resolve(file);
    // Imagens pequenas (<1MB) não precisam comprimir
    if (file.size < 1024 * 1024) return resolve(file);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const MAX_DIM = 1600;
        let { width: w, height: h } = img;
        if (w > MAX_DIM || h > MAX_DIM) {
          if (w >= h) { h = Math.round(h * MAX_DIM / w); w = MAX_DIM; }
          else        { w = Math.round(w * MAX_DIM / h); h = MAX_DIM; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        canvas.toBlob((blob) => {
          if (!blob) return reject(new Error('Falha ao comprimir imagem'));
          // Mantém o nome original com extensão .jpg
          const nomeBase = file.name.replace(/\.(jpe?g|png|webp|heic|heif)$/i, '');
          const novoArquivo = new File([blob], `${nomeBase}.jpg`, { type: 'image/jpeg' });
          resolve(novoArquivo);
        }, 'image/jpeg', 0.75);
      };
      img.onerror = () => reject(new Error('Falha ao carregar imagem'));
      img.src = ev.target.result;
    };
    reader.onerror = () => reject(new Error('Falha ao ler arquivo'));
    reader.readAsDataURL(file);
  });

  const FileInput = ({ field, label }) => {
    const hasFile = !!files[field];
    const [processando, setProcessando] = useState(false);
    const handleFile = async (e) => {
      const f = e.target.files[0];
      if (!f) return;
      try {
        setProcessando(true);
        // Comprime se for imagem grande
        const arquivoFinal = await compressImage(f);
        // Validação de tamanho final (após compressão)
        const MAX_MB = 8;
        if (arquivoFinal.size > MAX_MB * 1024 * 1024) {
          alert(`Arquivo ainda muito grande após compressão: ${(arquivoFinal.size/1024/1024).toFixed(1)}MB.\nO limite é ${MAX_MB}MB. Por favor, tire uma foto com qualidade menor ou comprima o PDF.`);
          e.target.value = '';
          return;
        }
        setFiles(prev => ({...prev, [field]: arquivoFinal}));
      } catch (err) {
        alert('Erro ao processar arquivo: ' + err.message);
      } finally {
        setProcessando(false);
      }
    };
    return (
      <div>
        <label style={s.label}>{label}</label>
        <label style={{...s.fileBtn, ...(hasFile ? s.fileOk : {}), ...(processando ? { opacity: 0.6, pointerEvents: 'none' } : {})}}>
          <span>
            {processando ? '⏳ Processando imagem...' :
             hasFile ? `✓ ${files[field].name} (${(files[field].size/1024/1024).toFixed(1)}MB)` :
             '📎 Selecionar arquivo (PDF, JPG, PNG)'}
          </span>
          <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" style={{display:'none'}}
            onChange={handleFile} disabled={processando} />
        </label>
      </div>
    );
  };

  const CepHint = ({ field }) => buscandoCep === field ? <span style={s.cepLoading}>Buscando CEP...</span> : null;

  const passosVis = passosVisiveis();
  const stepIndexNoArray = passosVis.findIndex(p => p.id === step);
  const stepTitle = passosVis.find(p => p.id === step)?.titulo || '';

  return (
    <div style={s.container}>
      <div style={s.header}>
        <div style={s.logo}>LogiSystem</div>
        <div style={s.subtitle}>Cadastro de Colaborador {nomeConvite ? `— ${nomeConvite}` : ''}</div>
      </div>

      <div style={s.card}>
        <div style={s.stepDots}>
          {passosVis.map((p, i) => <div key={p.id} style={s.dot(i <= stepIndexNoArray)} />)}
        </div>
        <div style={{fontSize:15, fontWeight:600, color:'#1a2740', marginBottom:16, textAlign:'center'}}>
          {stepIndexNoArray + 1}. {stepTitle}
        </div>

        {step === 0 && (
          <div style={s.stepCard}>
            <div style={s.grid2}>
              {!isHidden('tipo_colaborador') && (
                <div style={{gridColumn:'span 2'}}>
                  <label style={s.label}>{mark('Tipo de Colaborador','tipo_colaborador')}</label>
                  <select style={s.input} value={form.tipo_colaborador||''} onChange={e=>set('tipo_colaborador', e.target.value)}>
                    <option value="">— Selecione —</option>
                    <option value="motorista_proprio">🏠 Motorista Próprio</option>
                    <option value="motorista_terceiro">🚚 Motorista Terceiro</option>
                    <option value="carreteiro">🚛 Carreteiro (Carro / Carreta)</option>
                    <option value="ajudante">👷 Ajudante</option>
                    <option value="administrativo">💼 Administrativo</option>
                  </select>
                  {(form.tipo_colaborador === 'ajudante' || form.tipo_colaborador === 'administrativo') && (
                    <div style={{fontSize:12, color:'#16a34a', marginTop:6, padding:8, background:'#f0fdf4', borderRadius:6}}>
                      ℹ️ Para esse tipo, só precisamos dos dados pessoais. As demais etapas serão puladas.
                    </div>
                  )}
                </div>
              )}
              {!isHidden('nome') && (
                <div style={{gridColumn:'span 2'}}>
                  <label style={s.label}>{mark('Nome Completo','nome')}</label>
                  <input style={s.input} value={form.nome||''} onChange={e=>set('nome',e.target.value)} placeholder="Nome completo" />
                </div>
              )}
              {!isHidden('cpf') && (
                <div><label style={s.label}>{mark('CPF','cpf')}</label>
                  <input style={s.input} value={form.cpf||''} onChange={e=>set('cpf',maskCPF(e.target.value))} placeholder="000.000.000-00" /></div>
              )}
              {!isHidden('rg') && (
                <div><label style={s.label}>{mark('RG','rg')}</label>
                  <input style={s.input} value={form.rg||''} onChange={e=>set('rg',e.target.value)} placeholder="RG" /></div>
              )}
              {!isHidden('cnh_numero') && (
                <div><label style={s.label}>{mark('Nº CNH','cnh_numero')}</label>
                  <input style={s.input} value={form.cnh_numero||''} onChange={e=>set('cnh_numero',e.target.value)} placeholder="Número da CNH" /></div>
              )}
              {!isHidden('cnh_categoria') && (
                <div><label style={s.label}>{mark('Categoria CNH','cnh_categoria')}</label>
                  <select style={s.input} value={form.cnh_categoria||''} onChange={e=>set('cnh_categoria',e.target.value)}>
                    <option value="">Selecione</option>
                    {['A','B','C','D','E','AB','AC','AD','AE'].map(c=><option key={c} value={c}>{c}</option>)}
                  </select></div>
              )}
              {!isHidden('cnh_validade') && (
                <div><label style={s.label}>{mark('Validade CNH','cnh_validade')}</label>
                  <input type="date" style={s.input} value={form.cnh_validade||''} onChange={e=>set('cnh_validade',e.target.value)} /></div>
              )}
              {!isHidden('telefone') && (
                <div><label style={s.label}>{mark('Telefone','telefone')}</label>
                  <input style={s.input} value={form.telefone||''} onChange={e=>set('telefone',maskTel(e.target.value))} placeholder="(11) 99999-0000" /></div>
              )}
              {!isHidden('email') && (
                <div style={{gridColumn:'span 2'}}><label style={s.label}>{mark('Email','email')}</label>
                  <input type="email" style={s.input} value={form.email||''} onChange={e=>set('email',e.target.value)} placeholder="email@exemplo.com" /></div>
              )}
              {!isHidden('cep') && (
                <div><label style={s.label}>{mark('CEP','cep')}</label>
                  <input style={s.input} value={form.cep||''} onChange={e=>handleCEP(e.target.value, '')} placeholder="00000-000" />
                  <CepHint field="cep" /></div>
              )}
              {!isHidden('estado') && (
                <div><label style={s.label}>{mark('Estado','estado')}</label>
                  <select style={s.input} value={form.estado||''} onChange={e=>set('estado',e.target.value)}>
                    <option value="">UF</option>
                    {['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'].map(u=><option key={u} value={u}>{u}</option>)}
                  </select></div>
              )}
              {!isHidden('endereco') && (
                <div style={{gridColumn:'span 2'}}><label style={s.label}>{mark('Endereço','endereco')}</label>
                  <input style={s.input} value={form.endereco||''} onChange={e=>set('endereco',e.target.value)} placeholder="Rua / Avenida" /></div>
              )}
              {!isHidden('numero') && (
                <div><label style={s.label}>{mark('Número','numero')}</label>
                  <input style={s.input} value={form.numero||''} onChange={e=>set('numero',e.target.value)} placeholder="Nº" /></div>
              )}
              {!isHidden('complemento') && (
                <div><label style={s.label}>{mark('Complemento','complemento')}</label>
                  <input style={s.input} value={form.complemento||''} onChange={e=>set('complemento',e.target.value)} placeholder="Apto, bloco..." /></div>
              )}
              {!isHidden('bairro') && (
                <div><label style={s.label}>{mark('Bairro','bairro')}</label>
                  <input style={s.input} value={form.bairro||''} onChange={e=>set('bairro',e.target.value)} /></div>
              )}
              {!isHidden('cidade') && (
                <div><label style={s.label}>{mark('Cidade','cidade')}</label>
                  <input style={s.input} value={form.cidade||''} onChange={e=>set('cidade',e.target.value)} /></div>
              )}
            </div>
          </div>
        )}

        {step === 1 && (
          <div style={s.stepCard}>
            <div style={s.grid2}>
              {!isHidden('razao_social') && (
                <div style={{gridColumn:'span 2'}}><label style={s.label}>{mark('Razão Social','razao_social')}</label>
                  <input style={s.input} value={form.razao_social||''} onChange={e=>set('razao_social',e.target.value)} placeholder="Razão social da empresa" /></div>
              )}
              {!isHidden('cnpj') && (
                <div><label style={s.label}>{mark('CNPJ','cnpj')}</label>
                  <input style={s.input} value={form.cnpj||''} onChange={e=>set('cnpj',maskCNPJ(e.target.value))} placeholder="00.000.000/0000-00" /></div>
              )}
              {!isHidden('data_abertura') && (
                <div><label style={s.label}>{mark('Data de Abertura','data_abertura')}</label>
                  <input type="date" style={s.input} value={form.data_abertura||''} onChange={e=>set('data_abertura',e.target.value)} /></div>
              )}
              {!isHidden('cep_pj') && (
                <div><label style={s.label}>{mark('CEP PJ','cep_pj')}</label>
                  <input style={s.input} value={form.cep_pj||''} onChange={e=>handleCEP(e.target.value, 'pj')} placeholder="00000-000" />
                  <CepHint field="cep_pj" /></div>
              )}
              {!isHidden('estado_pj') && (
                <div><label style={s.label}>{mark('Estado PJ','estado_pj')}</label>
                  <select style={s.input} value={form.estado_pj||''} onChange={e=>set('estado_pj',e.target.value)}>
                    <option value="">UF</option>
                    {['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'].map(u=><option key={u} value={u}>{u}</option>)}
                  </select></div>
              )}
              {!isHidden('endereco_pj') && (
                <div style={{gridColumn:'span 2'}}><label style={s.label}>{mark('Endereço PJ','endereco_pj')}</label>
                  <input style={s.input} value={form.endereco_pj||''} onChange={e=>set('endereco_pj',e.target.value)} placeholder="Endereço da empresa" /></div>
              )}
              {!isHidden('numero_pj') && (
                <div><label style={s.label}>{mark('Número PJ','numero_pj')}</label>
                  <input style={s.input} value={form.numero_pj||''} onChange={e=>set('numero_pj',e.target.value)} placeholder="Nº" /></div>
              )}
              {!isHidden('complemento_pj') && (
                <div><label style={s.label}>{mark('Complemento PJ','complemento_pj')}</label>
                  <input style={s.input} value={form.complemento_pj||''} onChange={e=>set('complemento_pj',e.target.value)} placeholder="Sala, conjunto..." /></div>
              )}
              {!isHidden('bairro_pj') && (
                <div><label style={s.label}>{mark('Bairro PJ','bairro_pj')}</label>
                  <input style={s.input} value={form.bairro_pj||''} onChange={e=>set('bairro_pj',e.target.value)} /></div>
              )}
              {!isHidden('cidade_pj') && (
                <div><label style={s.label}>{mark('Cidade PJ','cidade_pj')}</label>
                  <input style={s.input} value={form.cidade_pj||''} onChange={e=>set('cidade_pj',e.target.value)} /></div>
              )}
            </div>
          </div>
        )}

        {step === 2 && (
          <div style={s.stepCard}>
            <div style={s.grid2}>
              {!isHidden('veiculo_placa') && (
                <div><label style={s.label}>{mark('Placa','veiculo_placa')}</label>
                  <input style={s.input} value={form.veiculo_placa||''} onChange={e=>set('veiculo_placa',maskPlaca(e.target.value))} placeholder="ABC1D23" /></div>
              )}
              {!isHidden('veiculo_modelo') && (
                <div><label style={s.label}>{mark('Modelo','veiculo_modelo')}</label>
                  <input style={s.input} value={form.veiculo_modelo||''} onChange={e=>set('veiculo_modelo',e.target.value)} placeholder="Ex: VW Constellation" /></div>
              )}
              {!isHidden('veiculo_ano') && (
                <div><label style={s.label}>{mark('Ano','veiculo_ano')}</label>
                  <input style={s.input} value={form.veiculo_ano||''} onChange={e=>set('veiculo_ano',e.target.value.replace(/\D/g,'').slice(0,4))} placeholder="2024" /></div>
              )}
              {!isHidden('veiculo_rntrc') && (
                <div><label style={s.label}>{mark('RNTRC (ANTT)','veiculo_rntrc')}</label>
                  <input style={s.input} value={form.veiculo_rntrc||''} onChange={e=>set('veiculo_rntrc',e.target.value)} placeholder="Nº RNTRC" /></div>
              )}
            </div>
          </div>
        )}

        {step === 3 && (
          <div style={s.stepCard}>
            <div style={s.grid2}>
              {!isHidden('banco') && (
                <div style={{gridColumn:'span 2'}}><label style={s.label}>{mark('Banco','banco')}</label>
                  <input style={s.input} value={form.banco||''} onChange={e=>set('banco',e.target.value)} placeholder="Ex: Bradesco, Itaú, Nubank..." /></div>
              )}
              {!isHidden('agencia') && (
                <div><label style={s.label}>{mark('Agência','agencia')}</label>
                  <input style={s.input} value={form.agencia||''} onChange={e=>set('agencia',e.target.value)} placeholder="0000" /></div>
              )}
              {!isHidden('conta') && (
                <div><label style={s.label}>{mark('Conta','conta')}</label>
                  <input style={s.input} value={form.conta||''} onChange={e=>set('conta',e.target.value)} placeholder="00000-0" /></div>
              )}
              {!isHidden('tipo_conta') && (
                <div><label style={s.label}>{mark('Tipo de Conta','tipo_conta')}</label>
                  <select style={s.input} value={form.tipo_conta||''} onChange={e=>set('tipo_conta',e.target.value)}>
                    <option value="">Selecione</option>
                    <option value="corrente">Corrente</option>
                    <option value="poupanca">Poupança</option>
                  </select></div>
              )}
              {!isHidden('pix') && (
                <div><label style={s.label}>{mark('Chave PIX','pix')}</label>
                  <input style={s.input} value={form.pix||''} onChange={e=>set('pix',e.target.value)} placeholder="CPF, CNPJ, email, telefone ou aleatória" /></div>
              )}
            </div>
          </div>
        )}

        {step === 4 && (
          <div>
            {(!isHidden('doc_cnh') || !isHidden('doc_cnpj_contrato_social') || !isHidden('doc_rntrc') || !isHidden('doc_comprovante_endereco')) && (
              <div style={s.stepCard}>
                <h3 style={{fontSize:14, fontWeight:600, marginBottom:16, color:'#1a2740'}}>Upload de Documentos</h3>
                <div style={{display:'grid', gap:12}}>
                  {!isHidden('doc_cnh') && <FileInput field="cnh" label={mark('CNH (frente e verso)','doc_cnh')} />}
                  {!isHidden('doc_cnpj_contrato_social') && <FileInput field="cnpj_contrato_social" label={mark('Cartão CNPJ / Contrato Social','doc_cnpj_contrato_social')} />}
                  {!isHidden('doc_rntrc') && <FileInput field="rntrc" label={mark('RNTRC (ANTT)','doc_rntrc')} />}
                  {!isHidden('doc_comprovante_endereco') && <FileInput field="comprovante_endereco" label={mark('Comprovante de Endereço','doc_comprovante_endereco')} />}
                </div>
              </div>
            )}

            <div style={s.stepCard}>
              <h3 style={{fontSize:14, fontWeight:600, marginBottom:8, color:'#1a2740'}}>Contrato de Prestação de Serviços</h3>
              <div style={{background:'#f8f9fa', borderRadius:8, padding:16, maxHeight:300, overflow:'auto', fontSize:11, color:'#4a5568', lineHeight:1.6, marginBottom:16, border:'1px solid #e5e7eb'}}>
                <p><strong>CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE TRANSPORTE</strong></p>
                <p style={{marginTop:8}}>Pelo presente instrumento particular, de um lado a <strong>CONTRATANTE</strong> e de outro o <strong>CONTRATADO</strong> ({form.razao_social || form.nome || '—'}), CNPJ: {form.cnpj || '—'}, têm entre si justo e contratado:</p>
                <p style={{marginTop:8}}><strong>CLÁUSULA 1 – OBJETO</strong><br/>Prestação de serviços de transporte rodoviário de cargas, com veículo próprio.</p>
                <p><strong>CLÁUSULA 2 – DAS OBRIGAÇÕES</strong><br/>Conferir a carga, zelar pela integridade, arcar com despesas do veículo, manter-se inscrito no RNTRC.</p>
                <p><strong>CLÁUSULA 3 – REMUNERAÇÃO</strong><br/>Conforme tabela de frete vigente. Pagamentos quinzenais, por depósito bancário.</p>
                <p><strong>CLÁUSULA 4 – VÍNCULO</strong><br/>Natureza civil e autônoma, sem vínculo empregatício.</p>
                <p style={{marginTop:8, fontStyle:'italic'}}>Ao assinar abaixo, o CONTRATADO declara estar de acordo com todos os termos deste contrato.</p>
              </div>

              <label style={s.label}>Assinatura *</label>
              <div style={{border:'2px solid #d1d5db', borderRadius:8, background:'#fff', position:'relative', touchAction:'none'}}>
                <canvas ref={canvasRef} width={560} height={180} style={{width:'100%', height:'auto', display:'block', cursor:'crosshair'}}
                  onMouseDown={startDraw} onMouseMove={draw} onMouseUp={endDraw} onMouseLeave={endDraw}
                  onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={endDraw} />
                {!hasSig && <div style={{position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', color:'#d1d5db', fontSize:14, pointerEvents:'none'}}>Assine aqui</div>}
              </div>
              <button onClick={clearSig} style={{...s.btn, ...s.btnGhost, marginTop:8, padding:'6px 16px', fontSize:12}}>Limpar assinatura</button>
            </div>
          </div>
        )}

        <div style={{display:'flex', justifyContent:'space-between', marginBottom:40, marginTop:8}}>
          {step > 0 ? (
            <button style={{...s.btn, ...s.btnGhost}} onClick={()=>setStep(antStep())}>← Anterior</button>
          ) : <div/>}
          {step < 4 ? (
            <button style={{...s.btn, ...s.btnPrimary}} onClick={()=>setStep(proxStep())}>Próximo →</button>
          ) : (
            <button style={{...s.btn, ...s.btnPrimary, opacity: sending ? 0.6 : 1}} onClick={submit} disabled={sending}>
              {sending ? 'Enviando...' : '✓ Enviar Cadastro'}
            </button>
          )}
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg) } } * { box-sizing: border-box; margin: 0; }`}</style>
    </div>
  );
}
