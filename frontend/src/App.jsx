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
import TabelaFretesPage from './pages/TabelaFretes';
import Romaneio from './pages/Romaneio';
import Importacao from './pages/Importacao';
import CadastroMotoristaPublico from './pages/CadastroMotoristaPublico';
import CadastrosMotorista from './pages/CadastrosMotorista';
import Fornecedores from './pages/Fornecedores';
import {
  ContasReceber, ContasPagar,
  Manutencoes, Multas, Veiculos, Motoristas,
} from './pages/OtherPages';
import Adiantamentos from './pages/Adiantamentos';

function UserMenu({ collapsed }) {
  const { user, logout } = useAuth();
  const perfilColor = { admin: '#22C55E', operador: '#60A5FA', financeiro: '#FBBF24' };
  const perfilLabel = { admin: 'Admin', operador: 'Operador', financeiro: 'Financeiro' };

  if (collapsed) return (
    <div style={{marginTop:'auto',borderTop:'1px solid rgba(255,255,255,.08)',padding:'10px 8px',display:'flex',flexDirection:'column',alignItems:'center',gap:8}}>
      <div
        style={{width:34,height:34,borderRadius:'50%',background:perfilColor[user?.perfil]||'#60A5FA',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:700,color:'#fff'}}
        title={`${user?.nome} — ${perfilLabel[user?.perfil]}`}
      >
        {user?.nome?.charAt(0).toUpperCase()}
      </div>
      <button
        onClick={logout}
        title="Sair"
        style={{background:'rgba(255,255,255,.07)',border:'none',borderRadius:8,width:34,height:34,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:'rgba(255,255,255,.6)',transition:'all .15s'}}
        onMouseEnter={e=>{e.currentTarget.style.background='rgba(220,38,38,.25)';e.currentTarget.style.color='#FCA5A5';}}
        onMouseLeave={e=>{e.currentTarget.style.background='rgba(255,255,255,.07)';e.currentTarget.style.color='rgba(255,255,255,.6)';}}
      >
        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>
        </svg>
      </button>
    </div>
  );

  return (
    <div style={{marginTop:'auto',padding:'10px 12px',borderTop:'1px solid rgba(255,255,255,.08)'}}>
      {/* Info do usuário */}
      <div style={{display:'flex',alignItems:'center',gap:10,padding:'6px 8px',borderRadius:10,marginBottom:6}}>
        <div style={{width:34,height:34,borderRadius:'50%',background:perfilColor[user?.perfil]||'#60A5FA',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:700,color:'#fff',flexShrink:0}}>
          {user?.nome?.charAt(0).toUpperCase()}
        </div>
        <div style={{flex:1,overflow:'hidden'}}>
          <div style={{fontSize:12,fontWeight:600,color:'#fff',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{user?.nome}</div>
          <div style={{fontSize:10,color:perfilColor[user?.perfil]||'#9BAABB',fontWeight:500}}>{perfilLabel[user?.perfil]}</div>
        </div>
      </div>

      {/* Botão Sair — sempre visível */}
      <button
        onClick={logout}
        style={{
          width:'100%', padding:'9px 12px',
          background:'rgba(255,255,255,.06)',
          border:'1px solid rgba(255,255,255,.1)',
          borderRadius:9, display:'flex', alignItems:'center', gap:8,
          fontSize:13, fontWeight:500, color:'rgba(255,255,255,.65)',
          cursor:'pointer', fontFamily:'inherit', transition:'all .15s',
        }}
        onMouseEnter={e=>{e.currentTarget.style.background='rgba(220,38,38,.2)';e.currentTarget.style.borderColor='rgba(220,38,38,.4)';e.currentTarget.style.color='#FCA5A5';}}
        onMouseLeave={e=>{e.currentTarget.style.background='rgba(255,255,255,.06)';e.currentTarget.style.borderColor='rgba(255,255,255,.1)';e.currentTarget.style.color='rgba(255,255,255,.65)';}}
      >
        <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>
        </svg>
        Sair da conta
      </button>
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
    <>
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
          <div className="mobile-topbar" style={{alignItems:'center',gap:10,padding:'0 16px',height:56,background:'#fff',borderBottom:'1px solid #E2E8F0',position:'sticky',top:0,zIndex:50}}>
            <button className="mobile-menu-btn" onClick={()=>setMobileOpen(true)}>
              <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M3 12h18M3 6h18M3 18h18"/></svg>
            </button>
            <span style={{fontSize:15,fontWeight:600,color:'#1A2740'}}>LogiSystem</span>
          </div>

          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/clientes" element={podeAcessar('clientes') ? <Clientes /> : <Navigate to="/" />} />
            <Route path="/transportadoras" element={podeAcessar('transportadoras') ? <Transportadoras /> : <Navigate to="/" />} />
            <Route path="/veiculos" element={podeAcessar('veiculos') ? <Veiculos /> : <Navigate to="/" />} />
            <Route path="/motoristas" element={podeAcessar('motoristas') ? <Motoristas /> : <Navigate to="/" />} />
            <Route path="/fornecedores" element={podeAcessar('manutencoes') ? <Fornecedores /> : <Navigate to="/" />} />
            <Route path="/ordens" element={podeAcessar('ordens') ? <Ordens /> : <Navigate to="/" />} />
            <Route path="/manutencoes" element={podeAcessar('manutencoes') ? <Manutencoes /> : <Navigate to="/" />} />
            <Route path="/multas" element={podeAcessar('multas') ? <Multas /> : <Navigate to="/" />} />
            <Route path="/receber" element={podeAcessar('financeiro') ? <ContasReceber /> : <Navigate to="/" />} />
            <Route path="/pagar" element={podeAcessar('financeiro') ? <ContasPagar /> : <Navigate to="/" />} />
            <Route path="/fretes" element={podeAcessar('financeiro') ? <TabelaFretesPage /> : <Navigate to="/" />} />
            <Route path="/adiantamentos" element={podeAcessar('financeiro') ? <Adiantamentos /> : <Navigate to="/" />} />
            <Route path="/relatorios" element={podeAcessar('relatorios') ? <Relatorios /> : <Navigate to="/" />} />
            <Route path="/romaneio" element={podeAcessar('relatorios') ? <Romaneio /> : <Navigate to="/" />} />
            <Route path="/importar" element={podeAcessar('ordens') ? <Importacao /> : <Navigate to="/" />} />
            <Route path="/cadastros-motorista" element={podeAcessar('motoristas') ? <CadastrosMotorista /> : <Navigate to="/" />} />
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
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/cadastro-motorista/:token" element={<CadastroMotoristaPublico />} />
        <Route path="/*" element={<AuthProvider><ProtectedApp /></AuthProvider>} />
      </Routes>
    </BrowserRouter>
  );
}
