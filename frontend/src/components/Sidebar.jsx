import { useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Sidebar({ collapsed, onToggle, mobileOpen, onMobileClose }) {
  const { pathname } = useLocation();
  const { podeAcessar } = useAuth();

  const nav = [
    {
      label: 'Cadastros',
      items: [
        { to: '/clientes',        icon: '👥', label: 'Clientes',          mod: 'clientes' },
        { to: '/transportadoras', icon: '🏢', label: 'Transportadoras',   mod: 'transportadoras' },
        { to: '/veiculos',        icon: '🚛', label: 'Frota / Veículos',  mod: 'veiculos' },
        { to: '/motoristas',      icon: '👤', label: 'Motoristas',        mod: 'motoristas' },
      ],
    },
    {
      label: 'Operacional',
      items: [
        { to: '/ordens',      icon: '📋', label: 'Ordens de Transporte', mod: 'ordens' },
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
      ],
    },
    {
      label: 'Relatórios',
      items: [
        { to: '/',           icon: '📊', label: 'Dashboard',  mod: 'relatorios' },
        { to: '/relatorios', icon: '📈', label: 'Relatórios', mod: 'relatorios' },
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
          <div className="brand-icon">L</div>
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

        {/* Version */}
        {!collapsed && (
          <div style={{marginTop:'auto',padding:'14px',borderTop:'1px solid rgba(255,255,255,.08)'}}>
            <div style={{fontSize:11,color:'rgba(255,255,255,.25)'}}>LogiSystem v3.0</div>
          </div>
        )}
      </aside>
    </>
  );
}
