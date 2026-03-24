import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

const API = 'http://wsdevsoft.ddns.net:3000/api';

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('logi_token');
    if (!token) { setLoading(false); return; }
    fetch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.user) setUser(data.user); else localStorage.removeItem('logi_token'); })
      .catch(() => localStorage.removeItem('logi_token'))
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, senha) => {
    const res = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, senha }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao fazer login');
    localStorage.setItem('logi_token', data.token);
    setUser(data.user);
    return data.user;
  };

  const logout = () => {
    localStorage.removeItem('logi_token');
    setUser(null);
  };

  const getToken = () => localStorage.getItem('logi_token');

  const podeAcessar = (modulo) => {
    const perms = {
      admin:      ['clientes','transportadoras','veiculos','motoristas','ordens','manutencoes','multas','financeiro','relatorios','usuarios'],
      operador:   ['clientes','transportadoras','veiculos','motoristas','ordens','manutencoes','multas'],
      financeiro: ['clientes','ordens','financeiro','relatorios'],
    };
    return perms[user?.perfil]?.includes(modulo) ?? false;
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, getToken, podeAcessar }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
