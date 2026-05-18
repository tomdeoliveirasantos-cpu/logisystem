import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { useToast, Toast } from '../components/UI';

const OPCOES = [
  { value: 'obrigatorio', label: 'Obrigatório', cor: '#16a34a', bg: '#f0fdf4' },
  { value: 'opcional',    label: 'Opcional',    cor: '#2563eb', bg: '#eff6ff' },
  { value: 'oculto',      label: 'Oculto',      cor: '#dc2626', bg: '#fef2f2' },
];

export default function ParametrosCadastroPublico() {
  const [catalogo, setCatalogo] = useState({ campos: [], passos: [] });
  const [params, setParams] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [updatedBy, setUpdatedBy] = useState(null);
  const [dirty, setDirty] = useState(false);
  const { toast, showToast } = useToast();

  const carregar = async () => {
    try {
      setLoading(true);
      const cat = await api.get('/cadastro-publico-params/catalogo');
      const p = await api.get('/cadastro-publico-params');
      setCatalogo(cat);
      setParams(p.parametros);
      setUpdatedAt(p.updated_at);
      setUpdatedBy(p.updated_by);
      setDirty(false);
    } catch (e) {
      showToast('Erro ao carregar: ' + e.message, 'error');
    }
    setLoading(false);
  };

  useEffect(() => { carregar(); }, []);

  const setCampo = (chave, valor) => {
    setParams(p => ({ ...p, [chave]: valor }));
    setDirty(true);
  };

  const salvar = async () => {
    try {
      setSaving(true);
      // Envia só os campos que não são fixos (backend filtra mesmo, mas evitamos payload grande)
      const payload = {};
      for (const c of catalogo.campos) {
        if (!c.fixo && params[c.chave]) payload[c.chave] = params[c.chave];
      }
      const r = await api.put('/cadastro-publico-params', { parametros: payload });
      setParams(r.parametros);
      setUpdatedAt(r.updated_at);
      setUpdatedBy(r.updated_by);
      setDirty(false);
      showToast('Parâmetros salvos!');
    } catch (e) {
      showToast('Erro ao salvar: ' + e.message, 'error');
    }
    setSaving(false);
  };

  const restaurar = async () => {
    if (!confirm('Tem certeza? Isso irá apagar todos os parâmetros customizados e voltar aos padrões do sistema.')) return;
    try {
      setSaving(true);
      const r = await api.post('/cadastro-publico-params/restaurar-defaults');
      setParams(r.parametros);
      setUpdatedAt(null);
      setUpdatedBy(null);
      setDirty(false);
      showToast('Padrões restaurados!');
    } catch (e) {
      showToast('Erro: ' + e.message, 'error');
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div>
        <div className="page-header">
          <div>
            <div className="page-title">Parâmetros do Cadastro Público</div>
            <div className="page-desc">Carregando...</div>
          </div>
        </div>
      </div>
    );
  }

  // Agrupar campos por passo, e dentro do passo por grupo
  const camposPorPasso = {};
  for (const c of catalogo.campos) {
    if (!camposPorPasso[c.passo]) camposPorPasso[c.passo] = [];
    camposPorPasso[c.passo].push(c);
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Parâmetros do Cadastro Público</div>
          <div className="page-desc">
            Configure quais campos os colaboradores precisam preencher quando recebem o convite via WhatsApp.
            {updatedAt && (
              <span style={{display:'block', fontSize:12, color:'var(--text3)', marginTop:4}}>
                Última alteração: {new Date(updatedAt).toLocaleString('pt-BR')} por {updatedBy || '—'}
              </span>
            )}
          </div>
        </div>
        <div style={{display:'flex', gap:8, alignItems:'center'}}>
          <button className="btn btn-ghost" onClick={restaurar} disabled={saving}>↺ Restaurar Padrões</button>
          <button className="btn btn-primary" onClick={salvar} disabled={saving || !dirty}>
            {saving ? 'Salvando...' : (dirty ? '💾 Salvar' : '✓ Salvo')}
          </button>
        </div>
      </div>

      <div className="page-body">
        <div style={{display:'flex', flexDirection:'column', gap:16}}>
          {catalogo.passos.map(passo => {
            const campos = camposPorPasso[passo.id] || [];
            if (campos.length === 0) return null;

            // Agrupar por "grupo" dentro do passo
            const porGrupo = {};
            campos.forEach(c => {
              const g = c.grupo || passo.titulo;
              if (!porGrupo[g]) porGrupo[g] = [];
              porGrupo[g].push(c);
            });

            return (
              <div key={passo.id} className="card fade-up">
                <div style={{padding:'14px 18px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:10}}>
                  <div style={{width:28, height:28, borderRadius:14, background:'#2563eb', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:700}}>
                    {passo.id + 1}
                  </div>
                  <div style={{fontSize:15, fontWeight:600}}>{passo.titulo}</div>
                </div>

                <div style={{padding:'14px 18px'}}>
                  {Object.entries(porGrupo).map(([grupo, lista]) => (
                    <div key={grupo} style={{marginBottom:18}}>
                      <div style={{fontSize:11, fontWeight:600, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:10}}>
                        {grupo}
                      </div>
                      <div style={{display:'flex', flexDirection:'column', gap:8}}>
                        {lista.map(campo => (
                          <CampoLinha
                            key={campo.chave}
                            campo={campo}
                            valor={params[campo.chave] || campo.default}
                            onChange={(v) => setCampo(campo.chave, v)}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <Toast {...toast} />
    </div>
  );
}

function CampoLinha({ campo, valor, onChange }) {
  return (
    <div style={{
      display:'flex',
      alignItems:'center',
      gap:12,
      padding:'10px 14px',
      borderRadius:8,
      background: campo.fixo ? 'rgba(0,0,0,0.02)' : 'var(--bg2)',
      border:'1px solid var(--border)',
    }}>
      <div style={{flex:1, minWidth:0}}>
        <div style={{fontSize:13, fontWeight:500}}>
          {campo.label}
          {campo.fixo && <span style={{fontSize:10, marginLeft:8, color:'var(--text3)', fontWeight:400}}>(sempre obrigatório)</span>}
          {campo.tipo === 'arquivo' && <span style={{fontSize:10, marginLeft:8, color:'var(--text3)', fontWeight:400}}>📎 anexo</span>}
        </div>
        <div style={{fontSize:11, color:'var(--text3)', marginTop:2}}>
          chave técnica: <code style={{fontSize:11}}>{campo.chave}</code>
        </div>
      </div>
      <div style={{display:'flex', gap:6, flexWrap:'wrap'}}>
        {OPCOES.map(op => {
          const ativo = valor === op.value;
          const desabilitado = campo.fixo && op.value !== 'obrigatorio';
          return (
            <label key={op.value} style={{
              padding:'6px 12px',
              borderRadius:6,
              fontSize:12,
              fontWeight:500,
              cursor: desabilitado ? 'not-allowed' : 'pointer',
              opacity: desabilitado ? 0.4 : 1,
              background: ativo ? op.bg : '#fff',
              color: ativo ? op.cor : 'var(--text2)',
              border: `1.5px solid ${ativo ? op.cor : 'var(--border)'}`,
              transition:'all .15s',
              display:'flex', alignItems:'center', gap:6,
            }}>
              <input
                type="radio"
                name={`campo_${campo.chave}`}
                checked={ativo}
                disabled={desabilitado}
                onChange={() => onChange(op.value)}
                style={{display:'none'}}
              />
              {ativo && '✓ '}{op.label}
            </label>
          );
        })}
      </div>
    </div>
  );
}
