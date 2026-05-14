// frontend/src/pages/MobileApp.jsx
// Área do motorista — login + minhas OTs + marcar entrega
// Acessível em /m/* (login) e /m/* (logado). UX mobile-first, botões grandes.
import { useState, useEffect, useRef } from 'react';
import { Routes, Route, Navigate, useNavigate, useParams, useLocation } from 'react-router-dom';

const API = 'https://api.wsdevsoft.com/api';
const STORAGE_TOKEN = 'motorista_token';
const STORAGE_NOME  = 'motorista_nome';

// ───── Estilos base mobile ─────
const styles = {
  app: {
    minHeight: '100vh',
    background: 'linear-gradient(180deg, #1E1B4B 0%, #312E81 100%)',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: '#F9FAFB',
    paddingBottom: 32,
  },
  container: { maxWidth: 480, margin: '0 auto', padding: '16px' },
  card: {
    background: 'rgba(255,255,255,0.95)',
    color: '#111827',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
  },
  btn: {
    width: '100%', padding: '14px 16px',
    fontSize: 16, fontWeight: 600, borderRadius: 10,
    border: 'none', cursor: 'pointer',
    transition: 'opacity .15s',
  },
  btnPrimary: { background: '#2563EB', color: '#fff' },
  btnSuccess: { background: '#059669', color: '#fff' },
  btnDanger:  { background: '#DC2626', color: '#fff' },
  btnWarning: { background: '#D97706', color: '#fff' },
  btnGhost:   { background: 'transparent', color: '#fff', border: '1px solid rgba(255,255,255,.3)' },
  input: {
    width: '100%', padding: '12px 14px', fontSize: 16,
    border: '1px solid #D1D5DB', borderRadius: 8,
    boxSizing: 'border-box',
  },
  label: { display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: '#374151' },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '14px 16px',
    background: 'rgba(255,255,255,.08)',
    borderBottom: '1px solid rgba(255,255,255,.12)',
    position: 'sticky', top: 0, zIndex: 10,
    backdropFilter: 'blur(8px)',
  },
};

// ───── Helpers ─────
function fmtDate(d) {
  if (!d) return '—';
  const s = String(d).substring(0, 10);
  const dt = new Date(s + 'T12:00:00');
  return isNaN(dt) ? '—' : dt.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
}

async function apiCall(path, opts = {}) {
  const token = localStorage.getItem(STORAGE_TOKEN);
  const headers = { ...(opts.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (opts.body && !(opts.body instanceof FormData) && typeof opts.body !== 'string') {
    headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(opts.body);
  }
  const res = await fetch(API + path, { ...opts, headers });
  const txt = await res.text();
  let body;
  try { body = txt ? JSON.parse(txt) : {}; } catch { body = { raw: txt }; }
  if (!res.ok) {
    if (res.status === 401) {
      localStorage.removeItem(STORAGE_TOKEN);
      localStorage.removeItem(STORAGE_NOME);
      window.location.href = '/m/login';
    }
    throw new Error(body.error || `Erro ${res.status}`);
  }
  return body;
}

const STATUS_INFO = {
  pendente:     { label: 'Pendente',     emoji: '⏳', color: '#6B7280' },
  entregue:     { label: 'Entregue',     emoji: '✅', color: '#059669' },
  nao_entregue: { label: 'Não entregue', emoji: '❌', color: '#DC2626' },
  reentrega:    { label: 'Reentrega',    emoji: '🔁', color: '#D97706' },
  cancelada:    { label: 'Cancelada',    emoji: '❎', color: '#4B5563' },
};

// ════════════════════════════════════════════════════════════════════════
// LOGIN
// ════════════════════════════════════════════════════════════════════════
function MotoristaLogin() {
  const [cpf, setCpf] = useState('');
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const nav = useNavigate();

  // Redireciona se já logado
  useEffect(() => {
    if (localStorage.getItem(STORAGE_TOKEN)) nav('/m/');
  }, [nav]);

  const maskCPF = v => (v||'').replace(/\D/g,'').slice(0,11)
    .replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d{1,2})$/,'$1-$2');

  const submit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setErro(''); setLoading(true);
    try {
      const r = await apiCall('/motorista-app/login', {
        method: 'POST',
        body: { cpf: cpf.replace(/\D/g,''), senha },
      });
      localStorage.setItem(STORAGE_TOKEN, r.token);
      localStorage.setItem(STORAGE_NOME, r.motorista.nome);
      if (r.motorista.senha_resetada) nav('/m/trocar-senha');
      else nav('/m/');
    } catch (e) {
      setErro(e.message);
    } finally { setLoading(false); }
  };

  return (
    <div style={styles.app}>
      <div style={{ ...styles.container, paddingTop: 60 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 48 }}>🚛</div>
          <h1 style={{ fontSize: 28, fontWeight: 700, marginTop: 8, marginBottom: 4 }}>LogiSystem</h1>
          <p style={{ opacity: .8, fontSize: 14 }}>Área do Motorista</p>
        </div>

        <div style={styles.card}>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Entrar</h2>

          <div style={{ marginBottom: 14 }}>
            <label style={styles.label}>CPF</label>
            <input
              type="tel"
              inputMode="numeric"
              value={cpf}
              onChange={e => setCpf(maskCPF(e.target.value))}
              placeholder="000.000.000-00"
              style={styles.input}
              autoComplete="username"
            />
          </div>

          <div style={{ marginBottom: 18 }}>
            <label style={styles.label}>Senha</label>
            <input
              type="password"
              value={senha}
              onChange={e => setSenha(e.target.value)}
              placeholder="Sua senha"
              style={styles.input}
              autoComplete="current-password"
              onKeyDown={e => e.key === 'Enter' && submit()}
            />
          </div>

          {erro && (
            <div style={{ padding: 10, background: '#FEE2E2', color: '#991B1B', borderRadius: 8, marginBottom: 12, fontSize: 13 }}>
              {erro}
            </div>
          )}

          <button
            onClick={submit}
            disabled={loading || !cpf || !senha}
            style={{ ...styles.btn, ...styles.btnPrimary, opacity: (loading || !cpf || !senha) ? .5 : 1 }}
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>

          <p style={{ fontSize: 12, color: '#6B7280', textAlign: 'center', marginTop: 14 }}>
            Esqueceu a senha? Procure o despachante.
          </p>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// TROCAR SENHA (forçado no primeiro login)
// ════════════════════════════════════════════════════════════════════════
function TrocarSenha() {
  const [senhaAtual, setSenhaAtual] = useState('');
  const [senhaNova, setSenhaNova] = useState('');
  const [senhaNova2, setSenhaNova2] = useState('');
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const nav = useNavigate();

  const submit = async () => {
    setErro('');
    if (senhaNova !== senhaNova2) return setErro('As novas senhas não coincidem');
    if (senhaNova.length < 4) return setErro('A nova senha precisa ter no mínimo 4 caracteres');
    setLoading(true);
    try {
      await apiCall('/motorista-app/trocar-senha', {
        method: 'POST',
        body: { senha_atual: senhaAtual, senha_nova: senhaNova },
      });
      nav('/m/');
    } catch (e) { setErro(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div style={styles.app}>
      <div style={{ ...styles.container, paddingTop: 40 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>Trocar senha</h1>
        <p style={{ opacity: .8, fontSize: 13, marginBottom: 20 }}>Por segurança, defina uma nova senha no primeiro acesso.</p>

        <div style={styles.card}>
          <div style={{ marginBottom: 12 }}>
            <label style={styles.label}>Senha atual (a temporária)</label>
            <input type="password" value={senhaAtual} onChange={e=>setSenhaAtual(e.target.value)} style={styles.input}/>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={styles.label}>Nova senha</label>
            <input type="password" value={senhaNova} onChange={e=>setSenhaNova(e.target.value)} style={styles.input}/>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={styles.label}>Confirme a nova senha</label>
            <input type="password" value={senhaNova2} onChange={e=>setSenhaNova2(e.target.value)} style={styles.input}/>
          </div>
          {erro && (
            <div style={{ padding: 10, background: '#FEE2E2', color: '#991B1B', borderRadius: 8, marginBottom: 12, fontSize: 13 }}>{erro}</div>
          )}
          <button onClick={submit} disabled={loading} style={{ ...styles.btn, ...styles.btnPrimary }}>
            {loading ? 'Salvando...' : 'Salvar nova senha'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// HEADER (compartilhado)
// ════════════════════════════════════════════════════════════════════════
function Header({ title, back = false }) {
  const nav = useNavigate();
  const nome = localStorage.getItem(STORAGE_NOME) || 'Motorista';
  const logout = () => {
    if (!confirm('Sair do app?')) return;
    localStorage.removeItem(STORAGE_TOKEN);
    localStorage.removeItem(STORAGE_NOME);
    nav('/m/login');
  };
  return (
    <div style={styles.header}>
      {back ? (
        <button onClick={()=>nav(-1)} style={{ ...styles.btnGhost, padding: '6px 12px', fontSize: 14, width: 'auto' }}>← Voltar</button>
      ) : (
        <div style={{ fontSize: 13 }}>👋 Olá, <strong>{nome.split(' ')[0]}</strong></div>
      )}
      <div style={{ fontWeight: 600 }}>{title}</div>
      <button onClick={logout} style={{ ...styles.btnGhost, padding: '6px 10px', fontSize: 12, width: 'auto' }}>Sair</button>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// MINHAS OTs
// ════════════════════════════════════════════════════════════════════════
function MinhasOTs() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const nav = useNavigate();

  const carregar = async () => {
    setLoading(true); setErro('');
    try {
      const r = await apiCall('/motorista-app/minhas-ots');
      setData(r);
    } catch (e) { setErro(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { carregar(); }, []);

  return (
    <div style={styles.app}>
      <Header title="Minhas Rotas" />
      <div style={styles.container}>
        <div style={{ marginBottom: 16, fontSize: 13, opacity: .8 }}>
          📅 {data?.data ? fmtDate(data.data) : 'Carregando...'}
        </div>

        {loading && (
          <div style={{ ...styles.card, textAlign: 'center', color: '#6B7280' }}>Carregando suas rotas...</div>
        )}

        {!loading && erro && (
          <div style={{ ...styles.card, color: '#991B1B', background: '#FEE2E2' }}>
            {erro}
            <button onClick={carregar} style={{ ...styles.btn, ...styles.btnPrimary, marginTop: 10 }}>Tentar de novo</button>
          </div>
        )}

        {!loading && !erro && data?.ots?.length === 0 && (
          <div style={{ ...styles.card, textAlign: 'center', padding: 32 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Sem rotas para hoje</div>
            <div style={{ fontSize: 13, color: '#6B7280' }}>Quando o despachante atribuir uma rota a você, ela aparece aqui.</div>
            <button onClick={carregar} style={{ ...styles.btn, ...styles.btnPrimary, marginTop: 16 }}>Atualizar</button>
          </div>
        )}

        {!loading && !erro && data?.ots?.map(ot => {
          const resolvidas = (ot.qt_entregues||0) + (ot.qt_nao_entregues||0) + (ot.qt_reentregas||0);
          const pct = ot.qt_paradas ? Math.round((resolvidas/ot.qt_paradas)*100) : 0;
          return (
            <div key={ot.id} style={{ ...styles.card, cursor: 'pointer' }} onClick={()=>nav(`/m/ot/${ot.id}`)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#2563EB' }}>Rota {ot.numero_rota || ot.id?.substring(0,6)}</div>
                <div style={{ fontSize: 12, padding: '2px 10px', borderRadius: 12, background: pct===100?'#D1FAE5':pct>0?'#FEF3C7':'#F3F4F6', color: pct===100?'#065F46':pct>0?'#92400E':'#4B5563', fontWeight: 600 }}>
                  {pct === 100 ? '✓ Finalizada' : pct > 0 ? `Em andamento ${pct}%` : 'Aguardando início'}
                </div>
              </div>
              {ot.placa && <div style={{ fontSize: 13, color: '#6B7280' }}>🚛 {ot.placa} • {ot.veiculo_tipo}</div>}
              <div style={{ marginTop: 10, display: 'flex', gap: 12, fontSize: 13 }}>
                <span>📦 <strong>{ot.qt_paradas || 0}</strong> entregas</span>
                {ot.qt_entregues > 0 &&     <span style={{ color: '#059669' }}>✅ {ot.qt_entregues}</span>}
                {ot.qt_nao_entregues > 0 && <span style={{ color: '#DC2626' }}>❌ {ot.qt_nao_entregues}</span>}
                {ot.qt_reentregas > 0 &&    <span style={{ color: '#D97706' }}>🔁 {ot.qt_reentregas}</span>}
              </div>
              {ot.qt_paradas > 0 && (
                <div style={{ height: 4, background: '#E5E7EB', borderRadius: 2, marginTop: 10, overflow: 'hidden' }}>
                  <div style={{ width: pct + '%', height: '100%', background: pct===100?'#059669':'#D97706' }}/>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// DETALHE DA OT (lista paradas)
// ════════════════════════════════════════════════════════════════════════
function DetalheOT() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const nav = useNavigate();

  const carregar = async () => {
    setLoading(true); setErro('');
    try {
      const r = await apiCall(`/motorista-app/ot/${id}`);
      setData(r);
    } catch (e) { setErro(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { carregar(); }, [id]);

  if (loading) return <div style={styles.app}><Header title="Carregando..." back /><div style={styles.container}><div style={styles.card}>Carregando...</div></div></div>;
  if (erro) return <div style={styles.app}><Header title="Erro" back /><div style={styles.container}><div style={{...styles.card, color:'#991B1B'}}>{erro}</div></div></div>;

  const cont = data.paradas.reduce((a,p) => { a[p.status||'pendente'] = (a[p.status||'pendente']||0)+1; return a; }, {});
  const resolvidas = (cont.entregue||0) + (cont.nao_entregue||0) + (cont.reentrega||0) + (cont.cancelada||0);
  const pct = data.paradas.length ? Math.round((resolvidas/data.paradas.length)*100) : 0;

  return (
    <div style={styles.app}>
      <Header title={`Rota ${data.ot.numero_rota || ''}`} back />
      <div style={styles.container}>
        <div style={{ ...styles.card, padding: 14 }}>
          <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 8 }}>
            {data.ot.placa && <>🚛 {data.ot.placa} • {data.ot.veiculo_tipo}</>}
          </div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>
            {resolvidas}/{data.paradas.length} entregas — {pct}%
          </div>
          <div style={{ height: 6, background: '#E5E7EB', borderRadius: 3, marginTop: 8, overflow: 'hidden' }}>
            <div style={{ width: pct + '%', height: '100%', background: pct===100?'#059669':'#D97706', transition: 'width .3s' }}/>
          </div>
        </div>

        {data.paradas.map(p => {
          const info = STATUS_INFO[p.status] || STATUS_INFO.pendente;
          const pendente = p.status === 'pendente';
          return (
            <div key={p.id}
              onClick={()=>nav(`/m/parada/${p.id}`)}
              style={{ ...styles.card, cursor: 'pointer', borderLeft: `4px solid ${info.color}`, padding: 12 }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: '#6B7280' }}>#{p.seq}</div>
                  <div style={{ fontSize: 15, fontWeight: 600, marginTop: 2 }}>{p.cliente_nome || 'Cliente sem nome'}</div>
                  {p.endereco && <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>📍 {p.endereco}</div>}
                  {p.nf && <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>NF: {p.nf}</div>}
                </div>
                <div style={{ fontSize: 22 }}>{info.emoji}</div>
              </div>
              {!pendente && (
                <div style={{ fontSize: 11, color: info.color, marginTop: 6, fontWeight: 600 }}>{info.label}</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// CANVAS DE ASSINATURA
// ════════════════════════════════════════════════════════════════════════
function AssinaturaCanvas({ onChange }) {
  const canvasRef = useRef(null);
  const [drawing, setDrawing] = useState(false);
  const [hasSig, setHasSig] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, []);

  const getPos = (e) => {
    const r = canvasRef.current.getBoundingClientRect();
    const ev = e.touches ? e.touches[0] : e;
    return { x: (ev.clientX - r.left) * (canvasRef.current.width / r.width),
             y: (ev.clientY - r.top)  * (canvasRef.current.height / r.height) };
  };
  const start = (e) => { e.preventDefault(); setDrawing(true); const p = getPos(e); const ctx = canvasRef.current.getContext('2d'); ctx.beginPath(); ctx.moveTo(p.x, p.y); };
  const move  = (e) => { if (!drawing) return; e.preventDefault(); const p = getPos(e); const ctx = canvasRef.current.getContext('2d'); ctx.lineTo(p.x, p.y); ctx.stroke(); setHasSig(true); };
  const end   = () => { setDrawing(false); if (hasSig && onChange) onChange(canvasRef.current.toDataURL('image/png')); };
  const clear = () => {
    const c = canvasRef.current; const ctx = c.getContext('2d');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, c.width, c.height);
    setHasSig(false); if (onChange) onChange(null);
  };

  return (
    <div>
      <canvas
        ref={canvasRef} width={500} height={180}
        style={{ width: '100%', height: 160, background: '#fff', border: '1px solid #D1D5DB', borderRadius: 8, touchAction: 'none' }}
        onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end}
        onTouchStart={start} onTouchMove={move} onTouchEnd={end}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 12, color: '#6B7280' }}>
        <span>{hasSig ? '✓ Assinatura capturada' : 'Assine acima'}</span>
        <button type="button" onClick={clear} style={{ background: 'none', border: 'none', color: '#DC2626', fontSize: 12, cursor: 'pointer' }}>Limpar</button>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// MARCAR PARADA
// ════════════════════════════════════════════════════════════════════════
const MOTIVOS = [
  'Cliente ausente',
  'Endereço errado / não localizado',
  'Recusou a entrega',
  'Estabelecimento fechado',
  'Mercadoria avariada',
  'Documentação incompleta',
  'Outro',
];

function MarcarParada() {
  const { id } = useParams();
  const nav = useNavigate();
  const [parada, setParada] = useState(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');

  // Form
  const [status, setStatus] = useState(null);
  const [nomeRecebedor, setNomeRecebedor] = useState('');
  const [motivo, setMotivo] = useState('');
  const [observacao, setObservacao] = useState('');
  const [assinatura, setAssinatura] = useState(null);
  const [foto, setFoto] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [coordObj, setCoordObj] = useState(null); // {lat, lng}

  // Carrega a parada (vai via /ot/:ordem_id — mas não sei o ordem_id; uso filtro indireto)
  useEffect(() => {
    (async () => {
      try {
        // Hack: precisaria endpoint /paradas/:id mas pra evitar criar mais um, busco via 'minhas-ots' e filtro
        // Solução real: pegar todas as OTs do dia e achar a parada
        const r = await apiCall('/motorista-app/minhas-ots');
        for (const ot of r.ots) {
          const det = await apiCall(`/motorista-app/ot/${ot.id}`);
          const found = det.paradas.find(p => String(p.id) === String(id));
          if (found) {
            setParada({ ...found, ot });
            setNomeRecebedor(found.nome_recebedor || '');
            setObservacao(found.observacao || '');
            setMotivo(found.motivo_nao_entrega || '');
            break;
          }
        }
        setLoading(false);
      } catch (e) { setErro(e.message); setLoading(false); }
    })();
  }, [id]);

  const pegarLocalizacao = () => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) return resolve(null);
      navigator.geolocation.getCurrentPosition(
        pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve(null),
        { timeout: 8000, enableHighAccuracy: false }
      );
    });
  };

  const tentarLocalizar = async () => {
    const c = await pegarLocalizacao();
    if (c) setCoordObj(c);
  };

  useEffect(() => { if (parada && parada.status === 'pendente') tentarLocalizar(); }, [parada]);

  const enviar = async () => {
    if (!status) return alert('Escolha um status');
    if (status === 'entregue' && !nomeRecebedor) return alert('Informe quem recebeu');
    if (status === 'nao_entregue' && !motivo) return alert('Informe o motivo');

    setSalvando(true);
    try {
      const coord = coordObj || await pegarLocalizacao();
      const fd = new FormData();
      fd.append('status', status);
      if (motivo) fd.append('motivo_nao_entrega', motivo);
      if (observacao) fd.append('observacao', observacao);
      if (nomeRecebedor) fd.append('nome_recebedor', nomeRecebedor);
      if (coord) { fd.append('latitude', coord.lat); fd.append('longitude', coord.lng); }
      if (assinatura) fd.append('assinatura_b64', assinatura);
      if (foto) fd.append('foto', foto);

      await apiCall(`/motorista-app/paradas/${id}/status`, { method: 'PATCH', body: fd });
      nav(`/m/ot/${parada.ot.id}`);
    } catch (e) { alert(e.message); }
    finally { setSalvando(false); }
  };

  if (loading) return <div style={styles.app}><Header title="Carregando..." back /><div style={styles.container}><div style={styles.card}>Carregando...</div></div></div>;
  if (erro || !parada) return <div style={styles.app}><Header title="Erro" back /><div style={styles.container}><div style={{...styles.card, color:'#991B1B'}}>{erro || 'Parada não encontrada'}</div></div></div>;

  return (
    <div style={styles.app}>
      <Header title={`Parada #${parada.seq}`} back />
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>{parada.cliente_nome || 'Cliente sem nome'}</div>
          {parada.endereco && <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 4 }}>📍 {parada.endereco}</div>}
          {parada.nf && <div style={{ fontSize: 12, color: '#6B7280' }}>NF: {parada.nf}</div>}
          {parada.obs && <div style={{ fontSize: 12, color: '#6B7280', marginTop: 6, padding: 8, background: '#F3F4F6', borderRadius: 6 }}>💬 {parada.obs}</div>}

          {coordObj && (
            <div style={{ fontSize: 11, color: '#059669', marginTop: 8 }}>
              📍 Localização capturada ({coordObj.lat.toFixed(5)}, {coordObj.lng.toFixed(5)})
            </div>
          )}
        </div>

        {/* Botões de status */}
        {!status && parada.status === 'pendente' && (
          <>
            <button onClick={()=>setStatus('entregue')} style={{ ...styles.btn, ...styles.btnSuccess, marginBottom: 10, fontSize: 18, padding: '18px' }}>✅ ENTREGUE</button>
            <button onClick={()=>setStatus('nao_entregue')} style={{ ...styles.btn, ...styles.btnDanger, marginBottom: 10, fontSize: 18, padding: '18px' }}>❌ NÃO ENTREGUE</button>
            <button onClick={()=>setStatus('reentrega')} style={{ ...styles.btn, ...styles.btnWarning, marginBottom: 10, fontSize: 18, padding: '18px' }}>🔁 REENTREGA</button>
          </>
        )}

        {/* Form de entregue */}
        {status === 'entregue' && (
          <div style={styles.card}>
            <div style={{ fontWeight: 700, marginBottom: 14, color: '#059669' }}>✅ Confirmar Entrega</div>

            <div style={{ marginBottom: 12 }}>
              <label style={styles.label}>Quem recebeu? *</label>
              <input value={nomeRecebedor} onChange={e=>setNomeRecebedor(e.target.value)} style={styles.input} placeholder="Nome de quem assinou"/>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={styles.label}>Assinatura do recebedor</label>
              <AssinaturaCanvas onChange={setAssinatura}/>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={styles.label}>Foto (opcional)</label>
              <input type="file" accept="image/*" capture="environment" onChange={e=>setFoto(e.target.files?.[0]||null)} style={{...styles.input, padding: 8}}/>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={styles.label}>Observação (opcional)</label>
              <textarea value={observacao} onChange={e=>setObservacao(e.target.value)} style={{...styles.input, minHeight: 60}} rows={2}/>
            </div>

            <button onClick={enviar} disabled={salvando} style={{...styles.btn, ...styles.btnSuccess, marginBottom: 8}}>
              {salvando ? 'Salvando...' : '✅ Confirmar Entrega'}
            </button>
            <button onClick={()=>setStatus(null)} style={{...styles.btn, background: '#F3F4F6', color: '#374151'}}>Cancelar</button>
          </div>
        )}

        {/* Form de não entregue */}
        {status === 'nao_entregue' && (
          <div style={styles.card}>
            <div style={{ fontWeight: 700, marginBottom: 14, color: '#DC2626' }}>❌ Não Entregue</div>

            <div style={{ marginBottom: 12 }}>
              <label style={styles.label}>Motivo *</label>
              <select value={motivo} onChange={e=>setMotivo(e.target.value)} style={styles.input}>
                <option value="">— Selecione —</option>
                {MOTIVOS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={styles.label}>Observação</label>
              <textarea value={observacao} onChange={e=>setObservacao(e.target.value)} style={{...styles.input, minHeight: 60}} rows={2} placeholder="Detalhes do que aconteceu..."/>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={styles.label}>Foto (opcional)</label>
              <input type="file" accept="image/*" capture="environment" onChange={e=>setFoto(e.target.files?.[0]||null)} style={{...styles.input, padding: 8}}/>
            </div>

            <button onClick={enviar} disabled={salvando} style={{...styles.btn, ...styles.btnDanger, marginBottom: 8}}>
              {salvando ? 'Salvando...' : 'Confirmar'}
            </button>
            <button onClick={()=>setStatus(null)} style={{...styles.btn, background: '#F3F4F6', color: '#374151'}}>Cancelar</button>
          </div>
        )}

        {/* Form de reentrega */}
        {status === 'reentrega' && (
          <div style={styles.card}>
            <div style={{ fontWeight: 700, marginBottom: 14, color: '#D97706' }}>🔁 Reentrega</div>
            <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 14 }}>
              Essa entrega será marcada para reagendamento. O despachante vai escolher quando refazer.
            </p>

            <div style={{ marginBottom: 12 }}>
              <label style={styles.label}>Motivo</label>
              <select value={motivo} onChange={e=>setMotivo(e.target.value)} style={styles.input}>
                <option value="">— Selecione —</option>
                {MOTIVOS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={styles.label}>Observação</label>
              <textarea value={observacao} onChange={e=>setObservacao(e.target.value)} style={{...styles.input, minHeight: 60}} rows={2}/>
            </div>

            <button onClick={enviar} disabled={salvando} style={{...styles.btn, ...styles.btnWarning, marginBottom: 8}}>
              {salvando ? 'Salvando...' : 'Confirmar Reentrega'}
            </button>
            <button onClick={()=>setStatus(null)} style={{...styles.btn, background: '#F3F4F6', color: '#374151'}}>Cancelar</button>
          </div>
        )}

        {/* Parada já marcada */}
        {parada.status !== 'pendente' && !status && (
          <div style={styles.card}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>
              {STATUS_INFO[parada.status]?.emoji} {STATUS_INFO[parada.status]?.label}
            </div>
            {parada.motivo_nao_entrega && <div style={{ fontSize: 13, marginBottom: 4 }}>Motivo: {parada.motivo_nao_entrega}</div>}
            {parada.nome_recebedor && <div style={{ fontSize: 13, marginBottom: 4 }}>Recebido por: {parada.nome_recebedor}</div>}
            {parada.observacao && <div style={{ fontSize: 13, color: '#6B7280', marginTop: 6 }}>💬 {parada.observacao}</div>}
            <button onClick={()=>setStatus('pendente_remark')} style={{...styles.btn, background: '#F3F4F6', color: '#374151', marginTop: 12}}>↺ Remarcar (admin pode reverter)</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// PROTEÇÃO DE ROTA
// ════════════════════════════════════════════════════════════════════════
function RequireAuth({ children }) {
  const loc = useLocation();
  const token = localStorage.getItem(STORAGE_TOKEN);
  if (!token) return <Navigate to="/m/login" state={{ from: loc }} replace />;
  return children;
}

// ════════════════════════════════════════════════════════════════════════
// APP
// ════════════════════════════════════════════════════════════════════════
export default function MobileApp() {
  return (
    <Routes>
      <Route path="/login" element={<MotoristaLogin />} />
      <Route path="/trocar-senha" element={<RequireAuth><TrocarSenha /></RequireAuth>} />
      <Route path="/ot/:id" element={<RequireAuth><DetalheOT /></RequireAuth>} />
      <Route path="/parada/:id" element={<RequireAuth><MarcarParada /></RequireAuth>} />
      <Route path="/" element={<RequireAuth><MinhasOTs /></RequireAuth>} />
      <Route path="*" element={<Navigate to="/m/" replace />} />
    </Routes>
  );
}
