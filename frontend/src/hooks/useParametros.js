import { useState, useEffect } from 'react';
import { api } from '../lib/api';

let cache = null;

export function useParametros() {
  const [params, setParams] = useState(cache || {});
  const [loading, setLoading] = useState(!cache);

  useEffect(() => {
    if (cache) { setParams(cache); setLoading(false); return; }
    api.get('/parametros')
      .then(data => { cache = data; setParams(data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const campo = (chave) => params[`ordem_campo_${chave}`] || 'opcional';
  const visivel = (chave) => campo(chave) !== 'oculto';
  const obrigatorio = (chave) => campo(chave) === 'obrigatorio';

  return { params, loading, campo, visivel, obrigatorio };
}
