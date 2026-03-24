import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail]   = useState('');
  const [senha, setSenha]   = useState('');
  const [erro, setErro]     = useState('');
  const [loading, setLoading] = useState(false);

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

  return (
    <div style={{
      minHeight: '100vh', background: '#F8F9FC',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Segoe UI', system-ui, sans-serif",
    }}>
      <div style={{ width: '100%', maxWidth: 400 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 56, height: 56, background: '#2563EB',
            borderRadius: 14, display: 'inline-flex',
            alignItems: 'center', justifyContent: 'center',
            fontSize: 26, fontWeight: 700, color: '#fff',
            marginBottom: 12,
          }}>L</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#1A2740' }}>LogiSystem</div>
          <div style={{ fontSize: 13, color: '#9BAABB', marginTop: 4 }}>Gestão de Transportes</div>
        </div>

        {/* Card */}
        <div style={{
          background: '#fff', border: '1px solid #E2E8F0',
          borderRadius: 16, padding: '32px 28px',
          boxShadow: '0 4px 24px rgba(0,0,0,.06)',
        }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#1A2740', marginBottom: 6 }}>Entrar na sua conta</div>
          <div style={{ fontSize: 13, color: '#9BAABB', marginBottom: 24 }}>Use seu e-mail e senha cadastrados</div>

          <form onSubmit={submit}>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 500, color: '#5A6B84', display: 'block', marginBottom: 5 }}>E-mail</label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="seu@email.com" required
                style={{
                  width: '100%', padding: '10px 12px',
                  border: '1.5px solid #CBD5E1', borderRadius: 10,
                  fontSize: 13, color: '#1A2740', outline: 'none',
                  fontFamily: 'inherit', boxSizing: 'border-box',
                  transition: 'border-color .15s',
                }}
                onFocus={e => e.target.style.borderColor='#2563EB'}
                onBlur={e => e.target.style.borderColor='#CBD5E1'}
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, fontWeight: 500, color: '#5A6B84', display: 'block', marginBottom: 5 }}>Senha</label>
              <input
                type="password" value={senha} onChange={e => setSenha(e.target.value)}
                placeholder="••••••••" required
                style={{
                  width: '100%', padding: '10px 12px',
                  border: '1.5px solid #CBD5E1', borderRadius: 10,
                  fontSize: 13, color: '#1A2740', outline: 'none',
                  fontFamily: 'inherit', boxSizing: 'border-box',
                  transition: 'border-color .15s',
                }}
                onFocus={e => e.target.style.borderColor='#2563EB'}
                onBlur={e => e.target.style.borderColor='#CBD5E1'}
              />
            </div>

            {erro && (
              <div style={{
                background: '#FEF2F2', border: '1px solid #FCA5A5',
                borderRadius: 8, padding: '10px 12px',
                fontSize: 13, color: '#DC2626', marginBottom: 16,
              }}>{erro}</div>
            )}

            <button
              type="submit" disabled={loading}
              style={{
                width: '100%', padding: '11px',
                background: loading ? '#93C5FD' : '#2563EB',
                color: '#fff', border: 'none', borderRadius: 10,
                fontSize: 14, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit', transition: 'background .15s',
              }}
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        </div>

        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 12, color: '#9BAABB' }}>
          Problemas de acesso? Fale com o administrador.
        </div>
      </div>
    </div>
  );
}
