import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { startRegistration, startAuthentication } from '@simplewebauthn/browser';
import InstalarApp from '../components/InstalarApp.jsx';

const API = 'https://api.wsdevsoft.com/api';

export default function Login() {
  const { login, user, pendingOrg } = useAuth();
  const [email, setEmail]       = useState('');
  const [senha, setSenha]       = useState('');
  const [erro, setErro]         = useState('');
  const [loading, setLoading]   = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [hoverBtn, setHoverBtn] = useState(false);
  const [hasBio, setHasBio]     = useState(false);
  const [bioAvailable, setBioAvailable] = useState(false);
  const [showBioSetup, setShowBioSetup] = useState(false);

  // Checar se WebAuthn está disponível
  useEffect(() => {
    if (window.PublicKeyCredential) {
      PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable?.()
        .then(ok => setBioAvailable(ok))
        .catch(() => {});
    }
  }, []);

  // Checar se email tem biometria cadastrada
  useEffect(() => {
    if (!email || !bioAvailable) { setHasBio(false); return; }
    const t = setTimeout(() => {
      fetch(`${API}/auth/webauthn/has-credential?email=${encodeURIComponent(email)}`)
        .then(r => r.json())
        .then(d => setHasBio(d.has))
        .catch(() => setHasBio(false));
    }, 500);
    return () => clearTimeout(t);
  }, [email, bioAvailable]);

  // Login com email + senha
  const submit = async (e) => {
    e.preventDefault();
    setErro(''); setLoading(true);
    try {
      const result = await login(email, senha);

      // Se precisa selecionar org, o AuthContext já setou pendingOrg=true.
      // O ProtectedApp renderiza OrgSelector nesse caso, então não precisamos
      // fazer mais nada aqui.
      if (result?.precisaSelecionarOrg) {
        return;
      }

      // Login completo (1 org só) — oferecer biometria se ainda não tem
      if (bioAvailable) {
        const res = await fetch(`${API}/auth/webauthn/has-credential?email=${encodeURIComponent(email)}`);
        const data = await res.json();
        if (!data.has) {
          setShowBioSetup(true);
        }
      }
    } catch(err) {
      setErro(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Login com biometria (Face ID / Touch ID)
  const loginBiometria = async () => {
    setErro(''); setLoading(true);
    try {
      // 1. Pedir opções de autenticação
      const optRes = await fetch(`${API}/auth/webauthn/auth-options`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const options = await optRes.json();

      // 2. Executar biometria no dispositivo
      const authResp = await startAuthentication({ optionsJSON: options });

      // 3. Verificar no backend
      const verRes = await fetch(`${API}/auth/webauthn/auth-verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...authResp, challengeId: options.challengeId }),
      });
      const data = await verRes.json();

      if (!verRes.ok) throw new Error(data.error || 'Falha na autenticação');

      localStorage.setItem('logi_token', data.token);
      // Se 1 org só, persiste a org direto
      if (!data.precisa_selecionar_org && data.org) {
        localStorage.setItem('logi_org', JSON.stringify(data.org));
      }
      window.location.reload();
    } catch(err) {
      if (err.name === 'NotAllowedError') {
        setErro('Biometria cancelada');
      } else {
        setErro(err.message || 'Erro na autenticação biométrica');
      }
    } finally {
      setLoading(false);
    }
  };

  // Registrar biometria (após login com senha)
  const registrarBiometria = async () => {
    try {
      const token = localStorage.getItem('logi_token');

      const optRes = await fetch(`${API}/auth/webauthn/register-options`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      });
      const options = await optRes.json();

      const regResp = await startRegistration({ optionsJSON: options });

      const verRes = await fetch(`${API}/auth/webauthn/register-verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...regResp, deviceName: navigator.userAgent.includes('iPhone') ? 'iPhone Face ID' : 'Dispositivo' }),
      });

      if (verRes.ok) {
        setShowBioSetup(false);
        localStorage.setItem('logi_bio_email', email);
      }
    } catch(err) {
      console.error('Erro registro biometria:', err);
    }
    setShowBioSetup(false);
  };

  // Restaurar email salvo para biometria
  useEffect(() => {
    const savedEmail = localStorage.getItem('logi_bio_email');
    if (savedEmail && !email) setEmail(savedEmail);
  }, []);

  const [emailFocus, setEmailFocus] = useState(false);
  const [senhaFocus, setSenhaFocus] = useState(false);

  const inputStyle = (focused) => ({
    width: '100%', padding: '12px 14px',
    border: `1.5px solid ${focused ? '#2563EB' : '#E2E8F0'}`,
    borderRadius: 10, fontSize: 14, color: '#1A2740', outline: 'none',
    fontFamily: 'inherit', boxSizing: 'border-box',
    background: focused ? '#F8FAFF' : '#FAFAFA',
    transition: 'border-color .2s, background .2s',
  });

  // Se acabou de fazer login e precisa oferecer biometria
  if (showBioSetup && user && !pendingOrg) {
    return (
      <div style={{
        minHeight: '100vh', background: 'linear-gradient(135deg, #EEF2FF 0%, #F0F9FF 50%, #F8F9FC 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px',
        fontFamily: "'Segoe UI', system-ui, sans-serif",
      }}>
        <div style={{ width: '100%', maxWidth: 420, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>
            {navigator.userAgent.includes('iPhone') || navigator.userAgent.includes('iPad') ? '🔐' : '👆'}
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#1A2740', marginBottom: 8 }}>
            Ativar Face ID?
          </div>
          <div style={{ fontSize: 14, color: '#64748B', marginBottom: 32, lineHeight: 1.5 }}>
            No próximo acesso você poderá entrar apenas com biometria, sem digitar a senha.
          </div>
          <button onClick={registrarBiometria} style={{
            width: '100%', padding: '14px', borderRadius: 12, border: 'none',
            background: 'linear-gradient(135deg, #2563EB, #1D4ED8)', color: '#fff',
            fontSize: 15, fontWeight: 600, cursor: 'pointer', marginBottom: 12,
          }}>
            🔐 Ativar Face ID
          </button>
          <button onClick={() => { setShowBioSetup(false); window.location.reload(); }} style={{
            width: '100%', padding: '12px', borderRadius: 12, border: '1px solid #E2E8F0',
            background: '#fff', color: '#64748B', fontSize: 14, cursor: 'pointer',
          }}>
            Agora não
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #EEF2FF 0%, #F0F9FF 50%, #F8F9FC 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Segoe UI', system-ui, sans-serif", padding: '24px 16px',
    }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{
            width: 64, height: 64, background: 'linear-gradient(135deg, #2563EB, #1D4ED8)',
            borderRadius: 18, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 14, boxShadow: '0 8px 24px rgba(37,99,235,.3)',
          }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
              <path d="M3 8l4 10 3-7 3 7 4-10" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M19 6h3v3M22 6l-5 5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity=".6"/>
            </svg>
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#1A2740', letterSpacing: '-0.3px' }}>LogiSystem</div>
          <div style={{ fontSize: 13, color: '#94A3B8', marginTop: 4 }}>Gestão de Transportes</div>
        </div>

        {/* Card */}
        <div style={{
          background: '#fff', border: '1px solid #E8EDF5', borderRadius: 20,
          padding: '36px 32px', boxShadow: '0 8px 40px rgba(0,0,0,.08), 0 1px 4px rgba(0,0,0,.04)',
        }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#1A2740', marginBottom: 4 }}>
            Bem-vindo de volta 👋
          </div>
          <div style={{ fontSize: 13, color: '#94A3B8', marginBottom: 28 }}>
            {hasBio ? 'Use Face ID ou digite sua senha' : 'Use seu e-mail e senha para entrar'}
          </div>

          <form onSubmit={submit}>
            {/* E-mail */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6, display: 'block' }}>E-mail</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                onFocus={() => setEmailFocus(true)} onBlur={() => setEmailFocus(false)}
                style={inputStyle(emailFocus)} placeholder="seu@email.com" required autoComplete="email" />
            </div>

            {/* Senha */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6, display: 'block' }}>Senha</label>
              <div style={{ position: 'relative' }}>
                <input type={showPass ? 'text' : 'password'} value={senha} onChange={e => setSenha(e.target.value)}
                  onFocus={() => setSenhaFocus(true)} onBlur={() => setSenhaFocus(false)}
                  style={inputStyle(senhaFocus)} placeholder="••••••••" required autoComplete="current-password" />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  style={{
                    position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#94A3B8', padding: 4,
                  }}>
                  {showPass ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            {/* Erro */}
            {erro && (
              <div style={{ padding: '10px 14px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, marginBottom: 16, fontSize: 13, color: '#DC2626' }}>
                {erro}
              </div>
            )}

            {/* Botão Entrar */}
            <button type="submit" disabled={loading}
              onMouseEnter={() => setHoverBtn(true)} onMouseLeave={() => setHoverBtn(false)}
              style={{
                width: '100%', padding: '13px', borderRadius: 12, border: 'none',
                background: hoverBtn ? '#1D4ED8' : 'linear-gradient(135deg, #2563EB, #1D4ED8)',
                color: '#fff', fontSize: 15, fontWeight: 600, cursor: loading ? 'wait' : 'pointer',
                boxShadow: '0 4px 16px rgba(37,99,235,.3)', transition: 'all .2s',
                transform: hoverBtn ? 'translateY(-1px)' : 'none', opacity: loading ? 0.7 : 1,
              }}>
              {loading ? 'Entrando...' : 'Entrar →'}
            </button>

            {/* Botão Face ID */}
            {hasBio && email && (
              <button type="button" onClick={loginBiometria} disabled={loading}
                style={{
                  width: '100%', padding: '13px', borderRadius: 12, marginTop: 10,
                  border: '1.5px solid #E2E8F0', background: '#FAFAFA', color: '#1A2740',
                  fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'all .15s',
                }}>
                <span style={{ fontSize: 20 }}>🔐</span>
                Entrar com Face ID
              </button>
            )}
          </form>
        </div>

        <div style={{ marginTop: 20 }}>
          <InstalarApp nomeApp="o LogiSystem" cor="#2563EB" />
        </div>

        <div style={{ textAlign: 'center', marginTop: 24, fontSize: 12, color: '#94A3B8' }}>
          Problemas de acesso? Fale com o administrador.
        </div>

        {/* Marca WsDevSoft */}
        <div style={{ textAlign: 'center', marginTop: 32, paddingTop: 16, borderTop: '1px solid #E8EDF5' }}>
          <a href="https://wsdevsoft.com" target="_blank" rel="noreferrer"
            style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8, opacity: 0.6, transition: 'opacity .2s' }}
            onMouseEnter={e => e.currentTarget.style.opacity = '1'}
            onMouseLeave={e => e.currentTarget.style.opacity = '0.6'}>
            <svg width="20" height="20" viewBox="0 0 32 32" fill="none">
              <rect width="32" height="32" rx="7" fill="url(#ws_grad)"/>
              <path d="M6 12l4 10 3-7 3 7 4-10" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M22 10h4v4M26 10l-6 6" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity=".7"/>
              <defs><linearGradient id="ws_grad" x1="0" y1="0" x2="32" y2="32"><stop stopColor="#6366F1"/><stop offset="1" stopColor="#4F46E5"/></linearGradient></defs>
            </svg>
            <span style={{ fontSize: 11, color: '#94A3B8', letterSpacing: '.3px' }}>
              Desenvolvido por <strong style={{ color: '#6366F1', fontWeight: 600 }}>WsDevSoft</strong>
            </span>
          </a>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
