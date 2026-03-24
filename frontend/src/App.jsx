import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Sidebar from './components/Sidebar';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Clientes from './pages/Clientes';
import Transportadoras from './pages/Transportadoras';
import Ordens from './pages/Ordens';
import Relatorios from './pages/Relatorios';
import Usuarios from './pages/Usuarios';
import Parametros from './pages/Parametros';
import {
  ContasReceber, ContasPagar, TabelaFretes,
  Manutencoes, Multas, Veiculos, Motoristas,
} from './pages/OtherPages';

function UserMenu({ collapsed }) {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const perfilColor = { admin: '#16A34A', operador: '#2563EB', financeiro: '#D97706' };
  const perfilLabel = { admin: 'Admin', operador: 'Operador', financeiro: 'Financeiro' };

  if (collapsed) return (
    <div style={{padding:'10px 8px',borderTop:'1px solid rgba(255,255,255,.08)',display:'flex',justifyContent:'center'}}>
      <div style={{width:32,height:32,borderRadius:'50%',background:perfilColor[user?.perfil]||'#2563EB',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,color:'#fff',cursor:'pointer'}}
        title={`${user?.nome} — ${perfilLabel[user?.perfil]}`}
        onClick={logout}>
        {user?.nome?.charAt(0).toUpperCase()}
      </div>
    </div>
  );

  return (
    <div style={{marginTop:'auto',padding:'10px 12px',borderTop:'1px solid rgba(255,255,255,.08)',position:'relative'}}>
      <div onClick={()=>setOpen(!open)} style={{display:'flex',alignItems:'center',gap:10,cursor:'pointer',padding:'6px 8px',borderRadius:8,transition:'background .15s'}}
        onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,.08)'}
        onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
        <div style={{width:32,height:32,borderRadius:'50%',background:perfilColor[user?.perfil]||'#2563EB',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,color:'#fff',flexShrink:0}}>
          {user?.nome?.charAt(0).toUpperCase()}
        </div>
        <div style={{flex:1,overflow:'hidden'}}>
          <div style={{fontSize:12,fontWeight:500,color:'#fff',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{user?.nome}</div>
          <div style={{fontSize:10,color:perfilColor[user?.perfil]||'#9BAABB'}}>{perfilLabel[user?.perfil]}</div>
        </div>
        <span style={{color:'rgba(255,255,255,.4)',fontSize:10}}>{open?'▼':'▲'}</span>
      </div>
      {open && (
        <div style={{position:'absolute',bottom:'100%',left:8,right:8,background:'#fff',border:'1px solid #E2E8F0',borderRadius:10,boxShadow:'0 4px 16px rgba(0,0,0,.12)',overflow:'hidden',zIndex:200}}>
          <div style={{padding:'10px 14px',borderBottom:'1px solid #E2E8F0'}}>
            <div style={{fontSize:13,fontWeight:500,color:'#1A2740'}}>{user?.nome}</div>
            <div style={{fontSize:11,color:'#9BAABB'}}>{user?.email}</div>
          </div>
          <button onClick={logout} style={{width:'100%',padding:'10px 14px',background:'none',border:'none',textAlign:'left',fontSize:13,color:'#DC2626',cursor:'pointer',fontFamily:'inherit'}}>
            Sair da conta
          </button>
        </div>
      )}
    </div>
  );
}

function ProtectedApp() {
  const { user, loading, podeAcessar } = useAuth();
  const [collapsed, setCollapsed] = useState(() => window.innerWidth <= 900);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth <= 640) { setCollapsed(false); setMobileOpen(false); }
      else if (window.innerWidth <= 900) setCollapsed(true);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (loading) return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#F8F9FC',fontFamily:'system-ui'}}>
      <div style={{textAlign:'center'}}>
        <div style={{width:40,height:40,border:'3px solid #E2E8F0',borderTopColor:'#2563EB',borderRadius:'50%',animation:'spin .7s linear infinite',margin:'0 auto 12px'}}/>
        <div style={{fontSize:13,color:'#9BAABB'}}>Carregando...</div>
      </div>
    </div>
  );

  if (!user) return <Login />;

  const isMobile = window.innerWidth <= 640;

  return (
    <BrowserRouter>
      <div className="app-shell">
        <Sidebar
          collapsed={collapsed}
          onToggle={() => {
            if (isMobile) setMobileOpen(!mobileOpen);
            else setCollapsed(!collapsed);
          }}
          mobileOpen={mobileOpen}
          onMobileClose={() => setMobileOpen(false)}
          userMenu={<UserMenu collapsed={collapsed} />}
        />
        <div className={`main-content ${collapsed && !isMobile ? 'collapsed' : ''}`}>
          {/* Mobile top bar */}
          <div style={{display:'none',alignItems:'center',gap:10,padding:'0 16px',height:56,background:'#fff',borderBottom:'1px solid #E2E8F0',position:'sticky',top:0,zIndex:50}} className="mobile-topbar">
            <button className="mobile-menu-btn" style={{display:'flex'}} onClick={()=>setMobileOpen(true)}>
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M3 12h18M3 6h18M3 18h18"/></svg>
            </button>
            <span style={{fontSize:15,fontWeight:600,color:'#1A2740'}}>LogiSystem</span>
          </div>

          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/clientes" element={podeAcessar('clientes') ? <Clientes /> : <Navigate to="/" />} />
            <Route path="/transportadoras" element={podeAcessar('transportadoras') ? <Transportadoras /> : <Navigate to="/" />} />
            <Route path="/veiculos" element={podeAcessar('veiculos') ? <Veiculos /> : <Navigate to="/" />} />
            <Route path="/motoristas" element={podeAcessar('motoristas') ? <Motoristas /> : <Navigate to="/" />} />
            <Route path="/ordens" element={podeAcessar('ordens') ? <Ordens /> : <Navigate to="/" />} />
            <Route path="/manutencoes" element={podeAcessar('manutencoes') ? <Manutencoes /> : <Navigate to="/" />} />
            <Route path="/multas" element={podeAcessar('multas') ? <Multas /> : <Navigate to="/" />} />
            <Route path="/receber" element={podeAcessar('financeiro') ? <ContasReceber /> : <Navigate to="/" />} />
            <Route path="/pagar" element={podeAcessar('financeiro') ? <ContasPagar /> : <Navigate to="/" />} />
            <Route path="/fretes" element={podeAcessar('financeiro') ? <TabelaFretes /> : <Navigate to="/" />} />
            <Route path="/relatorios" element={podeAcessar('relatorios') ? <Relatorios /> : <Navigate to="/" />} />
            <Route path="/usuarios" element={podeAcessar('usuarios') ? <Usuarios /> : <Navigate to="/" />} />
            <Route path="/parametros" element={podeAcessar('usuarios') ? <Parametros /> : <Navigate to="/" />} />
          </Routes>
        </div>
      </div>

      <style>{`
        @media (max-width: 640px) {
          .mobile-topbar { display: flex !important; }
        }
      `}</style>
    </BrowserRouter>
  );
}

export default function App() {
  return <AuthProvider><ProtectedApp /></AuthProvider>;
}
