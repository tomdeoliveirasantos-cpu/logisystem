import { useState, useRef } from 'react';
import { api } from '../lib/api';
import { Field, Input } from './UI';

/**
 * Importa relatório de serviços do Roteasy → preenche paradas das OTs já criadas.
 *
 * Fluxo: upload .xlsx → parse cliente-side → preview (match com OTs) → confirmar.
 * Backend só importa rotas que já têm OT cadastrada para a data (match por numero_rota).
 * Rotas sem OT correspondente são ignoradas.
 */
export default function ImportRoteasy({ open, onClose, onSuccess }) {
  const [etapa, setEtapa] = useState('upload');
  const [arquivo, setArquivo] = useState(null);
  const [dataRota, setDataRota] = useState('');
  const [parsedRotas, setParsedRotas] = useState(null);
  const [preview, setPreview] = useState(null);
  const [resultado, setResultado] = useState(null);
  const [erro, setErro] = useState('');
  const inputRef = useRef(null);

  if (!open) return null;

  function reset() {
    setEtapa('upload');
    setArquivo(null);
    setDataRota('');
    setParsedRotas(null);
    setPreview(null);
    setResultado(null);
    setErro('');
    if (inputRef.current) inputRef.current.value = '';
  }

  function fechar() {
    reset();
    onClose?.();
  }

  // ── Parser do Roteasy ──────────────────────────────────────
  async function parseFile(file) {
    if (!window.XLSX) throw new Error('Biblioteca XLSX não carregada. Recarregue a página.');
    const buffer = await file.arrayBuffer();
    const wb = window.XLSX.read(buffer, { type: 'array', cellDates: false });

    const sheetName = wb.SheetNames.find(n => /servi[çc]o/i.test(n)) || wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];
    const linhas = window.XLSX.utils.sheet_to_json(ws, { defval: null, raw: true });

    if (!linhas.length) throw new Error('Planilha vazia.');

    const primeiraData = linhas.find(l => l['Data da Rota'])?.['Data da Rota'];
    const dataDetectada = converterDataBR(primeiraData);

    const mapaRotas = new Map();
    for (const l of linhas) {
      const evento = String(l['Evento'] || '').toLowerCase();
      const numeroRota = l['Nome'];
      if (numeroRota == null) continue;

      const chave = String(numeroRota);
      if (!mapaRotas.has(chave)) {
        mapaRotas.set(chave, {
          numero_rota: chave,
          placa: null,
          operador: null,
          transportadora: null,
          tipo_veiculo: null,
          regiao: null,
          paradas: [],
        });
      }
      const rota = mapaRotas.get(chave);

      if (evento === 'saida' || evento === 'saída') {
        rota.placa = l['Placa do veículo'] || null;
        rota.operador = l['Operador'] || null;
        rota.transportadora = l['Transportadora'] || null;
        rota.tipo_veiculo = l['Veiculo'] || null;
        continue;
      }

      if (evento === 'serviço' || evento === 'servico') {
        if (!rota.placa) rota.placa = l['Placa do veículo'] || null;
        if (!rota.operador) rota.operador = l['Operador'] || null;
        if (!rota.transportadora) rota.transportadora = l['Transportadora'] || null;
        if (!rota.tipo_veiculo) rota.tipo_veiculo = l['Veiculo'] || null;
        if (!rota.regiao) rota.regiao = l['Região'] || null;

        rota.paradas.push({
          seq: Number(l['Sequência']) || rota.paradas.length + 1,
          codigo_local: l['Código Local'] != null ? String(l['Código Local']) : null,
          cliente_nome: l['Nome Local'] || null,
          endereco: l['Endereço'] || null,
          regiao: l['Região'] || null,
          peso: l['PESO (KG)'] != null ? Number(l['PESO (KG)']) : null,
          pedido: l['Número Pedido'] != null ? String(l['Número Pedido']) : null,
          remessa: l['Número da remessa'] != null ? String(l['Número da remessa']) : null,
          nf: l['Número NF'] != null ? String(l['Número NF']) : null,
          latitude: l['Latitude'] != null ? Number(l['Latitude']) : null,
          longitude: l['Longitude'] != null ? Number(l['Longitude']) : null,
          obs: [l['Observações'], l['Informação Adicional 1'], l['Informação Adicional 2']]
            .filter(Boolean).join(' | ') || null,
        });
      }
    }

    return {
      data: dataDetectada,
      rotas: Array.from(mapaRotas.values()).filter(r => r.paradas.length > 0),
    };
  }

  function converterDataBR(s) {
    if (!s) return '';
    const m = String(s).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!m) return '';
    return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErro('');
    setArquivo(file);
    try {
      const parsed = await parseFile(file);
      setParsedRotas(parsed);
      if (parsed.data) setDataRota(parsed.data);
    } catch (err) {
      setErro(`Erro ao ler planilha: ${err.message}`);
      setArquivo(null);
    }
  }

  async function gerarPreview() {
    if (!parsedRotas || !dataRota) {
      setErro('Selecione um arquivo e confirme a data.');
      return;
    }
    setErro('');
    try {
      const payload = { data: dataRota, rotas: parsedRotas.rotas };
      const data = await api.post('/ordens/importar/preview', payload);
      setPreview(data);
      setEtapa('preview');
    } catch (err) {
      setErro(`Erro ao gerar preview: ${err.message}`);
    }
  }

  async function confirmarImportacao() {
    setEtapa('enviando');
    setErro('');
    try {
      const payload = { data: dataRota, rotas: parsedRotas.rotas };
      const data = await api.post('/ordens/importar', payload);
      setResultado(data);
      setEtapa('resultado');
      onSuccess?.(data);
    } catch (err) {
      setErro(`Erro ao importar: ${err.message}`);
      setEtapa('preview');
    }
  }

  return (
    <div className="modal-backdrop" onClick={fechar}>
      <div className="modal" style={{ maxWidth: 920 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 style={{ margin: 0, fontSize: 18 }}>📥 Importar Planilha Roteasy</h2>
          <button className="modal-close" onClick={fechar}>×</button>
        </div>

        <div className="modal-body">
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, fontSize: 12 }}>
            <Step ativo={etapa === 'upload'} concluido={etapa !== 'upload'}>1. Upload</Step>
            <Step ativo={etapa === 'preview'} concluido={etapa === 'enviando' || etapa === 'resultado'}>2. Pré-visualização</Step>
            <Step ativo={etapa === 'enviando' || etapa === 'resultado'} concluido={etapa === 'resultado'}>3. Importar</Step>
          </div>

          {erro && (
            <div style={{ background: '#fee', border: '1px solid #fcc', color: '#900',
              padding: 10, borderRadius: 6, marginBottom: 12, fontSize: 13 }}>
              ⚠️ {erro}
            </div>
          )}

          {/* ETAPA 1: Upload */}
          {etapa === 'upload' && (
            <div>
              <div style={{ background: '#fffbeb', border: '1px solid #fde68a', padding: 10,
                borderRadius: 6, marginBottom: 12, fontSize: 13 }}>
                <strong>⚠️ Importante:</strong> a importação só preenche paradas em OTs já cadastradas.
                Crie as OTs do dia (uma por rota) <strong>antes</strong> de importar a planilha.
                Rotas da planilha sem OT correspondente serão ignoradas.
              </div>

              <Field label="Arquivo (.xlsx do Roteasy)">
                <input type="file" ref={inputRef} accept=".xlsx,.xlsm,.xls"
                  onChange={handleFile} style={{ width: '100%', padding: 8 }} />
              </Field>

              {parsedRotas && (
                <>
                  <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd',
                    borderRadius: 6, padding: 12, marginTop: 12, fontSize: 13 }}>
                    ✅ Planilha lida com sucesso:
                    <ul style={{ margin: '6px 0 0 18px' }}>
                      <li><strong>{parsedRotas.rotas.length}</strong> rotas detectadas</li>
                      <li><strong>{parsedRotas.rotas.reduce((s, r) => s + r.paradas.length, 0)}</strong> entregas no total</li>
                    </ul>
                  </div>

                  <Field label="Data da Rota">
                    <Input type="date" value={dataRota} onChange={e => setDataRota(e.target.value)} />
                  </Field>
                </>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
                <button className="btn btn-ghost" onClick={fechar}>Cancelar</button>
                <button className="btn btn-primary" onClick={gerarPreview}
                  disabled={!parsedRotas || !dataRota}>
                  Pré-visualizar →
                </button>
              </div>
            </div>
          )}

          {/* ETAPA 2: Preview */}
          {etapa === 'preview' && preview && (
            <div>
              <div style={{ display: 'flex', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
                <Stat label="Data" valor={fmtDataBR(preview.data)} />
                <Stat label="Rotas na planilha" valor={preview.total_rotas_planilha} />
                <Stat label="✓ Match" valor={preview.total_rotas_match} cor="#16a34a" />
                <Stat label="✗ Sem OT" valor={preview.total_rotas_sem_ot}
                  cor={preview.total_rotas_sem_ot ? '#dc2626' : null} />
                <Stat label="Paradas a importar" valor={preview.total_paradas_match} />
              </div>

              {preview.total_rotas_sem_ot > 0 && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca',
                  borderRadius: 6, padding: 12, marginBottom: 12, fontSize: 13 }}>
                  <strong>⚠️ {preview.total_rotas_sem_ot} rota(s) sem OT cadastrada serão IGNORADAS.</strong>
                  <p style={{ margin: '4px 0 0 0', fontSize: 12, color: '#991b1b' }}>
                    Cadastre as OTs antes de importar, ou estas entregas não entrarão no sistema.
                  </p>
                </div>
              )}

              <div style={{ maxHeight: 360, overflow: 'auto', border: '1px solid var(--border)', borderRadius: 6 }}>
                <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                  <thead style={{ background: 'var(--bg2)', position: 'sticky', top: 0 }}>
                    <tr>
                      <th style={th}>Status</th>
                      <th style={th}>Rota</th>
                      <th style={th}>Tipo Frota</th>
                      <th style={{ ...th, textAlign: 'right' }}>Paradas atuais</th>
                      <th style={{ ...th, textAlign: 'right' }}>Paradas planilha</th>
                      <th style={{ ...th, textAlign: 'right' }}>Peso (kg)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rotas.map((r, i) => (
                      <tr key={i} style={{ borderTop: '1px solid var(--border)',
                        background: r.status === 'sem_ot' ? '#fef2f2' : 'transparent' }}>
                        <td style={td}>
                          {r.status === 'match'
                            ? <span style={{ color: '#16a34a', fontWeight: 600 }}>✓ Match</span>
                            : <span style={{ color: '#dc2626', fontWeight: 600 }}>✗ Sem OT</span>}
                        </td>
                        <td style={td}><strong>{r.numero_rota}</strong></td>
                        <td style={td}>{r.tipo_frota || '—'}</td>
                        <td style={{ ...td, textAlign: 'right', color: 'var(--text3)' }}>
                          {r.paradas_atual ?? '—'}
                        </td>
                        <td style={{ ...td, textAlign: 'right' }}>{r.paradas_planilha}</td>
                        <td style={{ ...td, textAlign: 'right' }}>{r.peso_total.toFixed(1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 16 }}>
                <button className="btn btn-ghost" onClick={() => setEtapa('upload')}>← Voltar</button>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-ghost" onClick={fechar}>Cancelar</button>
                  <button className="btn btn-primary" onClick={confirmarImportacao}
                    disabled={preview.total_rotas_match === 0}>
                    Confirmar e Importar ({preview.total_rotas_match} rotas)
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ETAPA 3: Enviando */}
          {etapa === 'enviando' && (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div style={{ fontSize: 18, marginBottom: 8 }}>⏳ Importando paradas...</div>
              <div style={{ fontSize: 13, color: 'var(--text3)' }}>
                Pode levar alguns segundos para planilhas grandes.
              </div>
            </div>
          )}

          {/* ETAPA 4: Resultado */}
          {etapa === 'resultado' && resultado && (
            <div>
              <div style={{ background: '#f0fdf4', border: '1px solid #86efac',
                borderRadius: 6, padding: 16, marginBottom: 12 }}>
                <h3 style={{ margin: '0 0 8px 0', color: '#15803d' }}>✅ Importação concluída</h3>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
                  <li><strong>{resultado.rotas_importadas}</strong> rota(s) importada(s)</li>
                  <li><strong>{resultado.rotas_ignoradas}</strong> rota(s) ignorada(s) (sem OT)</li>
                  <li><strong>{resultado.paradas_criadas}</strong> parada(s) criada(s)</li>
                  <li><strong>{resultado.paradas_atualizadas}</strong> parada(s) atualizada(s)</li>
                </ul>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button className="btn btn-primary" onClick={fechar}>Fechar</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Step({ ativo, concluido, children }) {
  return (
    <div style={{
      flex: 1, padding: '6px 12px', borderRadius: 4,
      background: concluido ? '#16a34a' : ativo ? '#2563eb' : 'var(--bg2)',
      color: (concluido || ativo) ? '#fff' : 'var(--text2)',
      textAlign: 'center', fontWeight: ativo ? 600 : 400,
    }}>
      {concluido && '✓ '}{children}
    </div>
  );
}

function Stat({ label, valor, cor }) {
  return (
    <div style={{
      flex: '1 1 110px', background: 'var(--bg2)', padding: 10,
      borderRadius: 6, border: '1px solid var(--border)'
    }}>
      <div style={{ fontSize: 11, color: 'var(--text3)' }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 600, color: cor || 'var(--text)' }}>{valor}</div>
    </div>
  );
}

const th = { padding: '8px 10px', textAlign: 'left', fontWeight: 600, fontSize: 11, color: 'var(--text2)' };
const td = { padding: '6px 10px' };

function fmtDataBR(s) {
  if (!s) return '—';
  const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : s;
}
