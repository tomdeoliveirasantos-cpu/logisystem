import { useState, useRef, useEffect, useMemo } from 'react';
import { useFetch } from '../hooks/useFetch';
import { useParametros } from '../hooks/useParametros';
import { api } from '../lib/api';
import { StatusBadge, Field, Input, Select, useToast, Toast, ExportBtn } from '../components/UI';
import ImportRoteasy from '../components/ImportRoteasy';
import PreCadastroModal from '../components/PreCadastroModal';

const STATUS_OPTS = [
  {value:'pendente',label:'Pendente'},
  {value:'entregue',label:'Entregue'},
  {value:'devolucao',label:'Devolução'},
  {value:'cancelado',label:'Cancelado'},
];

const fmt = v => v !== null && v !== undefined ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v) : '—';

function fmtDate(d) {
  if (!d) return '—';
  const s = typeof d === 'string' ? d.substring(0,10) : d;
  const [y,m,day] = s.split('-');
  return `${day}/${m}/${y}`;
}

function exportXLS(rows) {
  if (!rows.length) return alert('Nenhum dado para exportar');
  const cols = [
    {k:'data',l:'Data',f:v=>fmtDate(v)},
    {k:'numero_rota',l:'Rota'},{k:'seq',l:'Seq.'},
    {k:'cliente_nome',l:'Cliente'},{k:'motorista_nome',l:'Motorista'},
    {k:'veiculo_tipo',l:'Veículo'},{k:'placa',l:'Placa'},
    {k:'regiao',l:'Região'},{k:'peso',l:'Peso (kg)'},
    {k:'nf',l:'NF'},{k:'remessa',l:'Remessa'},
    {k:'status',l:'Status'},{k:'tipo',l:'Tipo'},
    {k:'ajuda_diesel',l:'Ajuda Diesel',f:v=>v?Number(v).toFixed(2):''},
    {k:'taxa_descarga',l:'Taxa Descarga',f:v=>v?Number(v).toFixed(2):''},
    {k:'obs',l:'Observações'},
  ];
  const data=[cols.map(c=>c.l),...rows.map(r=>cols.map(c=>c.f?c.f(r[c.k],r):(r[c.k]||'')))];
  const ws=window.XLSX.utils.aoa_to_sheet(data);
  ws['!cols']=cols.map(()=>({wch:18}));
  const wb=window.XLSX.utils.book_new();
  window.XLSX.utils.book_append_sheet(wb,ws,'Ordens');
  window.XLSX.writeFile(wb,`ordens_${new Date().toLocaleDateString('pt-BR').replace(/\//g,'-')}.xlsx`);
}

function AnexoCell({ ordem }) {
  // Tem anexos múltiplos (campo agregado vindo do backend) OU anexo legado
  const count = ordem.anexos_count || 0;
  const legado = ordem.anexo_path && !count;
  if (count > 0) {
    return (
      <span style={{display:'inline-flex',alignItems:'center',gap:4,fontSize:11,color:'var(--accent)'}}>
        📎 {count} {count === 1 ? 'anexo' : 'anexos'}
      </span>
    );
  }
  if (legado) {
    const url = `https://api.wsdevsoft.com/uploads/${ordem.anexo_path}`;
    return (
      <a href={url} target="_blank" rel="noreferrer"
        style={{display:'flex',alignItems:'center',gap:4,fontSize:11,color:'var(--accent)',textDecoration:'none'}}>
        📎 {ordem.anexo_nome?.length>18?ordem.anexo_nome.slice(0,15)+'...':ordem.anexo_nome}
      </a>
    );
  }
  return <span style={{fontSize:11,color:'var(--text3)'}}>—</span>;
}

function UploadZone({ files, onFiles }) {
  const ref = useRef();
  const arr = Array.isArray(files) ? files : [];
  const onSelect = (fileList) => {
    if (!fileList || !fileList.length) return;
    onFiles([...arr, ...Array.from(fileList)]);
  };
  const remove = (idx) => onFiles(arr.filter((_, i) => i !== idx));
  return (
    <div>
      <div className={`upload-zone ${arr.length?'has-file':''}`} onClick={()=>ref.current.click()}
        onDrop={e=>{e.preventDefault();onSelect(e.dataTransfer.files);}} onDragOver={e=>e.preventDefault()}>
        <input ref={ref} type="file" multiple style={{display:'none'}} accept=".pdf,.jpg,.jpeg,.png,.xml" onChange={e=>onSelect(e.target.files)} />
        <div className="upload-icon">
          <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
          </svg>
        </div>
        <div className="upload-text">Clique ou arraste os arquivos aqui</div>
        <div className="upload-hint">PDF, imagem ou XML — múltiplos arquivos, máx. 10 MB cada</div>
      </div>
      {arr.length > 0 && (
        <div style={{marginTop:8,display:'flex',flexDirection:'column',gap:4}}>
          {arr.map((f, idx) => (
            <div key={idx} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'6px 10px',background:'var(--bg2)',borderRadius:'var(--radius)',fontSize:12}}>
              <span style={{color:'var(--green)',fontWeight:500,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>📎 {f.name}</span>
              <button type="button" onClick={(e)=>{e.stopPropagation();remove(idx);}}
                style={{background:'none',border:'none',cursor:'pointer',color:'#DC2626',padding:'2px 6px',fontSize:14}}>×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Lista de anexos JÁ salvos (em modo edição) — com botão de download e excluir
function AnexosExistentes({ ordemId, refreshKey, onChange, showToast }) {
  const [anexos, setAnexos] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!ordemId) { setAnexos([]); return; }
    setLoading(true);
    api.get(`/ordens/${ordemId}/anexos`)
      .then(r => setAnexos(r || []))
      .catch(() => setAnexos([]))
      .finally(() => setLoading(false));
  }, [ordemId, refreshKey]);

  const remover = async (anexoId) => {
    if (!confirm('Remover este anexo?')) return;
    try {
      await api.delete(`/ordens/anexos/${anexoId}`);
      setAnexos(prev => prev.filter(a => a.id !== anexoId));
      onChange?.();
      showToast?.('Anexo removido', 'success');
    } catch (e) { showToast?.(e.message, 'error'); }
  };

  if (!ordemId) return null;
  if (loading) return <div style={{fontSize:11,color:'var(--text3)'}}>Carregando anexos…</div>;
  if (!anexos.length) return null;

  return (
    <div style={{marginBottom:8,display:'flex',flexDirection:'column',gap:4}}>
      <div style={{fontSize:11,color:'var(--text3)',marginBottom:2}}>Anexos já salvos:</div>
      {anexos.map(a => (
        <div key={a.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'6px 10px',background:'var(--accent-lt)',borderRadius:'var(--radius)',fontSize:12}}>
          <a href={`https://api.wsdevsoft.com/api/ordens/anexos/${a.id}/download?token=${encodeURIComponent(localStorage.getItem('logi_token')||'')}`}
            target="_blank" rel="noreferrer"
            style={{color:'var(--accent)',fontWeight:500,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',textDecoration:'none'}}>
            📎 {a.nome}
          </a>
          <button type="button" onClick={()=>remover(a.id)}
            style={{background:'none',border:'none',cursor:'pointer',color:'#DC2626',padding:'2px 6px',fontSize:14}}>×</button>
        </div>
      ))}
    </div>
  );
}

// Label com badge obrigatório
function FL({ label, obrig, children }) {
  return (
    <Field label={
      <span>{label} {obrig && <span style={{color:'var(--red)',fontSize:10,fontWeight:700,marginLeft:4}}>*</span>}</span>
    }>{children}</Field>
  );
}

export default function Ordens() {
  const today = new Date().toISOString().split('T')[0];
  const [filtInicio, setFiltInicio] = useState('');
  const [filtFim, setFiltFim]       = useState('');
  const [filtStatus, setFiltStatus] = useState('pendente');
  const [filtBusca, setFiltBusca]   = useState('');
  const [modal, setModal] = useState(false);
  const [form, setForm]   = useState({ data: today });
  const [anexos, setAnexos] = useState([]);                  // arquivos novos a enviar
  const [anexosRefreshKey, setAnexosRefreshKey] = useState(0); // pra refrescar lista de existentes
  const [formError, setFormError] = useState('');
  const [freteData, setFreteData] = useState(null);
  const [freteLoading, setFreteLoading] = useState(false);
  const { toast, showToast } = useToast();
  const { visivel, obrigatorio, params: parametros } = useParametros();

  const qs = new URLSearchParams();
  if (filtInicio) qs.set('data_inicio', filtInicio);
  if (filtFim)    qs.set('data_fim', filtFim);
  if (filtStatus) qs.set('status', filtStatus);

  const { data, loading, refetch }   = useFetch(`/ordens?${qs}`, [filtInicio, filtFim, filtStatus]);
  const { data: clientes }                            = useFetch('/clientes');
  const { data: motoristas, refetch: refetchMot }     = useFetch('/motoristas');
  const { data: ajudantesDisp, refetch: refetchAju } = useFetch('/motoristas?tipo_colaborador=ajudante');
  const { data: veiculos,   refetch: refetchVei }     = useFetch('/veiculos');
  const { data: regioes }                             = useFetch('/financeiro/fretes/regioes');

  // Veículo selecionado
  const veiculoSelecionado = useMemo(
    () => (veiculos||[]).find(v => String(v.id) === String(form.veiculo_id)),
    [veiculos, form.veiculo_id]
  );

  // Buscar frete automaticamente quando veículo ou região mudam
  useEffect(() => {
    if (!veiculoSelecionado) { setFreteData(null); return; }

    const tipoVeiculo = veiculoSelecionado.tipo;
    const regiao = (form.regiao || '').trim();

    if (!tipoVeiculo) return;

    setFreteLoading(true);
    const params = new URLSearchParams({ tipo_veiculo: tipoVeiculo });
    if (regiao) params.set('regiao', regiao);

    api.get(`/financeiro/fretes/buscar?${params}`)
      .then(data => setFreteData(data))
      .catch(() => setFreteData(null))
      .finally(() => setFreteLoading(false));
  }, [veiculoSelecionado, form.regiao]);

  // Auto-preencher tipo_frete a partir do veículo (se ainda vazio)
  useEffect(() => {
    if (veiculoSelecionado?.tipo && !form.tipo_frete) {
      setForm(f => ({ ...f, tipo_frete: veiculoSelecionado.tipo }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [veiculoSelecionado]);

  const set = (k, v) => setForm(f => ({...f, [k]: v}));
  const onMotoristaChange = (id) => {
    set('motorista_id', id);
    // Auto-selecionar veículo padrão do motorista
    const mot = (motoristas||[]).find(m => String(m.id) === String(id));
    if (mot?.veiculo_padrao_id && !form.veiculo_id) {
      set('veiculo_id', mot.veiculo_padrao_id);
    }
  };

  const onClienteChange = (id) => {
    set('cliente_id',id);
    const cli=(clientes||[]).find(c=>String(c.id)===String(id));
    if(cli) set('cliente_nome',cli.nome);
  };

  const validate = () => {
    const erros = [];
    if (!form.data) erros.push('Data');
    if (!form.tipo_frota) erros.push('Tipo de Frota');
    if (!form.cliente_id) erros.push('Cliente');
    if (!form.motorista_id) erros.push('Motorista');
    if (!form.veiculo_id) erros.push('Veículo');
    if (!form.numero_rota) erros.push('Número da Rota');
    if (form.tipo_frota === 'terceiro' && visivel('ajuda_diesel') && obrigatorio('ajuda_diesel') && !form.ajuda_diesel) erros.push('Ajuda Diesel');
    if (form.tipo_frota === 'terceiro' && visivel('taxa_descarga') && obrigatorio('taxa_descarga') && !form.taxa_descarga) erros.push('Taxa Descarga');
    if (visivel('obs') && obrigatorio('obs') && !form.obs) erros.push('Observações');
    if (visivel('anexo') && obrigatorio('anexo') && !anexos.length && !editingId) erros.push('Anexo');
    return erros;
  };

  const save = async () => {
    const erros = validate();
    if (erros.length) { setFormError(`Campos obrigatórios não preenchidos: ${erros.join(', ')}`); return; }
    setFormError('');
    try {
      const fd = new FormData();
      fd.append('data', form.data);
      fd.append('tipo_frota', form.tipo_frota);
      if(form.tipo_frete) fd.append('tipo_frete', form.tipo_frete);
      fd.append('multiplicador_frete', form.multiplicador_frete || 1);
      if(form.numero_rota) fd.append('numero_rota', form.numero_rota);
      if(form.quant_entregas) fd.append('quant_entregas', form.quant_entregas);
      if(form.cliente_id) fd.append('cliente_id', form.cliente_id);
      if(form.cliente_nome) fd.append('cliente_nome', form.cliente_nome);
      if(form.motorista_id) fd.append('motorista_id', form.motorista_id);
      if(form.veiculo_id) fd.append('veiculo_id', form.veiculo_id);
      if(form.regiao) fd.append('regiao', form.regiao);
      if(form.tipo) fd.append('tipo', form.tipo);
      if(visivel('obs') && form.obs) fd.append('obs', form.obs);
      // Valores monetários só pra não-motorista — Ajuda Diesel e Taxa Descarga só pra Terceiro
      if (!ehMotorista) {
        const ehTerceiro = form.tipo_frota === 'terceiro';
        fd.append('ajuda_diesel', (ehTerceiro && visivel('ajuda_diesel')) ? (form.ajuda_diesel||0) : 0);
        fd.append('taxa_descarga', (ehTerceiro && visivel('taxa_descarga')) ? (form.taxa_descarga||0) : 0);
        fd.append('ajudante_extra', form.ajudante_extra || 0);
        fd.append('ajudante_nome', (form.ajudante_nome||'').trim());
      }
      // KM apenas para tipo_frota=proprio
      if (form.tipo_frota === 'proprio') {
        if (form.km_saida) fd.append('km_saida', form.km_saida);
        if (form.km_chegada) fd.append('km_chegada', form.km_chegada);
      }
      fd.append('status', form.status||'pendente');
      // Não enviar anexo legado — anexos vão pelo endpoint dedicado abaixo

      // Paradas inline (sempre que houver)
      if (paradas.length) fd.append('paradas', JSON.stringify(paradas));

      // Ajudantes — sempre enviar (array vazio significa remover todos)
      fd.append('ajudantes', JSON.stringify(ajudantesIds.map(id => ({ motorista_id: id }))));

      const token = localStorage.getItem('logi_token');
      const url = editingId
        ? `https://api.wsdevsoft.com/api/ordens/${editingId}`
        : 'https://api.wsdevsoft.com/api/ordens';
      const method = editingId ? 'PUT' : 'POST';

      const res = await fetch(url, { method, body: fd, headers: { Authorization: `Bearer ${token}` } });
      if(!res.ok) throw new Error('Erro ao salvar');
      const ordemSalva = await res.json().catch(() => null);
      const ordemId = editingId || ordemSalva?.id;

      // Upload de anexos novos (se houver)
      if (ordemId && anexos.length) {
        const fdAnex = new FormData();
        anexos.forEach(f => fdAnex.append('anexos', f));
        try {
          const r2 = await fetch(`https://api.wsdevsoft.com/api/ordens/${ordemId}/anexos`, {
            method: 'POST', body: fdAnex, headers: { Authorization: `Bearer ${token}` }
          });
          if (!r2.ok) {
            const err = await r2.json().catch(() => ({}));
            showToast(`OT salva, mas anexos falharam: ${err.error || r2.status}`, 'error');
          }
        } catch (e) {
          showToast(`OT salva, mas anexos falharam: ${e.message}`, 'error');
        }
      }

      showToast(editingId ? 'Ordem atualizada!' : 'Ordem criada!');
      refetch(); closeModal();
    } catch(e) { showToast(e.message,'error'); }
  };

  const updateStatus = async (id,status) => {
    try { await api.patch(`/ordens/${id}/status`,{status}); showToast('Status atualizado!'); refetch(); }
    catch(e) { showToast(e.message,'error'); }
  };

  const [editingId, setEditingId] = useState(null);
  const [filtMotorista, setFiltMotorista] = useState('');
  const [filtVeiculo, setFiltVeiculo] = useState('');
  const [historicoModal, setHistoricoModal] = useState(null);
  const [historico, setHistorico] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [agrupModal, setAgrupModal] = useState(false);
  const [agrupForm, setAgrupForm] = useState({});
  const [showImportRoteasy, setShowImportRoteasy] = useState(false);
  // ── Estados novos: paradas, pré-cadastro, perfil ──
  const [paradas, setParadas] = useState([]);
  const [ajudantesIds, setAjudantesIds] = useState([]);
  const [showPreMot, setShowPreMot] = useState(false);
  const [showPreVei, setShowPreVei] = useState(false);
  const [showPreAju, setShowPreAju] = useState(false);
  const { data: transportadoras } = useFetch('/transportadoras');
  // Perfil do usuário (para esconder valores monetários se for motorista)
  const userPerfil = (() => {
    try {
      const t = localStorage.getItem('logi_token');
      if (!t) return null;
      const p = JSON.parse(atob(t.split('.')[1]));
      return p.perfil || null;
    } catch { return null; }
  })();
  const ehMotorista = userPerfil === 'motorista';

  const openModal = async (ordemExistente = null) => {
    if (ordemExistente) {
      // Edição
      setEditingId(ordemExistente.id);
      setForm({
        data: ordemExistente.data?.substring(0,10) || today,
        numero_rota: ordemExistente.numero_rota || '',
        tipo_frota: ordemExistente.tipo_frota || '',
        tipo_frete: ordemExistente.tipo_frete || '',
        multiplicador_frete: ordemExistente.multiplicador_frete || 1,
        quant_entregas: ordemExistente.quant_entregas || '',
        cliente_id: ordemExistente.cliente_id || '',
        cliente_nome: ordemExistente.cliente_nome || '',
        motorista_id: ordemExistente.motorista_id || '',
        veiculo_id: ordemExistente.veiculo_id || '',
        regiao: ordemExistente.regiao || '',
        tipo: ordemExistente.tipo || '',
        ajuda_diesel: ordemExistente.ajuda_diesel || '',
        taxa_descarga: ordemExistente.taxa_descarga || '',
        ajudante_extra: ordemExistente.ajudante_extra || '',
        ajudante_nome: ordemExistente.ajudante_nome || '',
        obs: ordemExistente.obs || '',
        status: ordemExistente.status || 'pendente',
        km_saida: ordemExistente.km_saida || '',
        km_chegada: ordemExistente.km_chegada || '',
      });
      // Carregar paradas da OT
      try {
        const ps = await api.get(`/ordens/${ordemExistente.id}/paradas`);
        setParadas(ps || []);
      } catch { setParadas([]); }
      // Carregar ajudantes
      try {
        const ajus = await api.get(`/ordens/${ordemExistente.id}/ajudantes`);
        setAjudantesIds((ajus || []).map(a => a.motorista_id));
      } catch { setAjudantesIds([]); }
    } else {
      setEditingId(null);
      setForm({ data: today, tipo_frota: '', multiplicador_frete: 1 });
      setParadas([]);
      setAjudantesIds([]);
    }
    setAnexos([]);
    setFormError('');
    setFreteData(null);
    setModal(true);
  };

  const closeModal = () => {
    setModal(false);
    setEditingId(null);
    setForm({ data: today });
    setAnexos([]);
    setFreteData(null);
    setParadas([]);
  };

  // ── Agrupamento de romaneios ──
  const toggleSelect = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };
  const toggleSelectAll = () => {
    const pendentes = rows.filter(r => !r.grupo_viagem).map(r => r.id);
    if (selectedIds.length === pendentes.length) setSelectedIds([]);
    else setSelectedIds(pendentes);
  };
  const abrirAgrupar = () => {
    if (selectedIds.length < 2) return showToast("Selecione pelo menos 2 ordens", "error");
    setAgrupForm({});
    setAgrupModal(true);
  };
  const confirmarAgrupar = async () => {
    try {
      const body = { ordem_ids: selectedIds };
      if (agrupForm.motorista_id) body.motorista_id = agrupForm.motorista_id;
      if (agrupForm.veiculo_id) body.veiculo_id = agrupForm.veiculo_id;
      
      /* Buscar tabela de frete se tiver veículo selecionado */
      if (agrupForm.veiculo_id) {
        const veic = (veiculos||[]).find(v => String(v.id) === String(agrupForm.veiculo_id));
        if (veic) {
          const ordSel = rows.filter(r => selectedIds.includes(r.id));
          const regiao = ordSel.find(o => o.regiao)?.regiao || "";
          if (regiao) {
            try {
              const frData = await api.get(`/financeiro/fretes/buscar?tipo_veiculo=${veic.tipo}&regiao=${regiao}`);
              if (frData?.pagar?.id) body.tabela_frete_id = frData.pagar.id;
            } catch(e) { /* sem frete, segue */ }
          }
        }
      }
      
      const res = await api.post("/ordens/agrupar", body);
      showToast(`Romaneios agrupados! Grupo: ${res.grupo_viagem}`);
      setSelectedIds([]); setAgrupModal(false); refetch();
    } catch(e) { showToast(e.message, "error"); }
  };
  const desagrupar = async (grupo) => {
    if (!confirm("Desagrupar estas ordens? O frete agrupado será cancelado.")) return;
    try {
      await api.post("/ordens/desagrupar", { grupo_viagem: grupo });
      showToast("Ordens desagrupadas!"); refetch();
    } catch(e) { showToast(e.message, "error"); }
  };

  const showHistorico = async (ordemId) => {
    try {
      const data = await api.get(`/ordens/${ordemId}/historico`);
      setHistorico(data || []);
      setHistoricoModal(ordemId);
    } catch(e) { showToast(e.message, 'error'); }
  };

  // Filtros adicionais no frontend
  let rows = data||[];
  if (filtMotorista) rows = rows.filter(r => String(r.motorista_id) === String(filtMotorista));
  if (filtVeiculo) rows = rows.filter(r => String(r.veiculo_id) === String(filtVeiculo));
  if (filtBusca) {
    const b = filtBusca.toLowerCase();
    rows = rows.filter(r =>
      (r.cliente_nome||'').toLowerCase().includes(b) ||
      (r.motorista_nome||'').toLowerCase().includes(b) ||
      (r.regiao||'').toLowerCase().includes(b) ||
      (r.placa||'').toLowerCase().includes(b) ||
      (r.nf||'').toLowerCase().includes(b) ||
      String(r.numero_rota||'').includes(b)
    );
  }

  return (
    <div>
      <div className="page-header">
        <div style={{flex:1}}>
          <div className="page-title">Ordens de Transporte</div>
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          <ExportBtn rows={rows} filename="ordens_transporte" columns={[
            {key:'data',label:'Data',fmt:v=>{if(!v)return'';const s=String(v).substring(0,10);const d=new Date(s+'T12:00:00');return isNaN(d)?'':d.toLocaleDateString('pt-BR')}},
            {key:'numero_rota',label:'Rota'},{key:'cliente_nome',label:'Cliente'},
            {key:'motorista_nome',label:'Motorista'},{key:'veiculo_tipo',label:'Veículo'},
            {key:'placa',label:'Placa'},{key:'regiao',label:'Região'},
            {key:'peso',label:'Peso (kg)',fmt:v=>v?Number(v).toFixed(1):''},
            {key:'nf',label:'NF'},{key:'status',label:'Status'},
          ]} />
          {/* Romaneio: feature desabilitada na UI - OT já é a rota.
              Backend e código mantidos para reativação futura. */}
          {false && selectedIds.length >= 2 && (
            <button className="btn btn-primary" onClick={abrirAgrupar} style={{background:"#7c3aed"}}>
              🔗 Agrupar ({selectedIds.length})
            </button>
          )}
          <button className="btn btn-ghost" onClick={()=>setShowImportRoteasy(true)} title="Importar planilha do Roteasy">
            📥 Importar Roteasy
          </button>
          <button className="btn btn-primary" onClick={()=>openModal()}>+ Nova Ordem</button>
        </div>
      </div>

      <div className="page-body">
        {/* Filtros */}
        <div className="card" style={{padding:'12px 16px',marginBottom:12}}>
          <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
            <div className="search-bar" style={{flex:'1 1 160px',minWidth:120}}>
              <svg width="14" height="14" fill="none" stroke="var(--text3)" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
              <input placeholder="Buscar..." value={filtBusca} onChange={e=>setFiltBusca(e.target.value)} />
            </div>
            <input type="date" className="form-input" style={{width:130,flex:'0 0 auto'}} value={filtInicio} onChange={e=>setFiltInicio(e.target.value)} />
            <input type="date" className="form-input" style={{width:130,flex:'0 0 auto'}} value={filtFim} onChange={e=>setFiltFim(e.target.value)} />
            <select className="form-select" style={{width:120,flex:'0 0 auto'}} value={filtStatus} onChange={e=>setFiltStatus(e.target.value)}>
              <option value="">Todos</option>
              {STATUS_OPTS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <select className="form-select" style={{width:140,flex:'0 0 auto'}} value={filtMotorista} onChange={e=>setFiltMotorista(e.target.value)}>
              <option value="">Motorista</option>
              {(motoristas||[]).map(m=><option key={m.id} value={m.id}>{m.nome}</option>)}
            </select>
            <select className="form-select" style={{width:140,flex:'0 0 auto'}} value={filtVeiculo} onChange={e=>setFiltVeiculo(e.target.value)}>
              <option value="">Veículo</option>
              {(veiculos||[]).map(v=><option key={v.id} value={v.id}>{v.placa} — {v.tipo}</option>)}
            </select>
            {(filtInicio||filtFim||filtStatus!=='pendente'||filtMotorista||filtVeiculo||filtBusca) && (
              <button className="btn btn-ghost btn-sm" style={{padding:'6px 10px'}} onClick={()=>{setFiltInicio('');setFiltFim('');setFiltStatus('pendente');setFiltMotorista('');setFiltVeiculo('');setFiltBusca('');}}>✕ Limpar</button>
            )}
          </div>
        </div>

        {/* KPIs */}
        <div className="metrics-grid cols-4 fade-up" style={{marginBottom:12}}>
          {[
            {label:'Total',val:rows.length,cls:'',color:'var(--text)'},
            {label:'Entregues',val:rows.filter(r=>r.status==='entregue').length,cls:'green',color:'var(--green)'},
            {label:'Pendentes',val:rows.filter(r=>r.status==='pendente').length,cls:'amber',color:'var(--amber)'},
            {label:'Devoluções',val:rows.filter(r=>r.status==='devolucao').length,cls:'red',color:'var(--red)'},
          ].map(k=>(
            <div key={k.label} className={`metric-card ${k.cls}`}>
              <div className="metric-label">{k.label}</div>
              <div className="metric-value" style={{color:k.color}}>{k.val}</div>
            </div>
          ))}
        </div>

        <div className="card fade-up fade-up-1">
          {!filtInicio && !filtFim && (
            <div style={{padding:'8px 12px',background:'var(--accent-lt)',borderRadius:'var(--radius)',marginBottom:12,fontSize:12,color:'var(--accent)'}}>
              Mostrando ordens <strong>pendentes</strong>. Use os filtros de data para buscar por período.
            </div>
          )}
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Grupo</th>
                  {visivel('numero_rota') && <th>Rota</th>}
                  <th>Cliente</th>
                  <th>Motorista</th>
                  <th>Veículo</th>
                  <th>Região</th>
                  {visivel('peso') && <th>Peso</th>}
                  {visivel('nf') && <th>NF</th>}
                  {visivel('anexo') && <th>Anexo</th>}
                  <th>Status</th>
                  <th>Ação</th>
                </tr>
              </thead>
              <tbody>
                {loading && Array.from({length:5}).map((_,i)=>(
                  <tr key={i}>{Array.from({length:10}).map((_,j)=>(
                    <td key={j}><div style={{height:12,background:'var(--bg3)',borderRadius:4,width:'65%'}}/></td>
                  ))}</tr>
                ))}
                {!loading && !rows.length && (
                  <tr><td colSpan={14} style={{textAlign:'center',color:'var(--text3)',padding:'40px 0',fontSize:13}}>
                    Nenhuma ordem encontrada para este filtro
                  </td></tr>
                )}
                {rows.map(r=>(
                  <tr key={r.id}>
                    <td className="font-mono" style={{fontSize:11}}>{fmtDate(r.data)}</td>
                    <td>{r.grupo_viagem ? (
                      <span onClick={()=>desagrupar(r.grupo_viagem)} title="Clique para desagrupar" style={{cursor:"pointer",display:"inline-flex",alignItems:"center",gap:3}}>
                        <span className="badge badge-purple" style={{background:"#7c3aed",color:"#fff",fontSize:10}}>{r.grupo_viagem}</span>
                      </span>
                    ) : <span style={{color:"var(--text3)",fontSize:11}}>—</span>}</td>
                    {visivel('numero_rota') && <td className="font-mono fw-600" style={{color:'var(--accent)'}}>{r.numero_rota}</td>}
                    <td>
                      <div className="fw-500 truncate" style={{maxWidth:150}}>{r.cliente_nome}</div>
                      {r.regiao&&<div style={{fontSize:11,color:'var(--text3)'}}>{r.regiao}</div>}
                    </td>
                    <td style={{fontSize:12}}>{r.motorista_nome||'—'}</td>
                    <td>
                      {r.veiculo_tipo&&<span className="badge badge-teal">{r.veiculo_tipo}</span>}
                      {r.placa&&<span style={{fontSize:10,color:'var(--text3)',marginLeft:4}}>{r.placa}</span>}
                    </td>
                    <td style={{fontSize:12}}>{r.regiao||'—'}</td>
                    {visivel('peso') && <td style={{fontSize:12}}>{r.peso?Number(r.peso).toLocaleString('pt-BR')+' kg':'—'}</td>}
                    {visivel('nf') && <td className="font-mono" style={{fontSize:11}}>{r.nf||'—'}</td>}
                    {visivel('anexo') && <td><AnexoCell ordem={r} /></td>}
                    <td><StatusBadge status={r.status} /></td>
                    <td>
                      <div style={{display:'flex',gap:4,alignItems:'center',flexWrap:'wrap'}}>
                        <select className="form-select" style={{width:100,fontSize:11,padding:'4px 6px'}}
                          value={r.status} onChange={e=>{
                            if (e.target.value === 'cancelado') {
                              if (confirm('Cancelar esta ordem? Os lançamentos financeiros pendentes serão cancelados.')) {
                                updateStatus(r.id, 'cancelado');
                              } else {
                                e.target.value = r.status;
                              }
                            } else {
                              updateStatus(r.id, e.target.value);
                            }
                          }}>
                          {STATUS_OPTS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                        <button className="btn btn-ghost btn-sm" style={{padding:'4px 6px',fontSize:10}} onClick={()=>openModal(r)} title="Editar">✏️</button>
                        <button className="btn btn-ghost btn-sm" style={{padding:'4px 6px',fontSize:10}} onClick={()=>showHistorico(r.id)} title="Histórico">🕐</button>
                        {r.status !== 'cancelado' && (
                          <button className="btn btn-danger btn-sm" style={{padding:'4px 8px',fontSize:10}}
                            onClick={()=>{
                              if (confirm('Cancelar esta ordem?\nOs lançamentos financeiros pendentes serão automaticamente cancelados.')) {
                                updateStatus(r.id, 'cancelado');
                              }
                            }}
                            title="Cancelar ordem">✕</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal Nova Ordem */}
      {modal && (
        <div className="modal-backdrop" onClick={e=>e.target===e.currentTarget&&closeModal()}>
          <div className="modal" style={{maxWidth:700}}>
            <div className="modal-header">
              <span className="modal-title">{editingId ? 'Editar Ordem de Transporte' : 'Nova Ordem de Transporte'}</span>
              <button className="modal-close" onClick={closeModal}>×</button>
            </div>
            <div className="modal-body">
              {formError && (
                <div style={{padding:'10px 14px',background:'var(--red-bg)',border:'1px solid var(--red)',borderRadius:'var(--radius)',marginBottom:16,fontSize:13,color:'var(--red)'}}>
                  {formError}
                </div>
              )}

              {/* Linha 0: Tipo de Frota (define visibilidade) */}
              <div style={{display:'flex',gap:8,marginBottom:14}}>
                <div style={{flex:1}}>
                  <Field label={<span>Tipo de Frota <span style={{color:'var(--red)',fontSize:10,fontWeight:700}}>*</span></span>}>
                    <Select value={form.tipo_frota||''} onChange={e=>set('tipo_frota',e.target.value)}
                      options={[
                        {value:'proprio',label:'🏠 Próprio'},
                        {value:'terceiro',label:'🚚 Terceiro'},
                      ]} />
                  </Field>
                </div>
              </div>

              {/* Linha 1: Data + Rota + Quant. Entregas */}
              <div style={{display:'flex',gap:8,marginBottom:14,alignItems:'flex-end'}}>
                <div style={{width:150,flexShrink:0}}>
                  <Field label={<span>Data <span style={{color:'var(--red)',fontSize:10,fontWeight:700}}>*</span></span>}>
                    <Input type="date" value={form.data||today} onChange={e=>set('data',e.target.value)} />
                  </Field>
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <FL label="Rota" obrig={true}>
                    <Input type="number" value={form.numero_rota||''} onChange={e=>set('numero_rota',e.target.value)} placeholder="4800" />
                  </FL>
                </div>
                <div style={{width:120,flexShrink:0}}>
                  <Field label="Quant. Entregas">
                    <Input type="number" value={form.quant_entregas||''} onChange={e=>set('quant_entregas',e.target.value)} min={0} placeholder="0" />
                  </Field>
                </div>
              </div>

              {/* Linha 2: Cliente, Motorista, Veículo, Região */}
              <div style={{display:'grid',gap:14,marginBottom:14}}>
                {/* Cliente - sempre full width */}
                <Field label={<span>Cliente <span style={{color:'var(--red)',fontSize:10,fontWeight:700}}>*</span></span>}>
                  <Select value={form.cliente_id||''} onChange={e=>onClienteChange(e.target.value)}
                    options={(clientes||[]).map(c=>({value:c.id,label:c.nome+(c.cidade?` — ${c.cidade}`:'')}))}>
                  </Select>
                </Field>

                {/* Motorista - com botão + Novo */}
                <Field label={<span>Motorista <span style={{color:'var(--red)',fontSize:10,fontWeight:700}}>*</span></span>}>
                  <div style={{display:'flex',gap:6}}>
                    <div style={{flex:1}}>
                      <Select value={form.motorista_id||''} onChange={e=>onMotoristaChange(e.target.value)}
                        options={(motoristas||[]).map(m=>({value:m.id,label:m.nome+(m.status_cadastro==='pendente_admin'?' ⚠️':'')}))} />
                    </div>
                    <button type="button" className="btn btn-ghost" onClick={()=>setShowPreMot(true)}
                      style={{padding:'6px 12px',whiteSpace:'nowrap'}} title="Pré-cadastro rápido">
                      + Novo
                    </button>
                  </div>
                </Field>

                {/* Ajudante Extra (R$) — só admin/operador */}
                {!ehMotorista && (
                  <Field label="Ajudante Extra (R$)">
                    <Input
                      type="number" step="0.01" min="0"
                      value={form.ajudante_extra||''}
                      onChange={e=>set('ajudante_extra',e.target.value)}
                      placeholder="0,00 (opcional)"
                    />
                  </Field>
                )}

                {/* Detalhes do Ajudante — só aparecem se Ajudante Extra > 0 */}
                {!ehMotorista && parseFloat(form.ajudante_extra) > 0 && (
                  <div style={{
                    border:'1px solid var(--border)', borderRadius:'var(--radius)',
                    padding:12, background:'var(--bg2)', display:'flex', flexDirection:'column', gap:10,
                  }}>
                    <div style={{fontSize:11, fontWeight:600, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.5px'}}>
                      👷 Detalhes do Ajudante
                    </div>

                    {/* Nome livre (rápido, sem cadastrar) */}
                    <Field label={<span>Nome do Ajudante <span style={{color:'var(--text3)',fontSize:10,fontWeight:400}}>(texto livre, opcional)</span></span>}>
                      <Input
                        value={form.ajudante_nome||''}
                        onChange={e=>set('ajudante_nome',e.target.value)}
                        placeholder="Ex: João (sem cadastrar)"
                      />
                    </Field>

                    {/* Multi-select de ajudantes cadastrados (com histórico) */}
                    <Field label={<span>Ou selecionar Cadastrados <span style={{color:'var(--text3)',fontSize:10,fontWeight:400}}>(múltiplos)</span></span>}>
                      <div style={{display:'flex',gap:6,alignItems:'flex-start'}}>
                        <div style={{flex:1,border:'1px solid var(--border)',borderRadius:'var(--radius)',padding:8,minHeight:42,display:'flex',flexWrap:'wrap',gap:6,alignItems:'center',background:'var(--bg)'}}>
                          {ajudantesIds.map(aId => {
                            const a = (ajudantesDisp||[]).find(x=>String(x.id)===String(aId));
                            return (
                              <span key={aId} style={{display:'inline-flex',alignItems:'center',gap:4,background:'var(--accent-lt)',color:'var(--accent)',padding:'3px 8px',borderRadius:12,fontSize:12}}>
                                👷 {a?.nome || aId}
                                <button type="button" onClick={()=>setAjudantesIds(prev=>prev.filter(x=>String(x)!==String(aId)))}
                                  style={{background:'none',border:'none',cursor:'pointer',color:'inherit',fontSize:14,padding:0,lineHeight:1}}>×</button>
                              </span>
                            );
                          })}
                          <Select value="" onChange={e=>{
                              if (e.target.value && !ajudantesIds.some(x=>String(x)===String(e.target.value))) {
                                setAjudantesIds(prev=>[...prev, e.target.value]);
                              }
                            }}
                            style={{flex:1,minWidth:140,border:'none',background:'transparent',padding:0}}
                            options={[
                              {value:'',label:ajudantesIds.length ? '+ Adicionar ajudante' : '— Selecione —'},
                              ...(ajudantesDisp||[])
                                .filter(a => !ajudantesIds.some(x=>String(x)===String(a.id)))
                                .map(a => ({value:a.id, label:a.nome})),
                            ]} />
                        </div>
                        <button type="button" className="btn btn-ghost" onClick={()=>setShowPreAju(true)}
                          style={{padding:'6px 12px',whiteSpace:'nowrap'}} title="Pré-cadastro rápido de ajudante">
                          + Novo
                        </button>
                      </div>
                      {(ajudantesDisp||[]).length === 0 && (
                        <div style={{fontSize:11,color:'var(--text3)',marginTop:4}}>
                          Nenhum ajudante cadastrado ainda. Use o campo "Nome do Ajudante" acima ou clique "+ Novo".
                        </div>
                      )}
                    </Field>
                  </div>
                )}

                {/* Veículo - com botão + Novo */}
                <Field label={<span>Veículo <span style={{color:'var(--red)',fontSize:10,fontWeight:700}}>*</span></span>}>
                  <div style={{display:'flex',gap:6}}>
                    <div style={{flex:1}}>
                      <Select value={form.veiculo_id||''} onChange={e=>set('veiculo_id',e.target.value)}
                        options={(veiculos||[]).map(v=>({value:v.id,label:`${v.placa} — ${v.tipo} — ${v.ag_ft==='frota'?'🏠 Frota':'🚚 Terceiro'}${v.status_cadastro==='pendente_admin'?' ⚠️':''}`}))} />
                    </div>
                    <button type="button" className="btn btn-ghost" onClick={()=>setShowPreVei(true)}
                      style={{padding:'6px 12px',whiteSpace:'nowrap'}} title="Pré-cadastro rápido">
                      + Novo
                    </button>
                  </div>
                </Field>

                {/* Tipo de Frete + Multiplicador (define cálculo CAR/CAP) */}
                <div className="form-grid cols-2">
                  <Field label={<span>Tipo de Frete <span style={{color:'var(--text3)',fontSize:10,fontWeight:400}}>(usa do veículo, mas pode mudar)</span></span>}>
                    <Select value={form.tipo_frete||''} onChange={e=>set('tipo_frete',e.target.value)}
                      options={['HR','IVECO','3/4','TOCO','TRUCK','MASTER'].map(v=>({value:v,label:v}))} />
                  </Field>
                  <Field label={<span>Multiplicador <span style={{color:'var(--text3)',fontSize:10,fontWeight:400}}>(ex: 2 = paga/recebe 2× o frete)</span></span>}>
                    <Input type="number" min={1} max={9} step={1}
                      value={form.multiplicador_frete||1}
                      onChange={e=>set('multiplicador_frete', Math.max(1, Math.min(9, parseInt(e.target.value,10) || 1)))}
                      disabled={ehMotorista && !editingId}
                      title={ehMotorista ? 'Editável durante a viagem' : ''}
                    />
                  </Field>
                </div>

                {/* Região - full width */}
                <Field label={<span>Região <span style={{color:'var(--text3)',fontSize:10,fontWeight:400}}>(define frete)</span></span>}>
                  <Select value={form.regiao||''} onChange={e=>set('regiao',e.target.value)}
                    options={(regioes||[]).map(r=>({value:r,label:r}))} />
                </Field>

                {/* Tipo */}
                <Field label="Tipo">
                  <Select value={form.tipo||''} onChange={e=>set('tipo',e.target.value)}
                    options={[{value:'',label:'—'},...['INTEIRO','CORTE'].map(v=>({value:v,label:v}))]} />
                </Field>
              </div>

              {/* Card de resumo de frete removido — valores aparecem na lista de OTs após salvar */}

              {/* Campos configuráveis */}
              <div className="form-grid cols-2" style={{marginBottom:14}}>
                {/* KM apenas se tipo_frota = proprio */}
                {form.tipo_frota === 'proprio' && (
                  <>
                    <Field label="KM Saída">
                      <Input type="number" step="0.1" value={form.km_saida||''} onChange={e=>set('km_saida',e.target.value)} placeholder="Hodômetro saída" />
                    </Field>
                    <Field label="KM Chegada">
                      <Input type="number" step="0.1" value={form.km_chegada||''} onChange={e=>set('km_chegada',e.target.value)} placeholder="Hodômetro chegada" />
                    </Field>
                    {form.km_saida && form.km_chegada && Number(form.km_chegada) > Number(form.km_saida) && (
                      <div style={{gridColumn:'span 2',padding:'6px 12px',background:'var(--accent-lt)',borderRadius:'var(--radius)',fontSize:12,color:'var(--accent)'}}>
                        Distância percorrida: <strong>{(Number(form.km_chegada) - Number(form.km_saida)).toFixed(1)} km</strong>
                      </div>
                    )}
                  </>
                )}
                {/* Ajuda Diesel — apenas Terceiro */}
                {!ehMotorista && form.tipo_frota === 'terceiro' && visivel('ajuda_diesel') && (
                  <FL label="Ajuda Diesel (R$)" obrig={obrigatorio('ajuda_diesel')}>
                    <Input type="number" step="0.01" min="0" value={form.ajuda_diesel||''} onChange={e=>set('ajuda_diesel',e.target.value)} placeholder="0,00" />
                  </FL>
                )}
                {/* Taxa Descarga — apenas Terceiro */}
                {!ehMotorista && form.tipo_frota === 'terceiro' && visivel('taxa_descarga') && (
                  <FL label="Taxa Descarga (R$)" obrig={obrigatorio('taxa_descarga')}>
                    <Input type="number" step="0.01" min="0" value={form.taxa_descarga||''} onChange={e=>set('taxa_descarga',e.target.value)} placeholder="0,00" />
                  </FL>
                )}
                {visivel('obs') && (
                  <div style={{gridColumn:'span 2'}}>
                    <FL label="Observações" obrig={obrigatorio('obs')}>
                      <Input value={form.obs||''} onChange={e=>set('obs',e.target.value)} />
                    </FL>
                  </div>
                )}
              </div>

              {/* Resumo de paradas (só na edição, quando vier da importação) */}
              {editingId && paradas.length > 0 && (
                <div style={{
                  padding:'12px 14px',background:'var(--bg2)',border:'1px solid var(--border)',
                  borderRadius:'var(--radius)',marginBottom:14
                }}>
                  <div style={{fontSize:11,fontWeight:600,color:'var(--text3)',textTransform:'uppercase',letterSpacing:'.5px',marginBottom:8}}>
                    📍 {paradas.length} Paradas (importadas do Roteasy)
                  </div>
                  <div style={{maxHeight:140,overflow:'auto',fontSize:12}}>
                    {paradas.slice(0,10).map((p,i)=>(
                      <div key={i} style={{padding:'4px 0',borderBottom:'1px solid var(--border)',display:'flex',gap:8}}>
                        <span style={{color:'var(--text3)',width:24}}>#{p.seq}</span>
                        <span style={{flex:1,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{p.cliente_nome}</span>
                        <span style={{color:'var(--text3)'}}>{p.peso?Number(p.peso).toFixed(1)+'kg':''}</span>
                      </div>
                    ))}
                    {paradas.length > 10 && <div style={{color:'var(--text3)',fontSize:11,marginTop:4}}>... e mais {paradas.length-10}</div>}
                  </div>
                </div>
              )}

              {/* Anexos (múltiplos) */}
              {visivel('anexo') && (
                <div>
                  <div style={{fontSize:12,fontWeight:600,color:'var(--text3)',textTransform:'uppercase',letterSpacing:'.05em',marginBottom:6}}>
                    Anexos {obrigatorio('anexo') && <span style={{color:'var(--red)'}}>*</span>}
                    <span style={{fontWeight:400,textTransform:'none',marginLeft:6}}>(NF, romaneio, comprovante...)</span>
                  </div>
                  {editingId && (
                    <AnexosExistentes
                      ordemId={editingId}
                      refreshKey={anexosRefreshKey}
                      onChange={() => setAnexosRefreshKey(k => k + 1)}
                      showToast={showToast}
                    />
                  )}
                  <UploadZone files={anexos} onFiles={setAnexos} />
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={closeModal}>Cancelar</button>
              <button className="btn btn-primary" onClick={save}>{editingId ? 'Salvar Alterações' : 'Salvar Ordem'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Histórico */}
      {historicoModal && (
        <div className="modal-backdrop" onClick={e=>e.target===e.currentTarget&&setHistoricoModal(null)}>
          <div className="modal" style={{maxWidth:480}}>
            <div className="modal-header">
              <span className="modal-title">Histórico de Alterações</span>
              <button className="modal-close" onClick={()=>setHistoricoModal(null)}>×</button>
            </div>
            <div className="modal-body">
              {!historico.length ? (
                <div style={{textAlign:'center',color:'var(--text3)',padding:'24px 0',fontSize:13}}>
                  Nenhuma alteração registrada
                </div>
              ) : (
                <div style={{display:'flex',flexDirection:'column',gap:8}}>
                  {historico.map((h,i) => (
                    <div key={i} style={{padding:'10px 12px',background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:'var(--radius)',fontSize:12}}>
                      <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                        <span className="fw-500">{h.usuario_nome || 'Sistema'}</span>
                        <span style={{color:'var(--text3)',fontSize:11}}>
                          {new Date(h.created_at).toLocaleString('pt-BR')}
                        </span>
                      </div>
                      <div>
                        <StatusBadge status={h.status_anterior} />
                        <span style={{margin:'0 6px',color:'var(--text3)'}}>→</span>
                        <StatusBadge status={h.status_novo} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Agrupar Romaneios */}
      {agrupModal && (
        <div className="modal-backdrop" onClick={e=>e.target===e.currentTarget&&setAgrupModal(false)}>
          <div className="modal" style={{maxWidth:500}}>
            <div className="modal-header">
              <span className="modal-title">🔗 Agrupar Romaneios</span>
              <button className="modal-close" onClick={()=>setAgrupModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div style={{padding:"12px 16px",background:"#F5F3FF",border:"1px solid #DDD6FE",borderRadius:"var(--radius)",marginBottom:16,fontSize:13}}>
                <strong>{selectedIds.length} ordens</strong> serão agrupadas numa única viagem.
                <br/><span style={{fontSize:11,color:"#6B21A8"}}>O sistema vai cancelar os fretes individuais e gerar 1 frete único pro terceiro.</span>
              </div>
              <Field label="Motorista (opcional — altera todas)">
                <Select value={agrupForm.motorista_id||""} onChange={e=>{
                  setAgrupForm(f=>({...f,motorista_id:e.target.value}));
                  const mot=(motoristas||[]).find(m=>String(m.id)===String(e.target.value));
                  if(mot?.veiculo_padrao_id) setAgrupForm(f=>({...f,veiculo_id:String(mot.veiculo_padrao_id)}));
                }} options={(motoristas||[]).map(m=>({value:m.id,label:m.nome}))} />
              </Field>
              <div style={{marginTop:12}}>
                <Field label="Veículo (define o frete único)">
                  <Select value={agrupForm.veiculo_id||""} onChange={e=>setAgrupForm(f=>({...f,veiculo_id:e.target.value}))}
                    options={(veiculos||[]).map(v=>({value:v.id,label:`${v.placa} — ${v.tipo} — ${v.ag_ft==="frota"?"🏠 Frota":"🚚 Terceiro"}`}))} />
                </Field>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={()=>setAgrupModal(false)}>Cancelar</button>
              <button className="btn btn-primary" style={{background:"#7c3aed"}} onClick={confirmarAgrupar}>Confirmar Agrupamento</button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast {...toast} />}

      <ImportRoteasy
        open={showImportRoteasy}
        onClose={() => setShowImportRoteasy(false)}
        onSuccess={() => { refetch(); setShowImportRoteasy(false); showToast('✅ Importação concluída com sucesso', 'success'); }}
      />

      {/* Pré-cadastro modais */}
      <PreCadastroModal
        tipo="motorista"
        open={showPreMot}
        onClose={() => setShowPreMot(false)}
        onSuccess={async (criado) => {
          showToast(`Motorista "${criado.nome}" pré-cadastrado`, 'success');
          await refetchMot();
          set('motorista_id', criado.id);
          setShowPreMot(false);
        }}
        transportadoras={transportadoras || []}
      />
      <PreCadastroModal
        tipo="veiculo"
        open={showPreVei}
        onClose={() => setShowPreVei(false)}
        onSuccess={async (criado) => {
          showToast(`Veículo "${criado.placa}" pré-cadastrado`, 'success');
          await refetchVei();
          set('veiculo_id', criado.id);
          setShowPreVei(false);
        }}
        transportadoras={transportadoras || []}
      />
      <PreCadastroModal
        tipo="motorista"
        tipoColaboradorPadrao="ajudante"
        tituloOverride="+ Novo Ajudante (rápido)"
        open={showPreAju}
        onClose={() => setShowPreAju(false)}
        onSuccess={async (criado) => {
          showToast(`Ajudante "${criado.nome}" cadastrado`, 'success');
          await Promise.all([refetchMot(), refetchAju()]);
          setAjudantesIds(prev =>
            prev.some(x => String(x) === String(criado.id)) ? prev : [...prev, criado.id]
          );
          setShowPreAju(false);
        }}
        transportadoras={transportadoras || []}
      />
    </div>
  );
}
