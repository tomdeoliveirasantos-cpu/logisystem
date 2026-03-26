import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail]       = useState('');
  const [senha, setSenha]       = useState('');
  const [erro, setErro]         = useState('');
  const [loading, setLoading]   = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [hoverBtn, setHoverBtn] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErro(''); setLoading(true);
    try {
      await login(email, senha);
    } catch(err) {
      setErro(err.message);
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = (focused) => ({
    width: '100%',
    padding: '12px 14px',
    border: `1.5px solid ${focused ? '#2563EB' : '#E2E8F0'}`,
    borderRadius: 10,
    fontSize: 14,
    color: '#1A2740',
    outline: 'none',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
    background: focused ? '#F8FAFF' : '#FAFAFA',
    transition: 'border-color .2s, background .2s',
  });

  const [emailFocus, setEmailFocus] = useState(false);
  const [senhaFocus, setSenhaFocus] = useState(false);

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #EEF2FF 0%, #F0F9FF 50%, #F8F9FC 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'Segoe UI', system-ui, sans-serif",
      padding: '24px 16px',
    }}>
      <div style={{ width: '100%', maxWidth: 420 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{
            width: 64, height: 64,
            background: 'linear-gradient(135deg, #2563EB, #1D4ED8)',
            borderRadius: 18,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 28,
            fontWeight: 800,
            color: '#fff',
            marginBottom: 14,
            boxShadow: '0 8px 24px rgba(37,99,235,.3)',
          }}>L</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#1A2740', letterSpacing: '-0.3px' }}>LogiSystem</div>
          <div style={{ fontSize: 13, color: '#94A3B8', marginTop: 4 }}>Gestão de Transportes</div>
        </div>

        {/* Card */}
        <div style={{
          background: '#fff',
          border: '1px solid #E8EDF5',
          borderRadius: 20,
          padding: '36px 32px',
          boxShadow: '0 8px 40px rgba(0,0,0,.08), 0 1px 4px rgba(0,0,0,.04)',
        }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#1A2740', marginBottom: 4 }}>
            Bem-vindo de volta 👋
          </div>
          <div style={{ fontSize: 13, color: '#94A3B8', marginBottom: 28 }}>
            Use seu e-mail e senha para entrar
          </div>

          <form onSubmit={submit}>
            {/* E-mail */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                E-mail
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
                style={inputStyle(emailFocus)}
                onFocus={() => setEmailFocus(true)}
                onBlur={() => setEmailFocus(false)}
              />
            </div>

            {/* Senha */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Senha
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPass ? 'text' : 'password'}
                  value={senha}
                  onChange={e => setSenha(e.target.value)}
                  placeholder="••••••••"
                  required
                  style={{ ...inputStyle(senhaFocus), paddingRight: 44 }}
                  onFocus={() => setSenhaFocus(true)}
                  onBlur={() => setSenhaFocus(false)}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  style={{
                    position: 'absolute',
                    right: 12,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 16,
                    color: '#94A3B8',
                    padding: '4px',
                    lineHeight: 1,
                  }}
                  tabIndex={-1}
                >
                  {showPass ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            {/* Erro */}
            {erro && (
              <div style={{
                background: '#FEF2F2',
                border: '1px solid #FECACA',
                borderRadius: 10,
                padding: '11px 14px',
                fontSize: 13,
                color: '#DC2626',
                marginBottom: 18,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}>
                <span>⚠️</span> {erro}
              </div>
            )}

            {/* Botão */}
            <button
              type="submit"
              disabled={loading}
              onMouseEnter={() => setHoverBtn(true)}
              onMouseLeave={() => setHoverBtn(false)}
              style={{
                width: '100%',
                padding: '13px',
                background: loading
                  ? '#93C5FD'
                  : hoverBtn
                    ? '#1D4ED8'
                    : '#2563EB',
                color: '#fff',
                border: 'none',
                borderRadius: 11,
                fontSize: 15,
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit',
                transition: 'background .2s, transform .1s, box-shadow .2s',
                transform: hoverBtn && !loading ? 'translateY(-1px)' : 'translateY(0)',
                boxShadow: hoverBtn && !loading
                  ? '0 6px 20px rgba(37,99,235,.4)'
                  : '0 2px 8px rgba(37,99,235,.2)',
                letterSpacing: '0.2px',
              }}
            >
              {loading ? (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <span style={{
                    display: 'inline-block',
                    width: 14, height: 14,
                    border: '2px solid rgba(255,255,255,.4)',
                    borderTopColor: '#fff',
                    borderRadius: '50%',
                    animation: 'spin 0.7s linear infinite',
                  }} />
                  Entrando...
                </span>
              ) : 'Entrar →'}
            </button>
          </form>
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
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
