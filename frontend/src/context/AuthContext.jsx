import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

const API = 'https://api.wsdevsoft.com/api';

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [org, setOrg]         = useState(null);          // org ativa
  const [orgs, setOrgs]       = useState([]);            // lista de orgs do usuário
  const [pendingOrg, setPendingOrg] = useState(false);   // login fez mas precisa escolher org
  const [loading, setLoading] = useState(true);

  // Restaura sessão a partir do token salvo
  useEffect(() => {
    const token = localStorage.getItem('logi_token');
    if (!token) { setLoading(false); return; }

    fetch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data?.user) {
          localStorage.removeItem('logi_token');
          localStorage.removeItem('logi_org');
          return;
        }
        // data.user vem do JWT decodificado — pode ou não ter organizacao_id
        if (data.user.organizacao_id) {
          setUser({
            id: data.user.id, nome: data.user.nome, email: data.user.email,
            perfil: data.user.perfil,
          });
          setOrg({
            id: data.user.organizacao_id,
            nome: data.user.organizacao_nome,
            slug: data.user.organizacao_slug,
            perfil_na_org: data.user.perfil_na_org,
            is_wsdevsoft: data.user.is_wsdevsoft,
          });
          // Carrega lista de orgs em background
          fetch(`${API}/auth/me/orgs`, { headers: { Authorization: `Bearer ${token}` } })
            .then(r => r.ok ? r.json() : [])
            .then(list => setOrgs(list || []))
            .catch(() => {});
        } else if (data.user.pending_org) {
          // Token de pré-seleção restaurado — precisa escolher org
          setUser({
            id: data.user.id, nome: data.user.nome, email: data.user.email,
            perfil: data.user.perfil,
          });
          setPendingOrg(true);
          fetch(`${API}/auth/me/orgs`, { headers: { Authorization: `Bearer ${token}` } })
            .then(r => r.ok ? r.json() : [])
            .then(list => setOrgs(list || []))
            .catch(() => {});
        } else {
          // Token antigo sem organizacao_id — força relogin
          localStorage.removeItem('logi_token');
          localStorage.removeItem('logi_org');
        }
      })
      .catch(() => {
        localStorage.removeItem('logi_token');
        localStorage.removeItem('logi_org');
      })
      .finally(() => setLoading(false));
  }, []);

  // Login com email + senha
  const login = async (email, senha) => {
    const res = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, senha }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao fazer login');

    localStorage.setItem('logi_token', data.token);
    setOrgs(data.orgs || []);

    if (data.precisa_selecionar_org) {
      // Token de pré-seleção emitido — frontend mostra OrgSelector
      setUser(data.user);
      setPendingOrg(true);
      return { precisaSelecionarOrg: true, user: data.user, orgs: data.orgs };
    }

    // Login completo (1 org só)
    setUser(data.user);
    setOrg(data.org);
    setPendingOrg(false);
    localStorage.setItem('logi_org', JSON.stringify(data.org));
    return { precisaSelecionarOrg: false, user: data.user, org: data.org };
  };

  // Seleciona uma org (após login com múltiplas orgs OU para trocar de org)
  const selectOrg = async (organizacaoId) => {
    const token = localStorage.getItem('logi_token');
    if (!token) throw new Error('Não autenticado');

    const res = await fetch(`${API}/auth/select-org`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ organizacao_id: organizacaoId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao selecionar organização');

    localStorage.setItem('logi_token', data.token);
    localStorage.setItem('logi_org', JSON.stringify(data.org));
    setUser(data.user);
    setOrg(data.org);
    setPendingOrg(false);
    return data;
  };

  // Recarrega lista de orgs (útil quando vínculos mudam)
  const reloadOrgs = async () => {
    const token = localStorage.getItem('logi_token');
    if (!token) return;
    try {
      const res = await fetch(`${API}/auth/me/orgs`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setOrgs(await res.json());
    } catch {}
  };

  const logout = () => {
    localStorage.removeItem('logi_token');
    localStorage.removeItem('logi_org');
    setUser(null);
    setOrg(null);
    setOrgs([]);
    setPendingOrg(false);
  };

  const getToken = () => localStorage.getItem('logi_token');

  // Permissões legacy — mantém compatibilidade com o que já existe.
  // Super-admin tem acesso a tudo.
  const podeAcessar = (modulo) => {
    if (org?.is_wsdevsoft && org?.perfil_na_org === 'super_admin') return true;
    const perfil = org?.perfil_na_org || user?.perfil;
    const perms = {
      admin:       ['clientes','transportadoras','veiculos','motoristas','ordens','manutencoes','multas','financeiro','relatorios','usuarios'],
      operador:    ['clientes','transportadoras','veiculos','motoristas','ordens','manutencoes','multas'],
      financeiro:  ['clientes','ordens','financeiro','relatorios'],
      super_admin: ['clientes','transportadoras','veiculos','motoristas','ordens','manutencoes','multas','financeiro','relatorios','usuarios'],
    };
    return perms[perfil]?.includes(modulo) ?? false;
  };

  const isSuperAdmin = () => org?.is_wsdevsoft === true && org?.perfil_na_org === 'super_admin';

  return (
    <AuthContext.Provider value={{
      user, org, orgs, pendingOrg, loading,
      login, selectOrg, reloadOrgs, logout,
      getToken, podeAcessar, isSuperAdmin,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
