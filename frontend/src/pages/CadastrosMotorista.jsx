import { useState } from 'react';
import { useFetch } from '../hooks/useFetch';
import { api } from '../lib/api';
import { Modal, Field, Input, StatusBadge, useToast, Toast, ExportBtn } from '../components/UI';

const fmtDate = d => {
  if (!d) return '—';
  const s = String(d).substring(0, 10);
  const dt = new Date(s + 'T12:00:00');
  return isNaN(dt) ? '—' : dt.toLocaleDateString('pt-BR');
};

const FRONTEND_URL = 'https://app.wsdevsoft.com';

export default function CadastrosMotorista() {
  const { data: cadastros, loading, refetch } = useFetch('/motorista-cadastros');
  const { data: convites, refetch: refetchConvites } = useFetch('/motorista-cadastros/convites/todos');
  const [tab, setTab] = useState('cadastros'); // cadastros | convites
  const [modalConvite, setModalConvite] = useState(false);
  const [nomeConvite, setNomeConvite] = useState('');
  const [modalDetalhe, setModalDetalhe] = useState(null);
  const [detalhe, setDetalhe] = useState(null);
  const [loadingDetalhe, setLoadingDetalhe] = useState(false);
  const [copied, setCopied] = useState('');
  const [gerandoConvite, setGerandoConvite] = useState(false);
  const { toast, showToast } = useToast();

  const rows = cadastros || [];
  const conviteRows = convites || [];

  // Gerar convite (com proteção contra duplo-clique)
  const gerarConvite = async () => {
    if (gerandoConvite) return;
    setGerandoConvite(true);
    try {
      const resp = await api.post('/motorista-cadastros/convites/gerar', { nome_motorista: nomeConvite });
      if (resp?._reused) {
        showToast(resp._msg || 'Já existia convite, retornando o existente.', 'warning');
      } else {
        showToast('Convite gerado!');
      }
      refetchConvites();
      setModalConvite(false);
      setNomeConvite('');
    } catch(e) {
      showToast(e.message, 'error');
    } finally {
      setGerandoConvite(false);
    }
  };

  // Copiar link
  const copiarLink = (token) => {
    const link = `${FRONTEND_URL}/cadastro-motorista/${token}`;
    navigator.clipboard.writeText(link);
    setCopied(token);
    showToast('Link copiado!');
    setTimeout(() => setCopied(''), 2000);
  };

  // Enviar via WhatsApp
  const enviarWhatsApp = (token, nomeMotorista) => {
    const link = `${FRONTEND_URL}/cadastro-motorista/${token}`;
    const msg = nomeMotorista
      ? `Olá ${nomeMotorista}! Segue o link para preencher seu cadastro de colaborador:\n\n${link}`
      : `Olá! Segue o link para preencher seu cadastro de colaborador:\n\n${link}`;
    const encoded = encodeURIComponent(msg);
    window.open(`https://wa.me/?text=${encoded}`, '_blank');
  };

  // Abrir detalhe
  const abrirDetalhe = async (id) => {
    setModalDetalhe(id);
    setLoadingDetalhe(true);
    try {
      const data = await api.get(`/motorista-cadastros/${id}`);
      setDetalhe(data);
    } catch(e) { showToast(e.message, 'error'); }
    setLoadingDetalhe(false);
  };

  // Toggle check
  const toggleCheck = async (field) => {
    if (!detalhe) return;
    const newVal = !detalhe[field];
    try {
      const updated = await api.patch(`/motorista-cadastros/${detalhe.id}/validar`, { [field]: newVal });
      setDetalhe(updated);
      refetch();
    } catch(e) { showToast(e.message, 'error'); }
  };

  // Comprime imagem grande antes do upload (mesma lógica do cadastro público)
  const compressImage = (file) => new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) return resolve(file);
    if (file.size < 1024 * 1024) return resolve(file);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const MAX = 1600;
        let { width: w, height: h } = img;
        if (w > MAX || h > MAX) {
          if (w >= h) { h = Math.round(h * MAX / w); w = MAX; }
          else        { w = Math.round(w * MAX / h); h = MAX; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        canvas.toBlob(blob => {
          if (!blob) return reject(new Error('Falha ao comprimir'));
          const nomeBase = file.name.replace(/\.(jpe?g|png|webp|heic|heif)$/i, '');
          resolve(new File([blob], `${nomeBase}.jpg`, { type: 'image/jpeg' }));
        }, 'image/jpeg', 0.75);
      };
      img.onerror = () => reject(new Error('Falha ao carregar imagem'));
      img.src = ev.target.result;
    };
    reader.onerror = () => reject(new Error('Falha ao ler arquivo'));
    reader.readAsDataURL(file);
  });

  // Anexar documento manualmente pelo admin
  const anexarDoc = async (campo, file, evento) => {
    if (!file || !detalhe) return;
    try {
      // Comprime se for imagem grande
      const arquivoFinal = await compressImage(file);
      if (arquivoFinal.size > 10 * 1024 * 1024) {
        showToast(`Arquivo grande demais: ${(arquivoFinal.size/1024/1024).toFixed(1)}MB (máx 10MB)`, 'error');
        if (evento?.target) evento.target.value = '';
        return;
      }
      const fd = new FormData();
      fd.append('arquivo', arquivoFinal);
      const token = localStorage.getItem('logi_token');
      const res = await fetch(`https://api.wsdevsoft.com/api/motorista-cadastros/${detalhe.id}/anexar/${campo}`, {
        method: 'PATCH',
        body: fd,
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || `Erro HTTP ${res.status}`);
      }
      const atualizado = await res.json();
      setDetalhe(atualizado);
      showToast('Documento anexado!');
      refetch();
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      if (evento?.target) evento.target.value = '';
    }
  };

  // Aprovar/Reprovar
  const mudarStatus = async (status) => {
    try {
      const updated = await api.patch(`/motorista-cadastros/${detalhe.id}/validar`, { status });
      setDetalhe(updated);
      showToast(status === 'aprovado' ? 'Cadastro aprovado!' : 'Cadastro reprovado.');
      refetch();
    } catch(e) { showToast(e.message, 'error'); }
  };

  // Download PDF do contrato
  const downloadPDF = async (id, nome) => {
    try {
      const token = localStorage.getItem('logi_token');
      const res = await fetch(`https://api.wsdevsoft.com/api/motorista-cadastros/${id}/contrato-pdf`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `contrato_${nome || 'colaborador'}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch(e) { showToast('Erro ao baixar PDF', 'error'); }
  };

  const statusMap = {
    pendente: { type: 'amber', label: 'Pendente' },
    aprovado: { type: 'green', label: 'Aprovado' },
    reprovado: { type: 'red', label: 'Reprovado' },
  };

  const conviteStatusMap = {
    pendente: { type: 'amber', label: 'Aguardando' },
    preenchido: { type: 'green', label: 'Preenchido' },
  };

  const cols = [
    {key:'nome',label:'Nome'},{key:'cpf',label:'CPF'},{key:'cnpj',label:'CNPJ'},
    {key:'veiculo_placa',label:'Placa'},{key:'telefone',label:'Telefone'},
    {key:'status',label:'Status'},
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Cadastro de Colaboradores</div>
          <div className="page-desc">Formulários de cadastro, documentos e contratos</div>
        </div>
        <div style={{display:'flex',gap:8}}>
          <ExportBtn rows={rows} filename="cadastros_colaboradores" columns={cols.map(c=>({key:c.key,label:c.label}))} />
          <button className="btn btn-primary" onClick={()=>setModalConvite(true)}>+ Gerar Convite</button>
        </div>
      </div>

      <div className="page-body">
        {/* Tabs */}
        <div style={{display:'flex',gap:4,marginBottom:16}}>
          <button
            className={`btn btn-sm ${tab==='cadastros' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={()=>setTab('cadastros')}
          >
            Cadastros ({rows.length})
          </button>
          <button
            className={`btn btn-sm ${tab==='convites' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={()=>setTab('convites')}
          >
            Convites ({conviteRows.length})
          </button>
        </div>

        {/* ── Lista de Cadastros ── */}
        {tab === 'cadastros' && (
          <div className="card fade-up">
            <div className="table-wrap"><table>
              <thead><tr>
                <th>Nome</th><th>CPF</th><th>CNPJ</th><th>Placa</th><th>Telefone</th><th>Status</th><th>Docs</th><th></th>
              </tr></thead>
              <tbody>
                {loading && Array.from({length:4}).map((_,i)=>(
                  <tr key={i}>{Array.from({length:8}).map((_,j)=>(
                    <td key={j}><div style={{height:12,background:'var(--bg3)',borderRadius:4,width:'60%'}}/></td>
                  ))}</tr>
                ))}
                {!loading && !rows.length && (
                  <tr><td colSpan={8} style={{textAlign:'center',color:'var(--text3)',padding:'32px 0'}}>
                    Nenhum cadastro recebido ainda
                  </td></tr>
                )}
                {rows.map(r => {
                  const checks = [r.check_cnh, r.check_cnpj, r.check_rntrc, r.check_endereco].filter(Boolean).length;
                  const st = statusMap[r.status] || statusMap.pendente;
                  return (
                    <tr key={r.id}>
                      <td className="fw-500">{r.nome || '—'}</td>
                      <td style={{fontSize:12}}>{r.cpf || '—'}</td>
                      <td style={{fontSize:12}}>{r.cnpj || '—'}</td>
                      <td><span className="badge badge-teal">{r.veiculo_placa || '—'}</span></td>
                      <td style={{fontSize:12}}>{r.telefone || '—'}</td>
                      <td><StatusBadge status={r.status} /></td>
                      <td>
                        <span style={{fontSize:12, color: checks === 4 ? 'var(--green)' : 'var(--text3)'}}>
                          {checks}/4 ✓
                        </span>
                      </td>
                      <td>
                        <div style={{display:'flex',gap:4}}>
                          <button className="btn btn-ghost btn-sm" onClick={()=>abrirDetalhe(r.id)}>Ver</button>
                          <button className="btn btn-ghost btn-sm" onClick={()=>downloadPDF(r.id, r.nome)} title="Baixar contrato PDF">PDF</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table></div>
          </div>
        )}

        {/* ── Lista de Convites ── */}
        {tab === 'convites' && (
          <div className="card fade-up">
            <div className="table-wrap"><table>
              <thead><tr>
                <th>Nome</th><th>Criado em</th><th>Expira em</th><th>Status</th><th>Ações</th>
              </tr></thead>
              <tbody>
                {!conviteRows.length && (
                  <tr><td colSpan={5} style={{textAlign:'center',color:'var(--text3)',padding:'32px 0'}}>
                    Nenhum convite gerado
                  </td></tr>
                )}
                {conviteRows.map(c => {
                  const expired = c.expires_at && new Date(c.expires_at) < new Date();
                  const st = c.status === 'preenchido' ? conviteStatusMap.preenchido : expired ? { type: 'red', label: 'Expirado' } : conviteStatusMap.pendente;
                  const ativo = c.status !== 'preenchido' && !expired;
                  return (
                    <tr key={c.id}>
                      <td className="fw-500">{c.nome_motorista || '—'}</td>
                      <td style={{fontSize:12}}>{fmtDate(c.created_at)}</td>
                      <td style={{fontSize:12}}>{fmtDate(c.expires_at)}</td>
                      <td><span className={`badge badge-${st.type}`}>{st.label}</span></td>
                      <td>
                        {ativo && (
                          <div style={{display:'flex',gap:4,alignItems:'center'}}>
                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={()=>copiarLink(c.token)}
                            >
                              {copied === c.token ? '✓ Copiado' : '📋 Copiar'}
                            </button>
                            <button
                              className="btn btn-sm"
                              onClick={()=>enviarWhatsApp(c.token, c.nome_motorista)}
                              title="Enviar link via WhatsApp"
                              style={{
                                background:'#25D366',
                                color:'#fff',
                                border:'none',
                                display:'inline-flex',
                                alignItems:'center',
                                gap:4,
                                fontSize:12,
                                fontWeight:500,
                                padding:'4px 10px',
                                borderRadius:6,
                                cursor:'pointer',
                              }}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                              </svg>
                              WhatsApp
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table></div>
          </div>
        )}
      </div>

      {/* ── Modal Gerar Convite ── */}
      {modalConvite && (
        <div className="modal-backdrop" onClick={e=>e.target===e.currentTarget&&setModalConvite(false)}>
          <div className="modal" style={{maxWidth:420}}>
            <div className="modal-header">
              <span className="modal-title">Gerar Convite</span>
              <button className="modal-close" onClick={()=>setModalConvite(false)}>×</button>
            </div>
            <div className="modal-body">
              <Field label="Nome do colaborador (opcional)">
                <Input value={nomeConvite} onChange={e=>setNomeConvite(e.target.value)} placeholder="Ex: João Silva" />
              </Field>
              <p style={{fontSize:12, color:'var(--text3)', marginTop:8}}>
                Um link será gerado com validade de 7 dias. Envie para o colaborador preencher.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={()=>setModalConvite(false)} disabled={gerandoConvite}>Cancelar</button>
              <button className="btn btn-primary" onClick={gerarConvite} disabled={gerandoConvite} style={{opacity: gerandoConvite ? 0.6 : 1}}>
                {gerandoConvite ? 'Gerando...' : 'Gerar Convite'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Detalhe do Cadastro ── */}
      {modalDetalhe && (
        <div className="modal-backdrop" onClick={e=>e.target===e.currentTarget&&(setModalDetalhe(null),setDetalhe(null))}>
          <div className="modal" style={{maxWidth:700, maxHeight:'90vh', overflow:'auto'}}>
            <div className="modal-header">
              <span className="modal-title">Detalhe do Cadastro</span>
              <button className="modal-close" onClick={()=>{setModalDetalhe(null);setDetalhe(null);}}>×</button>
            </div>
            <div className="modal-body">
              {loadingDetalhe ? (
                <div style={{textAlign:'center',padding:40,color:'var(--text3)'}}>Carregando...</div>
              ) : detalhe ? (
                <div>
                  {/* Status */}
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
                    <StatusBadge status={detalhe.status} />
                    {detalhe.validado_em && <span style={{fontSize:11,color:'var(--text3)'}}>Validado em {fmtDate(detalhe.validado_em)} por {detalhe.validado_por}</span>}
                  </div>

                  {/* Dados PF */}
                  <h4 style={{fontSize:13,fontWeight:600,marginBottom:8,color:'var(--text1)'}}>Pessoa Física</h4>
                  <div className="form-grid cols-2" style={{marginBottom:16}}>
                    <div><span style={{fontSize:11,color:'var(--text3)'}}>Nome</span><div className="fw-500">{detalhe.nome || '—'}</div></div>
                    <div><span style={{fontSize:11,color:'var(--text3)'}}>CPF</span><div>{detalhe.cpf || '—'}</div></div>
                    <div><span style={{fontSize:11,color:'var(--text3)'}}>RG</span><div>{detalhe.rg || '—'}</div></div>
                    <div><span style={{fontSize:11,color:'var(--text3)'}}>CNH</span><div>{detalhe.cnh_numero || '—'} ({detalhe.cnh_categoria || '—'}) val. {fmtDate(detalhe.cnh_validade)}</div></div>
                    <div><span style={{fontSize:11,color:'var(--text3)'}}>Endereço</span><div>{detalhe.endereco || '—'}, {detalhe.bairro || ''}, {detalhe.cidade || '—'}/{detalhe.estado || '—'}</div></div>
                    <div><span style={{fontSize:11,color:'var(--text3)'}}>Telefone / Email</span><div>{detalhe.telefone || '—'} | {detalhe.email || '—'}</div></div>
                  </div>

                  {/* Dados PJ */}
                  <h4 style={{fontSize:13,fontWeight:600,marginBottom:8,color:'var(--text1)'}}>Pessoa Jurídica</h4>
                  <div className="form-grid cols-2" style={{marginBottom:16}}>
                    <div><span style={{fontSize:11,color:'var(--text3)'}}>Razão Social</span><div className="fw-500">{detalhe.razao_social || '—'}</div></div>
                    <div><span style={{fontSize:11,color:'var(--text3)'}}>CNPJ</span><div>{detalhe.cnpj || '—'}</div></div>
                    <div><span style={{fontSize:11,color:'var(--text3)'}}>Endereço PJ</span><div>{detalhe.endereco_pj || '—'}, {detalhe.cidade_pj || '—'}/{detalhe.estado_pj || '—'}</div></div>
                    <div><span style={{fontSize:11,color:'var(--text3)'}}>Abertura</span><div>{fmtDate(detalhe.data_abertura)}</div></div>
                  </div>

                  {/* Veículo */}
                  <h4 style={{fontSize:13,fontWeight:600,marginBottom:8,color:'var(--text1)'}}>Veículo</h4>
                  <div className="form-grid cols-2" style={{marginBottom:16}}>
                    <div><span style={{fontSize:11,color:'var(--text3)'}}>Placa</span><div className="badge badge-teal">{detalhe.veiculo_placa || '—'}</div></div>
                    <div><span style={{fontSize:11,color:'var(--text3)'}}>Modelo</span><div>{detalhe.veiculo_modelo || '—'}</div></div>
                    <div><span style={{fontSize:11,color:'var(--text3)'}}>Ano</span><div>{detalhe.veiculo_ano || '—'}</div></div>
                    <div><span style={{fontSize:11,color:'var(--text3)'}}>RNTRC</span><div>{detalhe.veiculo_rntrc || '—'}</div></div>
                  </div>

                  {/* Bancário */}
                  <h4 style={{fontSize:13,fontWeight:600,marginBottom:8,color:'var(--text1)'}}>Dados Bancários</h4>
                  <div className="form-grid cols-2" style={{marginBottom:16}}>
                    <div><span style={{fontSize:11,color:'var(--text3)'}}>Banco</span><div>{detalhe.banco || '—'}</div></div>
                    <div><span style={{fontSize:11,color:'var(--text3)'}}>Agência / Conta</span><div>{detalhe.agencia || '—'} / {detalhe.conta || '—'} ({detalhe.tipo_conta || '—'})</div></div>
                    <div><span style={{fontSize:11,color:'var(--text3)'}}>PIX</span><div className="fw-500">{detalhe.pix || '—'}</div></div>
                  </div>

                  {/* Checklist de Documentos */}
                  <h4 style={{fontSize:13,fontWeight:600,marginBottom:8,color:'var(--text1)'}}>Checklist de Documentos</h4>
                  <div style={{display:'grid',gap:8,marginBottom:16}}>
                    {[
                      { field: 'check_cnh', label: 'CNH', doc: detalhe.doc_cnh, campo: 'cnh' },
                      { field: 'check_cnpj', label: 'CNPJ / Contrato Social', doc: detalhe.doc_cnpj_contrato, campo: 'cnpj_contrato' },
                      { field: 'check_rntrc', label: 'RNTRC (ANTT)', doc: detalhe.doc_rntrc, campo: 'rntrc' },
                      { field: 'check_endereco', label: 'Comprovante de Endereço', doc: detalhe.doc_comprovante_endereco, campo: 'comprovante_endereco' },
                    ].map(item => (
                      <div key={item.field} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 12px',background:'var(--bg3)',borderRadius:8}}>
                        <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',flex:1}}>
                          <input
                            type="checkbox"
                            checked={!!detalhe[item.field]}
                            onChange={()=>toggleCheck(item.field)}
                            style={{width:18,height:18,accentColor:'#22c55e',cursor:'pointer'}}
                          />
                          <span style={{fontSize:13,fontWeight:500}}>{item.label}</span>
                        </label>
                        {item.doc ? (
                          <>
                            <a
                              href={`https://api.wsdevsoft.com${item.doc}`}
                              target="_blank"
                              rel="noopener"
                              className="btn btn-ghost btn-sm"
                              style={{fontSize:11}}
                            >
                              Ver documento ↗
                            </a>
                            <label className="btn btn-ghost btn-sm" style={{fontSize:11, cursor: 'pointer', margin:0}}>
                              ↻ Substituir
                              <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" style={{display:'none'}}
                                onChange={(e) => anexarDoc(item.campo, e.target.files[0], e)} />
                            </label>
                          </>
                        ) : (
                          <label className="btn btn-primary btn-sm" style={{fontSize:11, cursor: 'pointer', margin:0}}>
                            📎 Anexar
                            <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" style={{display:'none'}}
                              onChange={(e) => anexarDoc(item.campo, e.target.files[0], e)} />
                          </label>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Assinatura */}
                  {detalhe.assinatura_path && (
                    <div style={{marginBottom:16}}>
                      <h4 style={{fontSize:13,fontWeight:600,marginBottom:8,color:'var(--text1)'}}>Assinatura</h4>
                      <div style={{background:'#fff',border:'1px solid var(--border)',borderRadius:8,padding:12,textAlign:'center'}}>
                        <img src={`https://api.wsdevsoft.com${detalhe.assinatura_path}`} alt="Assinatura" style={{maxWidth:250,maxHeight:100}} />
                        <div style={{fontSize:10,color:'var(--text3)',marginTop:4}}>IP: {detalhe.assinatura_ip || '—'} | Data: {fmtDate(detalhe.created_at)}</div>
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
            {detalhe && detalhe.status === 'pendente' && (
              <div className="modal-footer" style={{display:'flex',gap:8}}>
                <button className="btn btn-ghost" onClick={()=>mudarStatus('reprovado')} style={{color:'var(--red)'}}>Reprovar</button>
                <button className="btn btn-primary" onClick={()=>mudarStatus('aprovado')}>✓ Aprovar Cadastro</button>
              </div>
            )}
          </div>
        </div>
      )}

      {toast && <Toast {...toast} />}
    </div>
  );
}
