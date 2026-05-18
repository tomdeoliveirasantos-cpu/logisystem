import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

/**
 * Tela mostrada quando o usuário tem múltiplas organizações
 * e precisa escolher uma para começar a usar o sistema.
 *
 * Também é usado quando o usuário troca de organização pelo header.
 */
export default function OrgSelector({ onCancel = null }) {
  const { user, orgs, selectOrg, logout, org: orgAtiva } = useAuth();
  const [loading, setLoading] = useState(null); // id da org sendo selecionada
  const [erro, setErro] = useState('');

  const handleSelect = async (orgId) => {
    setLoading(orgId);
    setErro('');
    try {
      await selectOrg(orgId);
    } catch (e) {
      setErro(e.message);
      setLoading(null);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #EEF2FF 0%, #F0F9FF 50%, #F8F9FC 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Segoe UI', system-ui, sans-serif", padding: '24px 16px',
    }}>
      <div style={{ width: '100%', maxWidth: 480 }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{
            width: 56, height: 56, background: 'linear-gradient(135deg, #2563EB, #1D4ED8)',
            borderRadius: 16, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 14, boxShadow: '0 6px 20px rgba(37,99,235,.3)',
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path d="M3 8l4 10 3-7 3 7 4-10" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#1A2740', letterSpacing: '-0.3px' }}>
            Selecione a empresa
          </div>
          <div style={{ fontSize: 13, color: '#64748B', marginTop: 6 }}>
            Olá, <strong>{user?.nome}</strong>. Você tem acesso a {orgs.length} {orgs.length === 1 ? 'empresa' : 'empresas'}.
          </div>
        </div>

        {/* Card com lista */}
        <div style={{
          background: '#fff', border: '1px solid #E8EDF5', borderRadius: 18,
          padding: '12px', boxShadow: '0 8px 32px rgba(0,0,0,.06)',
        }}>
          {orgs.map(o => {
            const isAtiva = orgAtiva?.id === o.id;
            const isLoading = loading === o.id;
            const isSuper = o.is_wsdevsoft;

            return (
              <button
                key={o.id}
                onClick={() => handleSelect(o.id)}
                disabled={loading !== null}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 14,
                  padding: '14px 14px', borderRadius: 12,
                  border: isAtiva ? '1.5px solid #2563EB' : '1.5px solid transparent',
                  background: isAtiva ? '#EFF6FF' : '#fff',
                  cursor: loading !== null ? 'wait' : 'pointer',
                  marginBottom: 4, transition: 'all .15s',
                  textAlign: 'left', fontFamily: 'inherit',
                  opacity: loading !== null && !isLoading ? 0.5 : 1,
                }}
                onMouseEnter={e => { if (!isAtiva && loading === null) e.currentTarget.style.background = '#F8FAFF'; }}
                onMouseLeave={e => { if (!isAtiva && loading === null) e.currentTarget.style.background = '#fff'; }}
              >
                {/* Avatar/logo */}
                <div style={{
                  width: 44, height: 44, borderRadius: 11, flexShrink: 0,
                  background: isSuper
                    ? 'linear-gradient(135deg, #6366F1, #4F46E5)'
                    : (o.cor_primaria || 'linear-gradient(135deg, #1D9E75, #0F6E56)'),
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontSize: 18, fontWeight: 700,
                }}>
                  {o.logo_url ? (
                    <img src={o.logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 11 }} />
                  ) : (
                    o.nome.charAt(0).toUpperCase()
                  )}
                </div>

                {/* Texto */}
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={{
                    fontSize: 15, fontWeight: 600, color: '#1A2740',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    display: 'flex', alignItems: 'center', gap: 8,
                  }}>
                    {o.nome}
                    {isSuper && (
                      <span style={{
                        fontSize: 9, fontWeight: 700, padding: '2px 6px',
                        background: '#EEF2FF', color: '#4F46E5', borderRadius: 4, letterSpacing: '.3px',
                      }}>SUPER</span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
                    {o.perfil_na_org === 'super_admin' ? 'Super-administrador' :
                     o.perfil_na_org === 'admin' ? 'Administrador' :
                     o.perfil_na_org === 'financeiro' ? 'Financeiro' :
                     o.perfil_na_org === 'operador' ? 'Operador' :
                     o.perfil_na_org}
                  </div>
                </div>

                {/* Seta ou loading */}
                <div style={{ flexShrink: 0 }}>
                  {isLoading ? (
                    <div style={{
                      width: 18, height: 18, border: '2px solid #E2E8F0',
                      borderTopColor: '#2563EB', borderRadius: '50%',
                      animation: 'spin .7s linear infinite',
                    }} />
                  ) : (
                    <svg width="18" height="18" fill="none" stroke={isAtiva ? '#2563EB' : '#94A3B8'} strokeWidth="2" viewBox="0 0 24 24">
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Erro */}
        {erro && (
          <div style={{
            marginTop: 16, padding: '10px 14px', background: '#FEF2F2',
            border: '1px solid #FECACA', borderRadius: 10, fontSize: 13, color: '#DC2626',
          }}>
            {erro}
          </div>
        )}

        {/* Ações secundárias */}
        <div style={{ display: 'flex', gap: 12, marginTop: 20, justifyContent: 'center' }}>
          {onCancel && (
            <button onClick={onCancel}
              style={{
                padding: '10px 16px', background: 'transparent', border: 'none',
                fontSize: 13, color: '#64748B', cursor: 'pointer', fontFamily: 'inherit',
              }}>
              Cancelar
            </button>
          )}
          <button onClick={logout}
            style={{
              padding: '10px 16px', background: 'transparent', border: 'none',
              fontSize: 13, color: '#64748B', cursor: 'pointer', fontFamily: 'inherit',
            }}>
            Sair da conta
          </button>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
