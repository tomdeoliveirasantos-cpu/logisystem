import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { useToast, Toast } from '../components/UI';
import { useAuth } from '../context/AuthContext';

const CAMPOS = [
  { chave: 'ordem_campo_numero_rota',   label: 'Número da Rota',  desc: 'Identificador da rota/viagem' },
  { chave: 'ordem_campo_seq',           label: 'Sequência',       desc: 'Ordem de parada dentro da rota' },
  { chave: 'ordem_campo_nf',            label: 'NF',              desc: 'Número da nota fiscal' },
  { chave: 'ordem_campo_peso',          label: 'Peso (kg)',        desc: 'Peso da carga em quilogramas' },
  { chave: 'ordem_campo_remessa',       label: 'Remessa',         desc: 'Número da remessa/romaneio' },
  { chave: 'ordem_campo_tarifa',        label: 'Tarifa aplicada', desc: 'Vincula a tabela de fretes à ordem' },
  { chave: 'ordem_campo_ajuda_diesel',  label: 'Ajuda Diesel',    desc: 'Valor extra para combustível' },
  { chave: 'ordem_campo_taxa_descarga', label: 'Taxa de Descarga',desc: 'Custo de descarga no destino' },
  { chave: 'ordem_campo_obs',           label: 'Observações',     desc: 'Campo livre para anotações' },
  { chave: 'ordem_campo_anexo',         label: 'Anexo',           desc: 'Upload de NF, romaneio ou comprovante' },
];

const OPCOES = [
  { value: 'obrigatorio', label: 'Obrigatório', color: '#DC2626', bg: '#FEF2F2', desc: 'Campo visível e exige preenchimento' },
  { value: 'opcional',    label: 'Opcional',    color: '#2563EB', bg: '#EEF4FF', desc: 'Campo visível, preenchimento livre' },
  { value: 'oculto',      label: 'Oculto',      color: '#9BAABB', bg: '#F1F4F9', desc: 'Campo não aparece no formulário' },
];

function StatusPill({ value }) {
  const op = OPCOES.find(o => o.value === value) || OPCOES[1];
  return (
    <span style={{ display:'inline-flex', alignItems:'center', padding:'3px 10px', borderRadius:99,
      background: op.bg, color: op.color, fontSize:11, fontWeight:600 }}>
      {op.label}
    </span>
  );
}

export default function Parametros() {
  const { user } = useAuth();
  const isAdmin = user?.perfil === 'admin';
  const [params, setParams]   = useState({});
  const [edited, setEdited]   = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const { toast, showToast }  = useToast();

  useEffect(() => {
    api.get('/parametros')
      .then(data => { setParams(data); setEdited(data); })
      .catch(e => showToast(e.message, 'error'))
      .finally(() => setLoading(false));
  }, []);

  const set = (chave, valor) => setEdited(e => ({ ...e, [chave]: valor }));

  const hasChanges = JSON.stringify(params) !== JSON.stringify(edited);

  const save = async () => {
    setSaving(true);
    try {
      const updated = await api.put('/parametros', edited);
      setParams(updated); setEdited(updated);
      showToast('Parâmetros salvos com sucesso!');
    } catch(e) { showToast(e.message, 'error'); }
    finally { setSaving(false); }
  };

  const reset = () => setEdited({ ...params });

  if (loading) return (
    <div>
      <div className="page-header"><div className="page-title">Parâmetros</div></div>
      <div className="page-body">
        <div className="card" style={{textAlign:'center',padding:'40px',color:'var(--text3)'}}>Carregando configurações...</div>
      </div>
    </div>
  );

  return (
    <div>
      <div className="page-header">
        <div style={{flex:1}}>
          <div className="page-title">Parâmetros do sistema</div>
        </div>
        {isAdmin && hasChanges && (
          <div style={{display:'flex',gap:8}}>
            <button className="btn btn-ghost" onClick={reset}>Cancelar</button>
            <button className="btn btn-primary" onClick={save} disabled={saving}>
              {saving ? 'Salvando...' : '✓ Salvar alterações'}
            </button>
          </div>
        )}
      </div>

      <div className="page-body">
        {/* Aviso para não-admin */}
        {!isAdmin && (
          <div style={{padding:'12px 16px',background:'var(--amber-bg)',border:'1px solid var(--amber)',borderRadius:'var(--radius)',marginBottom:16,fontSize:13,color:'var(--amber)'}}>
            Apenas administradores podem alterar os parâmetros. Você está visualizando as configurações atuais.
          </div>
        )}

        {/* Card principal */}
        <div className="card fade-up" style={{marginBottom:16}}>
          <div style={{marginBottom:18}}>
            <div className="section-title">Campos da Ordem de Transporte</div>
            <div style={{fontSize:12,color:'var(--text3)',marginTop:4}}>
              Configure quais campos aparecem no formulário de lançamento de ordens.
              Campos obrigatórios bloqueiam o envio se não preenchidos.
            </div>
          </div>

          {/* Legenda */}
          <div style={{display:'flex',gap:12,marginBottom:20,flexWrap:'wrap'}}>
            {OPCOES.map(op => (
              <div key={op.value} style={{display:'flex',alignItems:'center',gap:6,fontSize:12,color:'var(--text2)'}}>
                <span style={{display:'inline-block',width:10,height:10,borderRadius:'50%',background:op.color}}/>
                <strong style={{color:op.color}}>{op.label}</strong> — {op.desc}
              </div>
            ))}
          </div>

          {/* Tabela de campos */}
          <div style={{border:'1px solid var(--border)',borderRadius:'var(--radius)',overflow:'hidden'}}>
            <table style={{minWidth:'auto'}}>
              <thead>
                <tr>
                  <th style={{width:'35%'}}>Campo</th>
                  <th style={{width:'30%'}}>Descrição</th>
                  <th style={{width:'15%'}}>Status atual</th>
                  {isAdmin && <th style={{width:'20%'}}>Alterar para</th>}
                </tr>
              </thead>
              <tbody>
                {CAMPOS.map((campo, i) => {
                  const val = edited[campo.chave] || 'opcional';
                  return (
                    <tr key={campo.chave} style={{background: i%2===0 ? 'transparent' : 'var(--bg3)'}}>
                      <td className="fw-500">{campo.label}</td>
                      <td style={{fontSize:12,color:'var(--text3)'}}>{campo.desc}</td>
                      <td><StatusPill value={val} /></td>
                      {isAdmin && (
                        <td>
                          <select
                            className="form-select"
                            style={{fontSize:12,padding:'5px 8px'}}
                            value={val}
                            onChange={e => set(campo.chave, e.target.value)}
                          >
                            {OPCOES.map(op => (
                              <option key={op.value} value={op.value}>{op.label}</option>
                            ))}
                          </select>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Preview */}
        <div className="card fade-up fade-up-1">
          <div style={{marginBottom:14}}>
            <div className="section-title">Prévia do formulário</div>
            <div style={{fontSize:12,color:'var(--text3)',marginTop:4}}>
              Campos que aparecerão ao criar uma nova ordem com as configurações atuais.
            </div>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:10}}>
            {/* Campos fixos */}
            {[
              {label:'Data', status:'obrigatorio'},
              {label:'Cliente', status:'obrigatorio'},
              {label:'Motorista', status:'obrigatorio'},
              {label:'Veículo', status:'obrigatorio'},
              {label:'Região', status:'obrigatorio'},
              {label:'Tipo', status:'obrigatorio'},
              {label:'Status', status:'obrigatorio'},
            ].map(f => (
              <div key={f.label} style={{padding:'10px 12px',background:'#F0FDF4',border:'1px solid #BBF7D0',borderRadius:'var(--radius)',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                <span style={{fontSize:13,fontWeight:500,color:'#1A2740'}}>{f.label}</span>
                <span style={{fontSize:10,color:'#16A34A',fontWeight:600}}>FIXO</span>
              </div>
            ))}
            {/* Campos configuráveis */}
            {CAMPOS.map(campo => {
              const val = edited[campo.chave] || 'opcional';
              if (val === 'oculto') return null;
              const op = OPCOES.find(o => o.value === val);
              return (
                <div key={campo.chave} style={{padding:'10px 12px',background:op.bg,border:`1px solid ${op.color}30`,borderRadius:'var(--radius)',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                  <span style={{fontSize:13,fontWeight:500,color:'#1A2740'}}>{campo.label}</span>
                  <StatusPill value={val} />
                </div>
              );
            })}
            {/* Ocultos */}
            {CAMPOS.filter(c => (edited[c.chave]||'opcional') === 'oculto').map(campo => (
              <div key={campo.chave} style={{padding:'10px 12px',background:'var(--bg3)',border:'1px dashed var(--border2)',borderRadius:'var(--radius)',display:'flex',alignItems:'center',justifyContent:'space-between',opacity:.5}}>
                <span style={{fontSize:13,color:'var(--text3)',textDecoration:'line-through'}}>{campo.label}</span>
                <span style={{fontSize:10,color:'var(--text3)',fontWeight:600}}>OCULTO</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      {toast && <Toast {...toast} />}
    </div>
  );
}
