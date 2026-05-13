import { useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const LogoutIcon = () => (
  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{flexShrink:0}}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>
  </svg>
);

export default function Sidebar({ collapsed, onToggle, mobileOpen, onMobileClose }) {
  const { pathname } = useLocation();
  const { podeAcessar, logout, user } = useAuth();

  const nav = [
    {
      label: 'Cadastros',
      items: [
        { to: '/clientes',        icon: '👥', label: 'Clientes',          mod: 'clientes' },
        { to: '/transportadoras', icon: '🏢', label: 'Transportadoras',   mod: 'transportadoras' },
        { to: '/veiculos',        icon: '🚛', label: 'Frota / Veículos',  mod: 'veiculos' },
        { to: '/motoristas',      icon: '👤', label: 'Colaboradores',     mod: 'motoristas' },
        { to: '/fornecedores',    icon: '🏪', label: 'Fornecedores',      mod: 'manutencoes' },
        { to: '/cadastros-motorista', icon: '📋', label: 'Cadastros',         mod: 'motoristas' },
      ],
    },
    {
      label: 'Operacional',
      items: [
        { to: '/ordens',      icon: '📋', label: 'Ordens de Transporte', mod: 'ordens' },
        { to: '/importar',    icon: '📁', label: 'Importar Planilha',    mod: 'ordens' },
        { to: '/manutencoes', icon: '🔧', label: 'Manutenção',           mod: 'manutencoes' },
        { to: '/multas',      icon: '⚠️', label: 'Multas',              mod: 'multas' },
      ],
    },
    {
      label: 'Financeiro',
      items: [
        { to: '/receber', icon: '📥', label: 'Contas a Receber', mod: 'financeiro' },
        { to: '/pagar',   icon: '📤', label: 'Contas a Pagar',   mod: 'financeiro' },
        { to: '/fretes',  icon: '💲', label: 'Tabela de Fretes', mod: 'financeiro' },
        { to: '/adiantamentos', icon: '💸', label: 'Adiantamentos',  mod: 'financeiro' },
      ],
    },
    {
      label: 'Relatórios',
      items: [
        { to: '/',           icon: '📊', label: 'Dashboard',  mod: 'relatorios' },
        { to: '/relatorios', icon: '📈', label: 'Relatórios', mod: 'relatorios' },
        { to: '/romaneio',  icon: '🖨️', label: 'Romaneio',   mod: 'relatorios' },
      ],
    },
    {
      label: 'Administração',
      items: [
        { to: '/usuarios',   icon: '🔐', label: 'Usuários',   mod: 'usuarios' },
        { to: '/parametros', icon: '⚙️', label: 'Parâmetros', mod: 'usuarios' },
      ],
    },
  ];

  const sidebarClass = [
    'sidebar',
    collapsed ? 'collapsed' : '',
    mobileOpen ? 'mobile-open' : '',
  ].filter(Boolean).join(' ');

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="sidebar-overlay active" onClick={onMobileClose} />
      )}

      <aside className={sidebarClass}>
        {/* Brand + toggle */}
        <div className="sidebar-brand">
          <div className="brand-icon" style={{background:'linear-gradient(135deg, #2563EB, #1D4ED8)',display:'flex',alignItems:'center',justifyContent:'center'}}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M3 8l4 10 3-7 3 7 4-10" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M19 6h3v3M22 6l-5 5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity=".6"/>
            </svg>
          </div>
          {!collapsed && (
            <div style={{flex:1,minWidth:0}}>
              <div className="brand-name">LogiSystem</div>
              <div className="brand-sub">Gestão de Transportes</div>
            </div>
          )}
          <button className="sidebar-toggle" onClick={onToggle} title={collapsed ? 'Expandir menu' : 'Recolher menu'}>
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              {collapsed
                ? <path d="M9 18l6-6-6-6"/>
                : <path d="M15 18l-6-6 6-6"/>
              }
            </svg>
          </button>
        </div>

        {/* Nav */}
        {nav.map(section => {
          const visibleItems = section.items.filter(item => podeAcessar(item.mod));
          if (!visibleItems.length) return null;
          return (
            <div key={section.label} className="nav-section">
              <div className="nav-label">{section.label}</div>
              {visibleItems.map(item => (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`nav-item ${pathname === item.to ? 'active' : ''}`}
                  style={{ textDecoration: 'none' }}
                  data-label={item.label}
                  onClick={onMobileClose}
                >
                  <span className="nav-icon">{item.icon}</span>
                  <span className="nav-text">{item.label}</span>
                </Link>
              ))}
            </div>
          );
        })}

        {/* Footer: versão + logout */}
        <div style={{marginTop:'auto',borderTop:'1px solid rgba(255,255,255,.08)'}}>

          {/* Info do usuário (expandido) */}
          {!collapsed && user && (
            <div style={{padding:'12px 14px 0',display:'flex',alignItems:'center',gap:10}}>
              <div style={{
                width:32,height:32,borderRadius:'50%',flexShrink:0,
                background:'linear-gradient(135deg,#3B82F6,#2563EB)',
                display:'flex',alignItems:'center',justifyContent:'center',
                fontSize:13,fontWeight:700,color:'#fff',
              }}>
                {user?.nome?.charAt(0).toUpperCase()}
              </div>
              <div style={{flex:1,overflow:'hidden'}}>
                <div style={{fontSize:12,fontWeight:600,color:'#fff',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{user?.nome}</div>
                <div style={{fontSize:10,color:'rgba(255,255,255,.4)',marginTop:1}}>{user?.email}</div>
              </div>
            </div>
          )}

          {/* Botão Sair */}
          <div style={{padding: collapsed ? '12px 8px' : '10px 10px 12px'}}>
            <button
              onClick={logout}
              title="Sair da conta"
              style={{
                width:'100%',
                padding: collapsed ? '10px' : '10px 12px',
                background:'rgba(255,255,255,.06)',
                border:'1px solid rgba(255,255,255,.1)',
                borderRadius:9,
                display:'flex',
                alignItems:'center',
                justifyContent: collapsed ? 'center' : 'flex-start',
                gap:8,
                fontSize:13,
                fontWeight:500,
                color:'rgba(255,255,255,.6)',
                cursor:'pointer',
                fontFamily:'inherit',
                transition:'all .15s',
              }}
              onMouseEnter={e=>{
                e.currentTarget.style.background='rgba(220,38,38,.2)';
                e.currentTarget.style.borderColor='rgba(220,38,38,.4)';
                e.currentTarget.style.color='#FCA5A5';
              }}
              onMouseLeave={e=>{
                e.currentTarget.style.background='rgba(255,255,255,.06)';
                e.currentTarget.style.borderColor='rgba(255,255,255,.1)';
                e.currentTarget.style.color='rgba(255,255,255,.6)';
              }}
            >
              <LogoutIcon />
              {!collapsed && <span>Sair</span>}
            </button>
          </div>

          {/* Versão + Marca */}
          {!collapsed && (
            <div style={{padding:'8px 14px 12px'}}>
              <a href="https://wsdevsoft.com" target="_blank" rel="noreferrer"
                style={{
                  display:'flex', alignItems:'center', gap:6,
                  textDecoration:'none', opacity:.4, transition:'opacity .2s',
                  marginBottom:4,
                }}
                onMouseEnter={e=>e.currentTarget.style.opacity='0.8'}
                onMouseLeave={e=>e.currentTarget.style.opacity='0.4'}>
                <svg width="14" height="14" viewBox="0 0 32 32" fill="none">
                  <rect width="32" height="32" rx="7" fill="url(#ws_sb)"/>
                  <path d="M6 12l4 10 3-7 3 7 4-10" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M22 10h4v4M26 10l-6 6" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity=".7"/>
                  <defs><linearGradient id="ws_sb" x1="0" y1="0" x2="32" y2="32"><stop stopColor="#6366F1"/><stop offset="1" stopColor="#4F46E5"/></linearGradient></defs>
                </svg>
                <span style={{fontSize:9,color:'rgba(255,255,255,.5)',letterSpacing:'.3px'}}>
                  por <strong style={{color:'rgba(255,255,255,.6)'}}>WsDevSoft</strong>
                </span>
              </a>
              <div style={{fontSize:9,color:'rgba(255,255,255,.15)'}}>LogiSystem v3.0</div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
