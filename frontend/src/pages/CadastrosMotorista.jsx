import { useState } from 'react';
import { useFetch } from '../hooks/useFetch';
import { api } from '../lib/api';
import { Modal, Field, Input, Select, StatusBadge, useToast, Toast, ExportBtn } from '../components/UI';

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

  // Busca + ordenação alfabética (case-insensitive, ignora acento)
  const [busca, setBusca] = useState('');
  const normaliza = (s) => (s || '').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const buscaNorm = normaliza(busca.trim());

  const filtrarPorBusca = (r) => {
    if (!buscaNorm) return true;
    const camposBusca = [r.nome, r.nome_motorista, r.cpf, r.cnpj, r.telefone, r.email, r.veiculo_placa].filter(Boolean);
    return camposBusca.some(v => normaliza(v).includes(buscaNorm));
  };

  const ordemAlfabetica = (a, b) =>
    normaliza(a.nome || a.nome_motorista || '').localeCompare(normaliza(b.nome || b.nome_motorista || ''));

  const rowsVisiveis = rows.filter(filtrarPorBusca).sort(ordemAlfabetica);
  const conviteRowsVisiveis = conviteRows.filter(filtrarPorBusca).sort(ordemAlfabetica);

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
      setEdit(data); // inicializa estado de edição
    } catch(e) { showToast(e.message, 'error'); }
    setLoadingDetalhe(false);
  };

  // ── Edição de dados do cadastro ──
  // edit é uma cópia do detalhe; mudanças vão pra edit, só persistem no PATCH
  const [edit, setEdit] = useState(null);
  const [salvandoEdicoes, setSalvandoEdicoes] = useState(false);
  const setCampo = (campo, valor) => setEdit(e => ({ ...e, [campo]: valor }));

  // Detecta se há campos alterados (compara só os editáveis)
  const CAMPOS_EDITAVEIS = [
    'nome','cpf','rg','cnh_numero','cnh_categoria','cnh_validade',
    'endereco','numero','complemento','bairro','cidade','estado','cep','telefone','email',
    'razao_social','cnpj','endereco_pj','numero_pj','complemento_pj','bairro_pj','cidade_pj','estado_pj','cep_pj','data_abertura',
    'veiculo_placa','veiculo_modelo','veiculo_ano','veiculo_rntrc',
    'banco','agencia','conta','tipo_conta','pix','tipo_colaborador',
  ];
  const valorNorm = (v) => v == null ? '' : String(v).substring(0,10); // só pra comparar (dates podem vir com timestamp)
  const houveEdicao = detalhe && edit && CAMPOS_EDITAVEIS.some(c => {
    const a = (c === 'cnh_validade' || c === 'data_abertura') ? valorNorm(edit[c]) : (edit[c] ?? '');
    const b = (c === 'cnh_validade' || c === 'data_abertura') ? valorNorm(detalhe[c]) : (detalhe[c] ?? '');
    return String(a) !== String(b);
  });

  const salvarEdicoes = async () => {
    if (!edit || salvandoEdicoes) return;
    setSalvandoEdicoes(true);
    try {
      const payload = {};
      for (const c of CAMPOS_EDITAVEIS) {
        if (edit[c] !== undefined) {
          // Datas vazias enviam null
          if ((c === 'cnh_validade' || c === 'data_abertura') && (!edit[c] || edit[c] === '')) {
            payload[c] = null;
          } else {
            // Datas com timestamp -> só YYYY-MM-DD
            if ((c === 'cnh_validade' || c === 'data_abertura') && typeof edit[c] === 'string' && edit[c].length > 10) {
              payload[c] = edit[c].substring(0,10);
            } else {
              payload[c] = edit[c];
            }
          }
        }
      }
      const atualizado = await api.patch(`/motorista-cadastros/${detalhe.id}/dados`, payload);
      setDetalhe(atualizado);
      setEdit(atualizado);
      refetch();
      showToast('Alterações salvas!');
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setSalvandoEdicoes(false);
    }
  };

  // Toggle check
  const toggleCheck = async (field) => {
    if (!detalhe) return;
    const newVal = !detalhe[field];
    try {
      const updated = await api.patch(`/motorista-cadastros/${detalhe.id}/validar`, { [field]: newVal });
      setDetalhe(updated);
      setEdit(prev => ({ ...prev, [field]: newVal })); // mantém edit sincronizado
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
      // Sincroniza edit (preservando edições em campos texto que não foram salvas)
      setEdit(prev => ({ ...prev, ...atualizado }));
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
      setEdit(prev => ({ ...prev, ...updated }));
      showToast(status === 'aprovado' ? 'Cadastro aprovado!' : 'Cadastro reprovado.');
      refetch();
    } catch(e) { showToast(e.message, 'error'); }
  };

  // Excluir cadastro (apenas reprovado ou pendente)
  const excluirCadastro = async () => {
    if (!detalhe) return;
    const nome = detalhe.nome || 'este cadastro';
    if (!confirm(`Excluir definitivamente "${nome}"?\n\nEsta ação não pode ser desfeita. Os arquivos anexados também serão removidos. O convite voltará a ficar pendente para a pessoa preencher novamente.`)) return;
    try {
      await api.delete(`/motorista-cadastros/${detalhe.id}`);
      showToast(`Cadastro de "${nome}" excluído.`);
      setModalDetalhe(null); setDetalhe(null); setEdit(null);
      refetch();
      refetchConvites();
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
          <button
            className="btn btn-ghost"
            onClick={() => window.location.assign('/motoristas')}
            title="Ir para a tela de Colaboradores cadastrados"
          >
            ← Colaboradores
          </button>
          <ExportBtn rows={rows} filename="cadastros_colaboradores" columns={cols.map(c=>({key:c.key,label:c.label}))} />
          <button className="btn btn-primary" onClick={()=>setModalConvite(true)}>+ Gerar Convite</button>
        </div>
      </div>

      <div className="page-body">
        {/* Tabs */}
        <div style={{display:'flex',gap:4,marginBottom:12,alignItems:'center',flexWrap:'wrap'}}>
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

        {/* Busca */}
        <div style={{marginBottom:12, position:'relative', maxWidth:420}}>
          <span style={{position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',fontSize:14,opacity:0.6,pointerEvents:'none'}}>🔍</span>
          <input
            type="text"
            value={busca}
            onChange={e=>setBusca(e.target.value)}
            placeholder="Buscar por nome, CPF, CNPJ, telefone..."
            style={{
              width:'100%',
              padding:'8px 32px 8px 32px',
              border:'1px solid var(--bg3)',
              borderRadius:8,
              background:'var(--bg2)',
              color:'var(--text1)',
              fontSize:13,
              outline:'none',
            }}
          />
          {busca && (
            <button
              onClick={()=>setBusca('')}
              style={{position:'absolute',right:8,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',fontSize:14,opacity:0.6}}
              title="Limpar busca"
            >×</button>
          )}
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
                {!loading && rows.length > 0 && !rowsVisiveis.length && (
                  <tr><td colSpan={8} style={{textAlign:'center',color:'var(--text3)',padding:'32px 0'}}>
                    Nenhum cadastro encontrado para "{busca}"
                  </td></tr>
                )}
                {rowsVisiveis.map(r => {
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
                {conviteRowsVisiveis.map(c => {
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
        <div className="modal-backdrop" onClick={e=>e.target===e.currentTarget&&(setModalDetalhe(null),setDetalhe(null),setEdit(null))}>
          <div className="modal" style={{maxWidth:700, maxHeight:'90vh', display:'flex', flexDirection:'column'}}>
            <div className="modal-header">
              <span className="modal-title">Detalhe do Cadastro</span>
              <button className="modal-close" onClick={()=>{setModalDetalhe(null);setDetalhe(null);setEdit(null);}}>×</button>
            </div>

            {/* Aviso sticky de alterações pendentes — sempre visível */}
            {houveEdicao && (
              <div style={{
                padding:'10px 16px',
                background:'#fef3c7', borderBottom:'2px solid #f59e0b',
                fontSize:13, color:'#92400e', display:'flex',
                alignItems:'center', justifyContent:'space-between', gap:10,
                flexShrink:0
              }}>
                <span style={{fontWeight:600}}>⚠️ Alterações não salvas</span>
                <div style={{display:'flex',gap:6}}>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={()=>setEdit({...detalhe})}
                    disabled={salvandoEdicoes}
                    style={{fontSize:12}}
                  >
                    Desfazer
                  </button>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={salvarEdicoes}
                    disabled={salvandoEdicoes}
                    style={{fontSize:12, background:'#f59e0b', borderColor:'#f59e0b'}}
                  >
                    {salvandoEdicoes ? 'Salvando...' : '💾 Salvar alterações'}
                  </button>
                </div>
              </div>
            )}

            <div
              className="modal-body modal-body-scrollable"
              style={{
                overflowY: 'auto',
                flex: 1,
                // Scrollbar visível e mais grossa pra usuários leigos perceberem
                scrollbarWidth: 'auto', // Firefox
                scrollbarColor: '#9ca3af #e5e7eb', // Firefox
              }}
            >
              {/* Estilos da scrollbar webkit (Chrome/Edge/Safari) — inline via style tag escopado */}
              <style>{`
                .modal-body-scrollable::-webkit-scrollbar { width: 14px; }
                .modal-body-scrollable::-webkit-scrollbar-track { background: #f3f4f6; border-radius: 0; }
                .modal-body-scrollable::-webkit-scrollbar-thumb { background: #9ca3af; border-radius: 7px; border: 2px solid #f3f4f6; }
                .modal-body-scrollable::-webkit-scrollbar-thumb:hover { background: #6b7280; }
              `}</style>

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
                    <Field label="Nome">
                      <Input value={edit?.nome || ''} onChange={e=>setCampo('nome', e.target.value)} />
                    </Field>
                    <Field label="CPF">
                      <Input value={edit?.cpf || ''} onChange={e=>setCampo('cpf', e.target.value)} placeholder="000.000.000-00" />
                    </Field>
                    <Field label="RG">
                      <Input value={edit?.rg || ''} onChange={e=>setCampo('rg', e.target.value)} />
                    </Field>
                    <Field label="Telefone">
                      <Input value={edit?.telefone || ''} onChange={e=>setCampo('telefone', e.target.value)} />
                    </Field>
                    <Field label="E-mail">
                      <Input value={edit?.email || ''} onChange={e=>setCampo('email', e.target.value)} />
                    </Field>
                    <Field label="Tipo de Colaborador">
                      <Select
                        value={edit?.tipo_colaborador || ''}
                        onChange={e=>setCampo('tipo_colaborador', e.target.value)}
                        options={[
                          {value:'',label:'— Selecionar —'},
                          {value:'motorista_proprio',label:'🏠 Motorista Próprio'},
                          {value:'motorista_terceiro',label:'🚚 Motorista Terceiro'},
                          {value:'ajudante',label:'👷 Ajudante'},
                          {value:'administrativo',label:'💼 Administrativo'},
                          {value:'pendente',label:'⏳ Pendente'},
                        ]}
                      />
                    </Field>
                    <Field label="CNH">
                      <Input value={edit?.cnh_numero || ''} onChange={e=>setCampo('cnh_numero', e.target.value)} />
                    </Field>
                    <Field label="Categoria">
                      <Input value={edit?.cnh_categoria || ''} onChange={e=>setCampo('cnh_categoria', e.target.value)} placeholder="A, B, C, D, E..." />
                    </Field>
                    <Field label="Validade CNH">
                      <Input type="date" value={(edit?.cnh_validade || '').substring(0,10)} onChange={e=>setCampo('cnh_validade', e.target.value)} />
                    </Field>
                    <Field label="CEP">
                      <Input value={edit?.cep || ''} onChange={e=>setCampo('cep', e.target.value)} />
                    </Field>
                    <div style={{gridColumn:'span 2'}}>
                      <Field label="Endereço">
                        <Input value={edit?.endereco || ''} onChange={e=>setCampo('endereco', e.target.value)} />
                      </Field>
                    </div>
                    <Field label="Número">
                      <Input value={edit?.numero || ''} onChange={e=>setCampo('numero', e.target.value)} />
                    </Field>
                    <Field label="Complemento">
                      <Input value={edit?.complemento || ''} onChange={e=>setCampo('complemento', e.target.value)} />
                    </Field>
                    <Field label="Bairro">
                      <Input value={edit?.bairro || ''} onChange={e=>setCampo('bairro', e.target.value)} />
                    </Field>
                    <Field label="Cidade">
                      <Input value={edit?.cidade || ''} onChange={e=>setCampo('cidade', e.target.value)} />
                    </Field>
                    <Field label="UF">
                      <Input value={edit?.estado || ''} onChange={e=>setCampo('estado', e.target.value)} maxLength={2} />
                    </Field>
                  </div>

                  {/* Dados PJ */}
                  <h4 style={{fontSize:13,fontWeight:600,marginBottom:8,color:'var(--text1)'}}>Pessoa Jurídica</h4>
                  <div className="form-grid cols-2" style={{marginBottom:16}}>
                    <Field label="Razão Social">
                      <Input value={edit?.razao_social || ''} onChange={e=>setCampo('razao_social', e.target.value)} />
                    </Field>
                    <Field label="CNPJ">
                      <Input value={edit?.cnpj || ''} onChange={e=>setCampo('cnpj', e.target.value)} placeholder="00.000.000/0000-00" />
                    </Field>
                    <Field label="Data de Abertura">
                      <Input type="date" value={(edit?.data_abertura || '').substring(0,10)} onChange={e=>setCampo('data_abertura', e.target.value)} />
                    </Field>
                    <Field label="CEP PJ">
                      <Input value={edit?.cep_pj || ''} onChange={e=>setCampo('cep_pj', e.target.value)} />
                    </Field>
                    <div style={{gridColumn:'span 2'}}>
                      <Field label="Endereço PJ">
                        <Input value={edit?.endereco_pj || ''} onChange={e=>setCampo('endereco_pj', e.target.value)} />
                      </Field>
                    </div>
                    <Field label="Número PJ">
                      <Input value={edit?.numero_pj || ''} onChange={e=>setCampo('numero_pj', e.target.value)} />
                    </Field>
                    <Field label="Complemento PJ">
                      <Input value={edit?.complemento_pj || ''} onChange={e=>setCampo('complemento_pj', e.target.value)} />
                    </Field>
                    <Field label="Bairro PJ">
                      <Input value={edit?.bairro_pj || ''} onChange={e=>setCampo('bairro_pj', e.target.value)} />
                    </Field>
                    <Field label="Cidade PJ">
                      <Input value={edit?.cidade_pj || ''} onChange={e=>setCampo('cidade_pj', e.target.value)} />
                    </Field>
                    <Field label="UF PJ">
                      <Input value={edit?.estado_pj || ''} onChange={e=>setCampo('estado_pj', e.target.value)} maxLength={2} />
                    </Field>
                  </div>

                  {/* Veículo */}
                  <h4 style={{fontSize:13,fontWeight:600,marginBottom:8,color:'var(--text1)'}}>Veículo</h4>
                  <div className="form-grid cols-2" style={{marginBottom:16}}>
                    <Field label="Placa">
                      <Input value={edit?.veiculo_placa || ''} onChange={e=>setCampo('veiculo_placa', e.target.value.toUpperCase())} />
                    </Field>
                    <Field label="Modelo">
                      <Input value={edit?.veiculo_modelo || ''} onChange={e=>setCampo('veiculo_modelo', e.target.value)} />
                    </Field>
                    <Field label="Ano">
                      <Input value={edit?.veiculo_ano || ''} onChange={e=>setCampo('veiculo_ano', e.target.value)} />
                    </Field>
                    <Field label="RNTRC">
                      <Input value={edit?.veiculo_rntrc || ''} onChange={e=>setCampo('veiculo_rntrc', e.target.value)} />
                    </Field>
                  </div>

                  {/* Bancário */}
                  <h4 style={{fontSize:13,fontWeight:600,marginBottom:8,color:'var(--text1)'}}>Dados Bancários</h4>
                  <div className="form-grid cols-2" style={{marginBottom:16}}>
                    <Field label="Banco">
                      <Input value={edit?.banco || ''} onChange={e=>setCampo('banco', e.target.value)} />
                    </Field>
                    <Field label="Agência">
                      <Input value={edit?.agencia || ''} onChange={e=>setCampo('agencia', e.target.value)} />
                    </Field>
                    <Field label="Conta">
                      <Input value={edit?.conta || ''} onChange={e=>setCampo('conta', e.target.value)} />
                    </Field>
                    <Field label="Tipo de Conta">
                      <Input value={edit?.tipo_conta || ''} onChange={e=>setCampo('tipo_conta', e.target.value)} placeholder="Corrente / Poupança" />
                    </Field>
                    <div style={{gridColumn:'span 2'}}>
                      <Field label="PIX">
                        <Input value={edit?.pix || ''} onChange={e=>setCampo('pix', e.target.value)} />
                      </Field>
                    </div>
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
            {detalhe && (detalhe.status === 'pendente' || detalhe.status === 'reprovado') && (
              <div className="modal-footer" style={{display:'flex',gap:8,flexShrink:0,justifyContent:'space-between'}}>
                {/* Excluir fica à esquerda, separado das ações primárias */}
                <button
                  className="btn btn-ghost"
                  onClick={excluirCadastro}
                  style={{color:'var(--red)', fontSize:13}}
                  title="Excluir definitivamente este cadastro"
                >
                  🗑 Excluir cadastro
                </button>

                {detalhe.status === 'pendente' ? (
                  <div style={{display:'flex',gap:8}}>
                    <button
                      className="btn btn-ghost"
                      onClick={() => {
                        if (houveEdicao && !confirm('Existem alterações não salvas. Deseja reprovar mesmo assim? (as edições serão perdidas)')) return;
                        mudarStatus('reprovado');
                      }}
                      style={{color:'var(--red)'}}
                    >Reprovar</button>
                    <button
                      className="btn btn-primary"
                      onClick={async () => {
                        if (houveEdicao) {
                          const op = confirm('Você tem alterações não salvas. Salvar antes de aprovar?');
                          if (op) {
                            await salvarEdicoes();
                          }
                        }
                        mudarStatus('aprovado');
                      }}
                    >✓ Aprovar Cadastro</button>
                  </div>
                ) : (
                  // status === 'reprovado'
                  <button
                    className="btn btn-primary"
                    onClick={() => mudarStatus('pendente')}
                    title="Voltar este cadastro para revisão"
                  >
                    ↻ Voltar para pendente
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {toast && <Toast {...toast} />}
    </div>
  );
}
