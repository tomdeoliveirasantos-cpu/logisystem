import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

/**
 * Componente do header que mostra a org ativa e permite trocar.
 * Renderizado dentro do Sidebar.
 *
 * - Se usuário tem 1 org só: mostra apenas o nome (sem dropdown)
 * - Se tem 2+: clicável, abre lista de orgs
 * - Para super_admin com is_wsdevsoft: badge especial roxo
 */
export default function OrgSwitcher({ collapsed = false }) {
  const { org, orgs, selectOrg } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(null);
  const ref = useRef(null);

  // Fecha dropdown quando clica fora
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  if (!org) return null;
  const podeTrocar = orgs.length > 1;
  const isSuper = org.is_wsdevsoft;

  const handleSelect = async (orgId) => {
    if (orgId === org.id) { setOpen(false); return; }
    setLoading(orgId);
    try {
      await selectOrg(orgId);
      // Recarrega para limpar caches em memória das telas (ordens, clientes etc.)
      window.location.reload();
    } catch (e) {
      alert('Erro ao trocar organização: ' + e.message);
      setLoading(null);
    }
  };

  // Versão colapsada — apenas avatar circular
  if (collapsed) {
    return (
      <div ref={ref} style={{ position: 'relative', padding: '8px 0' }}>
        <button
          onClick={() => podeTrocar && setOpen(!open)}
          title={`${org.nome}${podeTrocar ? ' (clique para trocar)' : ''}`}
          style={{
            width: 34, height: 34, borderRadius: 9, border: 'none',
            background: isSuper ? 'linear-gradient(135deg, #6366F1, #4F46E5)'
                                : 'linear-gradient(135deg, #1D9E75, #0F6E56)',
            color: '#fff', fontSize: 14, fontWeight: 700,
            cursor: podeTrocar ? 'pointer' : 'default',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto', position: 'relative',
          }}>
          {org.nome.charAt(0).toUpperCase()}
          {podeTrocar && (
            <div style={{
              position: 'absolute', bottom: -2, right: -2,
              width: 12, height: 12, borderRadius: '50%',
              background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '1.5px solid #1A2740',
            }}>
              <svg width="6" height="6" fill="none" stroke="#1A2740" strokeWidth="3" viewBox="0 0 24 24">
                <path d="M6 9l6 6 6-6"/>
              </svg>
            </div>
          )}
        </button>
        {open && podeTrocar && (
          <OrgDropdown orgs={orgs} ativaId={org.id} onSelect={handleSelect} loading={loading} collapsed />
        )}
      </div>
    );
  }

  // Versão expandida — nome + perfil + chevron
  return (
    <div ref={ref} style={{ position: 'relative', padding: '0 12px', marginBottom: 4 }}>
      <button
        onClick={() => podeTrocar && setOpen(!open)}
        disabled={!podeTrocar}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 10,
          padding: '8px 10px', borderRadius: 10,
          background: 'rgba(255,255,255,.05)',
          border: '1px solid rgba(255,255,255,.08)',
          cursor: podeTrocar ? 'pointer' : 'default',
          fontFamily: 'inherit', textAlign: 'left',
          transition: 'all .15s',
        }}
        onMouseEnter={e => { if (podeTrocar) e.currentTarget.style.background = 'rgba(255,255,255,.1)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,.05)'; }}
      >
        {/* Avatar */}
        <div style={{
          width: 32, height: 32, borderRadius: 8, flexShrink: 0,
          background: isSuper ? 'linear-gradient(135deg, #6366F1, #4F46E5)'
                              : 'linear-gradient(135deg, #1D9E75, #0F6E56)',
          color: '#fff', fontSize: 13, fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {org.nome.charAt(0).toUpperCase()}
        </div>

        {/* Texto */}
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <div style={{
            fontSize: 10, fontWeight: 500, color: 'rgba(255,255,255,.5)',
            textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 1,
          }}>
            Empresa
          </div>
          <div style={{
            fontSize: 12, fontWeight: 600, color: '#fff',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {org.nome}
          </div>
        </div>

        {/* Chevron (só se pode trocar) */}
        {podeTrocar && (
          <svg width="12" height="12" fill="none" stroke="rgba(255,255,255,.5)" strokeWidth="2.5" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
            <path d="M6 9l6 6 6-6" />
          </svg>
        )}
      </button>

      {open && podeTrocar && (
        <OrgDropdown orgs={orgs} ativaId={org.id} onSelect={handleSelect} loading={loading} />
      )}
    </div>
  );
}

function OrgDropdown({ orgs, ativaId, onSelect, loading, collapsed = false }) {
  return (
    <div style={{
      position: 'absolute',
      top: '100%', left: collapsed ? '50%' : 12, right: collapsed ? 'auto' : 12,
      transform: collapsed ? 'translateX(-50%)' : 'none',
      marginTop: 6, minWidth: collapsed ? 220 : 'auto',
      background: '#fff', borderRadius: 12,
      boxShadow: '0 8px 32px rgba(0,0,0,.18), 0 2px 8px rgba(0,0,0,.1)',
      border: '1px solid #E2E8F0',
      zIndex: 1000, overflow: 'hidden',
    }}>
      <div style={{
        padding: '10px 14px 6px', fontSize: 10, fontWeight: 700,
        color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '.5px',
        borderBottom: '1px solid #F1F5F9',
      }}>
        Suas empresas
      </div>
      {orgs.map(o => {
        const isAtiva = o.id === ativaId;
        const isLoading = loading === o.id;
        return (
          <button
            key={o.id}
            onClick={() => onSelect(o.id)}
            disabled={loading !== null}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 14px', border: 'none', background: isAtiva ? '#F0F9FF' : '#fff',
              cursor: loading !== null ? 'wait' : 'pointer', textAlign: 'left',
              fontFamily: 'inherit', transition: 'background .1s',
            }}
            onMouseEnter={e => { if (!isAtiva && loading === null) e.currentTarget.style.background = '#F8FAFC'; }}
            onMouseLeave={e => { if (!isAtiva && loading === null) e.currentTarget.style.background = '#fff'; }}
          >
            <div style={{
              width: 28, height: 28, borderRadius: 7, flexShrink: 0,
              background: o.is_wsdevsoft ? 'linear-gradient(135deg, #6366F1, #4F46E5)'
                                          : 'linear-gradient(135deg, #1D9E75, #0F6E56)',
              color: '#fff', fontSize: 12, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {o.nome.charAt(0).toUpperCase()}
            </div>
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <div style={{
                fontSize: 13, fontWeight: 600, color: '#1A2740',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {o.nome}
                {o.is_wsdevsoft && (
                  <span style={{
                    marginLeft: 6, fontSize: 9, fontWeight: 700, padding: '1px 5px',
                    background: '#EEF2FF', color: '#4F46E5', borderRadius: 3,
                  }}>SUPER</span>
                )}
              </div>
              <div style={{ fontSize: 11, color: '#94A3B8' }}>
                {o.perfil_na_org === 'super_admin' ? 'Super-administrador' :
                 o.perfil_na_org === 'admin' ? 'Administrador' :
                 o.perfil_na_org === 'financeiro' ? 'Financeiro' :
                 o.perfil_na_org === 'operador' ? 'Operador' :
                 o.perfil_na_org}
              </div>
            </div>
            {isLoading ? (
              <div style={{
                width: 14, height: 14, border: '2px solid #E2E8F0',
                borderTopColor: '#2563EB', borderRadius: '50%',
                animation: 'spin .7s linear infinite', flexShrink: 0,
              }} />
            ) : isAtiva ? (
              <svg width="16" height="16" fill="none" stroke="#2563EB" strokeWidth="2.5" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
                <path d="M5 13l4 4L19 7" />
              </svg>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
