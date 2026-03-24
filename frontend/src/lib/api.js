const BASE = 'http://wsdevsoft.ddns.net:3000/api';

function getToken() {
  return localStorage.getItem('logi_token');
}

async function req(path, opts = {}) {
  const token = getToken();
  const isFormData = opts.body instanceof FormData;
  const headers = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...opts.headers,
  };
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers,
    body: isFormData ? opts.body : opts.body ? JSON.stringify(opts.body) : undefined,
  });

  // Token expirado — redireciona para login
  if (res.status === 401) {
    localStorage.removeItem('logi_token');
    window.location.reload();
    return;
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Erro ${res.status}`);
  }
  return res.status === 204 ? null : res.json();
}

export const api = {
  get:    (p)       => req(p),
  post:   (p, body) => req(p, { method: 'POST', body }),
  put:    (p, body) => req(p, { method: 'PUT', body }),
  patch:  (p, body) => req(p, { method: 'PATCH', body }),
  delete: (p)       => req(p, { method: 'DELETE' }),
};
