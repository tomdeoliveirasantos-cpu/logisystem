import { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../lib/api';

/**
 * Apontamento de saída de rota.
 * Preenchido no momento em que a rota sai, para o gestor acompanhar pelo
 * sistema em vez de depender de aviso por WhatsApp.
 */

const hojeISO = () => new Date().toISOString().slice(0, 10);
const agoraHM = () => new Date().toTimeString().slice(0, 5);
const fmtData = (d) => (d ? String(d).slice(0, 10).split('-').reverse().join('/') : '—');
const fmtHora = (h) => (h ? String(h).slice(0, 5) : '—');

const VAZIO = {
  data_saida: hojeISO(),
  rota_codigo: '',
  veiculo_id: '',
  motorista_id: '',
  peso_kg: '',
  km_inicial: '',
  qtd_entregas: '',
  hora_saida: '',
};

/** Campo de seleção com busca — a lista é grande demais para um select comum */
function SelecaoBusca({ valor, aoMudar, opcoes, placeholder, aviso, rotulo, obrigatorio }) {
  const [busca, setBusca] = useState('');
  const [aberto, setAberto] = useState(false);
  const selecionado = opcoes.find((o) => String(o.id) === String(valor));

  const filtradas = useMemo(() => {
    const t = busca.trim().toLowerCase();
    if (!t) return opcoes;
    return opcoes.filter((o) => o.rotulo.toLowerCase().includes(t));
  }, [busca, opcoes]);

  return (
    <div className="sr-campo">
      <label>{rotulo} {obrigatorio && <i>*</i>}</label>
      <div className="sr-busca">
        <input
          value={aberto ? busca : (selecionado ? selecionado.rotulo : '')}
          onChange={(e) => { setBusca(e.target.value); setAberto(true); }}
          onFocus={() => { setBusca(''); setAberto(true); }}
          onBlur={() => setTimeout(() => setAberto(false), 160)}
          placeholder={placeholder}
          className={selecionado ? 'preenchido' : ''}
        />
        {selecionado && !aberto && (
          <button type="button" className="sr-limpar-campo" onClick={() => aoMudar('')} aria-label="Limpar">✕</button>
        )}
        {aberto && (
          <ul className="sr-opcoes">
            {filtradas.length === 0 && <li className="vazio">Nada encontrado</li>}
            {filtradas.map((o) => (
              <li key={o.id}>
                <button type="button" onMouseDown={() => { aoMudar(String(o.id)); setAberto(false); }}>
                  <strong>{o.rotulo}</strong>
                  {o.detalhe && <span>{o.detalhe}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {aviso && <small>{aviso}</small>}
    </div>
  );
}

export default function SaidaRota() {
  const [form, setForm] = useState(VAZIO);
  const [opcoes, setOpcoes] = useState({ motoristas: [], veiculos: [], ajudantes: [] });
  const [lista, setLista] = useState([]);
  const [msg, setMsg] = useState(null);
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const [o, l] = await Promise.all([
        api.get('/saidas/opcoes'),
        api.get(`/saidas?data=${hojeISO()}`),
      ]);
      setOpcoes(o);
      setLista(l);
    } catch (e) { setMsg({ tipo: 'erro', txt: e.message }); }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const campo = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const veiculo = opcoes.veiculos.find((v) => String(v.id) === String(form.veiculo_id));

  async function registrar(e) {
    e.preventDefault();
    setMsg(null);
    if (!form.rota_codigo.trim()) return setMsg({ tipo: 'erro', txt: 'Informe o número da rota' });
    if (!form.veiculo_id) return setMsg({ tipo: 'erro', txt: 'Selecione a placa do veículo' });
    if (!form.motorista_id) return setMsg({ tipo: 'erro', txt: 'Selecione o motorista' });
    if (!form.qtd_entregas) return setMsg({ tipo: 'erro', txt: 'Informe a quantidade de entregas' });

    setSalvando(true);
    try {
      await api.post('/saidas', {
        ...form,
        hora_saida: form.hora_saida || agoraHM(),
        peso_kg: form.peso_kg || null,
        km_inicial: form.km_inicial || null,
      });
      setMsg({ tipo: 'ok', txt: `Rota ${form.rota_codigo} registrada` });
      setForm({ ...VAZIO, data_saida: form.data_saida });
      carregar();
    } catch (err) {
      setMsg({ tipo: 'erro', txt: err.message });
    } finally { setSalvando(false); }
  }

  const totalEntregas = lista.reduce((s, r) => s + (Number(r.qtd_entregas) || 0), 0);

  return (
    <div className="sr-page">
      <div className="sr-titulo">
        <div>
          <span className="sr-etiqueta">Novo registro</span>
          <h1>Dados da rota</h1>
        </div>
        <span className="sr-obrig">* Campos obrigatórios</span>
      </div>

      <form className="sr-card" onSubmit={registrar}>
        <div className="sr-grid">
          <div className="sr-campo">
            <label>Data <i>*</i></label>
            <input type="date" value={form.data_saida} onChange={(e) => campo('data_saida', e.target.value)} required />
          </div>

          <div className="sr-campo">
            <label>Número da rota <i>*</i></label>
            <input
              value={form.rota_codigo}
              onChange={(e) => campo('rota_codigo', e.target.value)}
              placeholder="Ex.: 1024"
              inputMode="numeric"
              required
            />
          </div>

          <SelecaoBusca
            rotulo="Placa do veículo"
            obrigatorio
            valor={form.veiculo_id}
            aoMudar={(v) => campo('veiculo_id', v)}
            placeholder="Selecione a placa"
            aviso={veiculo ? `Tipo: ${veiculo.tipo || veiculo.modelo || '—'}` : 'O tipo aparecerá após a seleção'}
            opcoes={opcoes.veiculos.map((v) => ({
              id: v.id, rotulo: v.placa, detalhe: v.tipo || v.modelo,
            }))}
          />

          <SelecaoBusca
            rotulo="Nome do motorista"
            obrigatorio
            valor={form.motorista_id}
            aoMudar={(v) => campo('motorista_id', v)}
            placeholder="Digite para buscar"
            aviso="Digite parte do nome para filtrar"
            opcoes={opcoes.motoristas.map((m) => ({ id: m.id, rotulo: m.nome }))}
          />

          <div className="sr-campo">
            <label>Peso (kg)</label>
            <input
              value={form.peso_kg}
              onChange={(e) => campo('peso_kg', e.target.value)}
              placeholder="Ex.: 2.450"
              inputMode="decimal"
            />
          </div>

          <div className="sr-campo">
            <label>KM</label>
            <input
              value={form.km_inicial}
              onChange={(e) => campo('km_inicial', e.target.value)}
              placeholder="Ex.: 186"
              inputMode="decimal"
            />
          </div>

          <div className="sr-campo">
            <label>Quantidade de entregas <i>*</i></label>
            <input
              value={form.qtd_entregas}
              onChange={(e) => campo('qtd_entregas', e.target.value.replace(/\D/g, ''))}
              placeholder="Ex.: 24"
              inputMode="numeric"
              required
            />
          </div>

          <div className="sr-campo">
            <label>Horário de saída <i>*</i></label>
            <input type="time" value={form.hora_saida} onChange={(e) => campo('hora_saida', e.target.value)} />
            <small>Em branco, usa o horário atual</small>
          </div>
        </div>

        {msg && <p className={`sr-msg ${msg.tipo}`}>{msg.txt}</p>}

        <div className="sr-acoes">
          <button type="button" className="sr-btn" onClick={() => setForm({ ...VAZIO, data_saida: form.data_saida })}>
            Limpar
          </button>
          <button type="submit" className="sr-btn primario" disabled={salvando}>
            {salvando ? 'Registrando…' : 'Registrar saída'}
          </button>
        </div>
      </form>

      <div className="sr-card">
        <div className="sr-lista-topo">
          <h2>Saídas de hoje</h2>
          <span>{lista.length} rota(s) · {totalEntregas} entregas</span>
        </div>
        {lista.length === 0 && <p className="sr-vazio">Nenhuma rota registrada hoje.</p>}
        <div className="sr-tabela-scroll">
          {lista.length > 0 && (
            <table className="sr-tabela">
              <thead>
                <tr>
                  <th>Rota</th><th>Motorista</th><th>Placa</th><th>Tipo</th>
                  <th>Entregas</th><th>Peso</th><th>KM</th><th>Saída</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((r) => (
                  <tr key={r.id}>
                    <td><strong>{r.rota_codigo}</strong></td>
                    <td title={r.motorista_nome}>
                      {(r.motorista_nome || '—').split(' ').slice(0, 2).join(' ')}
                    </td>
                    <td>{r.placa || '—'}</td>
                    <td>{r.modelo || '—'}</td>
                    <td>{r.qtd_entregas ?? '—'}</td>
                    <td>{r.peso_kg ? `${Number(r.peso_kg).toLocaleString('pt-BR')} kg` : '—'}</td>
                    <td>{r.km_inicial ?? '—'}</td>
                    <td>{fmtHora(r.hora_saida)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {lista.length > 0 && (
          <p className="sr-rodape-lista">Registros de {fmtData(hojeISO())}</p>
        )}
      </div>

      <style>{`
        .sr-page{max-width:960px;margin:0 auto;padding-bottom:24px}
        .sr-titulo{display:flex;justify-content:space-between;align-items:flex-end;gap:12px;flex-wrap:wrap;margin-bottom:12px}
        .sr-etiqueta{font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#8a94b8}
        .sr-titulo h1{margin:2px 0 0;font-size:22px;color:#1a2b5c}
        .sr-obrig{font-size:11.5px;color:#c0392b}
        .sr-card{background:#fff;border:1px solid #e2e5ee;border-radius:14px;padding:18px;margin-bottom:14px}
        .sr-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
        @media(max-width:640px){.sr-grid{grid-template-columns:1fr}}
        .sr-campo{display:grid;gap:5px;position:relative}
        .sr-campo label{font-size:12.5px;font-weight:600;color:#445}
        .sr-campo label i{color:#c0392b;font-style:normal}
        .sr-campo input{border:1px solid #d5d9e6;border-radius:9px;padding:11px 12px;font:inherit;font-size:14px;width:100%;background:#fbfcfe}
        .sr-campo input:focus{outline:none;border-color:#2547e8;background:#fff;box-shadow:0 0 0 3px rgba(37,71,232,.12)}
        .sr-campo small{font-size:11px;color:#8a94b8}
        .sr-busca{position:relative}
        .sr-busca input.preenchido{font-weight:600;color:#1a2b5c}
        .sr-limpar-campo{position:absolute;right:8px;top:50%;transform:translateY(-50%);background:none;border:none;color:#99a;cursor:pointer;font-size:13px;padding:4px}
        .sr-opcoes{position:absolute;z-index:30;top:calc(100% + 4px);left:0;right:0;max-height:230px;overflow-y:auto;
          background:#fff;border:1px solid #d5d9e6;border-radius:10px;box-shadow:0 8px 24px rgba(20,30,60,.14);list-style:none;margin:0;padding:4px}
        .sr-opcoes li button{display:flex;justify-content:space-between;align-items:center;gap:10px;width:100%;text-align:left;
          background:none;border:none;padding:9px 10px;border-radius:7px;cursor:pointer;font:inherit;font-size:13.5px}
        .sr-opcoes li button:hover{background:#f0f3fb}
        .sr-opcoes li button span{font-size:11.5px;color:#8a94b8}
        .sr-opcoes li.vazio{padding:10px;color:#8a94b8;font-size:13px}
        .sr-msg{margin:14px 0 0;padding:9px 12px;border-radius:9px;font-size:13px}
        .sr-msg.ok{background:#e7f6ee;color:#1a7f4b}
        .sr-msg.erro{background:#fdecec;color:#c0392b}
        .sr-acoes{display:flex;justify-content:flex-end;gap:8px;margin-top:16px}
        .sr-btn{border:1px solid #d5d9e6;background:#fff;border-radius:9px;padding:11px 20px;font:inherit;font-weight:600;cursor:pointer}
        .sr-btn.primario{background:#2547e8;border-color:#2547e8;color:#fff}
        .sr-btn.primario:disabled{opacity:.6}
        .sr-lista-topo{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:10px}
        .sr-lista-topo h2{margin:0;font-size:16px;color:#1a2b5c}
        .sr-lista-topo span{font-size:12.5px;color:#667}
        .sr-vazio{color:#8a94b8;font-size:13.5px;margin:6px 0 0}
        .sr-tabela-scroll{overflow-x:auto}
        .sr-tabela{width:100%;border-collapse:collapse;font-size:13px}
        .sr-tabela th,.sr-tabela td{text-align:left;padding:8px;border-bottom:1px solid #eef0f6;white-space:nowrap}
        .sr-tabela th{font-size:11.5px;color:#667;font-weight:600;text-transform:uppercase;letter-spacing:.03em}
        .sr-rodape-lista{margin:10px 0 0;font-size:11.5px;color:#8a94b8}
      `}</style>
    </div>
  );
}
