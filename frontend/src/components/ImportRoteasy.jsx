import { useState, useRef } from 'react';
import { api } from '../lib/api';
import { Field, Input } from './UI';

/**
 * Importa relatório de serviços do Roteasy para Ordens de Transporte.
 *
 * Fluxo: upload → parse cliente-side → preview do servidor (lookups) → confirmar.
 * Backend faz UPSERT por remessa, auto-cria clientes e gera CAP/CAR consolidado por rota.
 */
export default function ImportRoteasy({ open, onClose, onSuccess }) {
  const [etapa, setEtapa] = useState('upload'); // upload | preview | enviando | resultado
  const [arquivo, setArquivo] = useState(null);
  const [dataRota, setDataRota] = useState('');
  const [parsedRotas, setParsedRotas] = useState(null); // estrutura JSON pronta para backend
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

  // ── Parser do Roteasy ────────────────────────────────────
  // Lê o arquivo .xlsx, transforma em estrutura { data, rotas: [{ ..., paradas: [...] }] }
  async function parseFile(file) {
    if (!window.XLSX) {
      throw new Error('Biblioteca XLSX não carregada. Recarregue a página.');
    }
    const buffer = await file.arrayBuffer();
    const wb = window.XLSX.read(buffer, { type: 'array', cellDates: false });

    // Tentar a aba "Relatório de Serviços", senão a primeira
    const sheetName = wb.SheetNames.find(n => /servi[çc]o/i.test(n)) || wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];
    const linhas = window.XLSX.utils.sheet_to_json(ws, { defval: null, raw: true });

    if (!linhas.length) throw new Error('Planilha vazia.');

    // Detectar coluna de data (ex: "25/04/2026")
    const primeiraData = linhas.find(l => l['Data da Rota'])?.['Data da Rota'];
    const dataDetectada = converterDataBR(primeiraData);

    // Agrupar por rota (campo "Nome" do Roteasy)
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

      // Linha "Saida" = cabeçalho da rota
      if (evento === 'saida' || evento === 'saída') {
        rota.placa = l['Placa do veículo'] || null;
        rota.operador = l['Operador'] || null;
        rota.transportadora = l['Transportadora'] || null;
        rota.tipo_veiculo = l['Veiculo'] || null;
        continue;
      }

      // Linha "Serviço" = parada
      if (evento === 'serviço' || evento === 'servico') {
        // Atualiza dados da rota (caso "Saida" venha depois ou não exista)
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
          obs: [l['Observações'], l['Informação Adicional 1']].filter(Boolean).join(' | ') || null,
        });
      }
    }

    return {
      data: dataDetectada,
      rotas: Array.from(mapaRotas.values()).filter(r => r.paradas.length > 0),
    };
  }

  function converterDataBR(s) {
    // "25/04/2026" → "2026-04-25"
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
      const payload = { data: dataRota, rotas: parsedRotas.rotas, origem: 'roteasy' };
      const data = await api.post('/ordens/importar', payload);
      setResultado(data);
      setEtapa('resultado');
      onSuccess?.(data);
    } catch (err) {
      setErro(`Erro ao importar: ${err.message}`);
      setEtapa('preview');
    }
  }

  // ── UI ─────────────────────────────────────────────────────
  return (
    <div className="modal-backdrop" onClick={fechar}>
      <div className="modal" style={{ maxWidth: 920 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>📥 Importar Planilha Roteasy</h2>
          <button className="modal-close" onClick={fechar}>×</button>
        </div>

        <div className="modal-body">
          {/* Stepper */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, fontSize: 12 }}>
            <Step ativo={etapa === 'upload'} concluido={etapa !== 'upload'}>1. Upload</Step>
            <Step ativo={etapa === 'preview'} concluido={etapa === 'enviando' || etapa === 'resultado'}>2. Pré-visualização</Step>
            <Step ativo={etapa === 'enviando' || etapa === 'resultado'} concluido={etapa === 'resultado'}>3. Importar</Step>
          </div>

          {erro && (
            <div style={{
              background: '#fee', border: '1px solid #fcc', color: '#900',
              padding: 10, borderRadius: 6, marginBottom: 12, fontSize: 13
            }}>
              ⚠️ {erro}
            </div>
          )}

          {/* ETAPA 1: Upload */}
          {etapa === 'upload' && (
            <div>
              <p style={{ color: 'var(--text2)', fontSize: 13, marginBottom: 12 }}>
                Faça upload do <strong>Relatório de Serviços</strong> exportado do Roteasy (.xlsx).
                O sistema irá agrupar as entregas por rota e gerar OTs com Romaneio automaticamente.
              </p>

              <Field label="Arquivo (.xlsx)">
                <input
                  type="file"
                  ref={inputRef}
                  accept=".xlsx,.xlsm,.xls"
                  onChange={handleFile}
                  style={{ width: '100%', padding: 8 }}
                />
              </Field>

              {parsedRotas && (
                <>
                  <div style={{
                    background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 6,
                    padding: 12, marginTop: 12, fontSize: 13
                  }}>
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
                <button
                  className="btn btn-primary"
                  onClick={gerarPreview}
                  disabled={!parsedRotas || !dataRota}
                >
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
                <Stat label="Rotas" valor={preview.total_rotas} />
                <Stat label="Entregas" valor={preview.total_paradas} />
                <Stat
                  label="Alertas"
                  valor={preview.alertas?.length || 0}
                  cor={preview.alertas?.length ? '#f59e0b' : null}
                />
              </div>

              {preview.alertas?.length > 0 && (
                <div style={{
                  background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6,
                  padding: 12, marginBottom: 12, fontSize: 13
                }}>
                  <strong>⚠️ {preview.alertas.length} item(s) sem cadastro</strong>
                  <ul style={{ margin: '6px 0 0 18px', maxHeight: 100, overflow: 'auto' }}>
                    {preview.alertas.slice(0, 20).map((a, i) => (
                      <li key={i}>
                        Rota {a.rota}: {a.tipo === 'veiculo_nao_encontrado' ? 'Veículo' : 'Motorista'}
                        {' '}<code>{a.valor}</code> não cadastrado
                      </li>
                    ))}
                    {preview.alertas.length > 20 && <li>... e mais {preview.alertas.length - 20}</li>}
                  </ul>
                  <p style={{ marginTop: 8, marginBottom: 0, fontSize: 12, color: '#92400e' }}>
                    A importação prosseguirá deixando esses campos vazios. Você pode editá-los depois nas OTs.
                  </p>
                </div>
              )}

              <div style={{ maxHeight: 320, overflow: 'auto', border: '1px solid var(--border)', borderRadius: 6 }}>
                <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                  <thead style={{ background: 'var(--bg2)', position: 'sticky', top: 0 }}>
                    <tr>
                      <th style={th}>Rota</th>
                      <th style={th}>Veículo</th>
                      <th style={th}>Motorista</th>
                      <th style={th}>Transportadora</th>
                      <th style={{ ...th, textAlign: 'right' }}>Paradas</th>
                      <th style={{ ...th, textAlign: 'right' }}>Peso (kg)</th>
                      <th style={{ ...th, textAlign: 'right' }}>Novas / Atualiz.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rotas.map((r, i) => (
                      <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                        <td style={td}><strong>{r.numero_rota}</strong></td>
                        <td style={td}>
                          {r.veiculo_id
                            ? <span>{r.placa} <small style={{ color: 'var(--text3)' }}>({r.veiculo_tipo})</small></span>
                            : <span style={{ color: '#dc2626' }}>{r.placa || '—'} ⚠️</span>
                          }
                        </td>
                        <td style={td}>
                          {r.motorista_id
                            ? r.motorista_nome
                            : <span style={{ color: '#dc2626' }}>{r.operador || '—'} ⚠️</span>
                          }
                        </td>
                        <td style={td}>{r.transportadora_nome || '—'}</td>
                        <td style={{ ...td, textAlign: 'right' }}>{r.total_paradas}</td>
                        <td style={{ ...td, textAlign: 'right' }}>{r.peso_total.toFixed(1)}</td>
                        <td style={{ ...td, textAlign: 'right' }}>
                          <span style={{ color: '#16a34a' }}>+{r.remessas_para_criar}</span>
                          {r.remessas_para_atualizar > 0 && (
                            <> / <span style={{ color: '#2563eb' }}>↻{r.remessas_para_atualizar}</span></>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 16 }}>
                <button className="btn btn-ghost" onClick={() => setEtapa('upload')}>← Voltar</button>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-ghost" onClick={fechar}>Cancelar</button>
                  <button className="btn btn-primary" onClick={confirmarImportacao}>
                    Confirmar e Importar
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ETAPA 3: Enviando */}
          {etapa === 'enviando' && (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div style={{ fontSize: 18, marginBottom: 8 }}>⏳ Importando ordens...</div>
              <div style={{ fontSize: 13, color: 'var(--text3)' }}>
                Isso pode levar alguns segundos para planilhas grandes.
              </div>
            </div>
          )}

          {/* ETAPA 4: Resultado */}
          {etapa === 'resultado' && resultado && (
            <div>
              <div style={{
                background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 6,
                padding: 16, marginBottom: 12
              }}>
                <h3 style={{ margin: '0 0 8px 0', color: '#15803d' }}>✅ Importação concluída</h3>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
                  <li><strong>{resultado.criadas}</strong> ordens novas criadas</li>
                  <li><strong>{resultado.atualizadas}</strong> ordens atualizadas (UPSERT por remessa)</li>
                  <li><strong>{resultado.rotas_processadas}</strong> rotas processadas</li>
                  <li><strong>{resultado.cap_gerados}</strong> contas a pagar geradas</li>
                  <li><strong>{resultado.car_gerados}</strong> contas a receber geradas</li>
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

// ── Subcomponentes ─────────────────────────────────────────
function Step({ ativo, concluido, children }) {
  return (
    <div style={{
      flex: 1,
      padding: '6px 12px',
      borderRadius: 4,
      background: concluido ? '#16a34a' : ativo ? '#2563eb' : 'var(--bg2)',
      color: (concluido || ativo) ? '#fff' : 'var(--text2)',
      textAlign: 'center',
      fontWeight: ativo ? 600 : 400,
    }}>
      {concluido && '✓ '}{children}
    </div>
  );
}

function Stat({ label, valor, cor }) {
  return (
    <div style={{
      flex: '1 1 120px',
      background: 'var(--bg2)',
      padding: 10,
      borderRadius: 6,
      border: '1px solid var(--border)'
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
