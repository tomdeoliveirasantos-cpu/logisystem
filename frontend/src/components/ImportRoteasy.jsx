import { useState, useRef } from 'react';
import { api } from '../lib/api';
import { Field, Input } from './UI';

/**
 * Importa relatório de serviços do Roteasy.
 *
 * Novo modelo: a importação só PREENCHE PARADAS de OTs já existentes no dia.
 * Rotas da planilha sem OT correspondente são DESCARTADAS.
 *
 * Fluxo: upload → parse → preview (match por numero_rota) → confirmar.
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
  function fechar() { reset(); onClose?.(); }

  // ── Parser do Roteasy ────────────────────────────────────
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
          numero_rota: chave, placa: null, operador: null,
          transportadora: null, tipo_veiculo: null, regiao: null, paradas: [],
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
          latitude: l['Latitude'] || null,
          longitude: l['Longitude'] || null,
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
    if (!s) return '';
    const m = String(s).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!m) return '';
    return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErro(''); setArquivo(file);
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
    if (!parsedRotas || !dataRota) { setErro('Selecione um arquivo e confirme a data.'); return; }
    setErro('');
    try {
      const data = await api.post('/ordens/importar/preview', { data: dataRota, rotas: parsedRotas.rotas });
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
      const data = await api.post('/ordens/importar', { data: dataRota, rotas: parsedRotas.rotas });
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
          <h2>📥 Importar Planilha Roteasy</h2>
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

          {etapa === 'upload' && (
            <div>
              <div style={{
                background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 6,
                padding: 12, marginBottom: 14, fontSize: 13, color: '#075985'
              }}>
                ℹ️ <strong>Como funciona:</strong> a importação preenche as paradas de Ordens de Transporte
                já criadas no dia. Rotas da planilha que <strong>não tiverem OT correspondente serão ignoradas</strong> —
                cadastre as OTs antes de importar.
              </div>

              <Field label="Arquivo (.xlsx)">
                <input type="file" ref={inputRef} accept=".xlsx,.xlsm,.xls"
                  onChange={handleFile} style={{ width: '100%', padding: 8 }} />
              </Field>

              {parsedRotas && (
                <>
                  <div style={{
                    background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6,
                    padding: 12, marginTop: 12, fontSize: 13
                  }}>
                    ✅ Planilha lida:
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

          {etapa === 'preview' && preview && (
            <div>
              <div style={{ display: 'flex', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
                <Stat label="Data" valor={fmtDataBR(preview.data)} />
                <Stat label="Rotas planilha" valor={preview.total_rotas_planilha} />
                <Stat label="Com match (✓)" valor={preview.rotas_com_match} cor="#16a34a" />
                <Stat label="Sem match (✗)" valor={preview.rotas_sem_match}
                  cor={preview.rotas_sem_match > 0 ? '#dc2626' : null} />
                <Stat label="Paradas a importar" valor={preview.paradas_a_importar} />
              </div>

              {preview.com_match.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6, color: '#16a34a' }}>
                    ✓ {preview.com_match.length} rotas serão importadas
                  </div>
                  <div style={{ maxHeight: 200, overflow: 'auto', border: '1px solid var(--border)', borderRadius: 6 }}>
                    <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                      <thead style={{ background: 'var(--bg2)', position: 'sticky', top: 0 }}>
                        <tr>
                          <th style={th}>Rota</th>
                          <th style={th}>OT cadastrada</th>
                          <th style={{ ...th, textAlign: 'right' }}>Paradas planilha</th>
                          <th style={{ ...th, textAlign: 'right' }}>Paradas atuais</th>
                          <th style={{ ...th, textAlign: 'right' }}>Peso (kg)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.com_match.map((r, i) => (
                          <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                            <td style={td}><strong>{r.numero_rota}</strong></td>
                            <td style={td}>
                              <div style={{ fontSize: 11 }}>
                                {r.placa_cadastrada || '—'} {r.tipo_frota && <span style={{ color: 'var(--text3)' }}>({r.tipo_frota})</span>}
                              </div>
                              <div style={{ fontSize: 11, color: 'var(--text3)' }}>{r.motorista_cadastrado || '—'}</div>
                            </td>
                            <td style={{ ...td, textAlign: 'right' }}>{r.paradas_planilha}</td>
                            <td style={{ ...td, textAlign: 'right', color: r.paradas_atuais > 0 ? '#f59e0b' : 'var(--text3)' }}>
                              {r.paradas_atuais}{r.paradas_atuais > 0 && ' ↻'}
                            </td>
                            <td style={{ ...td, textAlign: 'right' }}>{r.peso_total.toFixed(1)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {preview.com_match.some(r => r.paradas_atuais > 0) && (
                    <div style={{ fontSize: 11, color: '#92400e', marginTop: 4 }}>
                      ↻ = OT já tem paradas; serão substituídas
                    </div>
                  )}
                </div>
              )}

              {preview.sem_match.length > 0 && (
                <div style={{
                  background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6,
                  padding: 12, marginBottom: 12, fontSize: 12
                }}>
                  <div style={{ fontWeight: 600, marginBottom: 6, color: '#991b1b' }}>
                    ✗ {preview.sem_match.length} rotas serão IGNORADAS (sem OT cadastrada)
                  </div>
                  <div style={{ maxHeight: 100, overflow: 'auto' }}>
                    {preview.sem_match.map((r, i) => (
                      <div key={i} style={{ padding: '3px 0', borderBottom: '1px solid #fecaca' }}>
                        Rota <strong>{r.numero_rota}</strong> — {r.placa || '?'} / {r.operador || '?'} ({r.paradas} paradas)
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop: 6, color: '#7f1d1d' }}>
                    ⚠️ Cadastre a OT correspondente antes de importar para incluir essas rotas.
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 16 }}>
                <button className="btn btn-ghost" onClick={() => setEtapa('upload')}>← Voltar</button>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-ghost" onClick={fechar}>Cancelar</button>
                  <button className="btn btn-primary" onClick={confirmarImportacao}
                    disabled={preview.rotas_com_match === 0}>
                    {preview.rotas_com_match === 0 ? 'Nada a importar' : `Importar ${preview.rotas_com_match} rotas`}
                  </button>
                </div>
              </div>
            </div>
          )}

          {etapa === 'enviando' && (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div style={{ fontSize: 18, marginBottom: 8 }}>⏳ Importando...</div>
              <div style={{ fontSize: 13, color: 'var(--text3)' }}>
                Substituindo paradas das OTs com match.
              </div>
            </div>
          )}

          {etapa === 'resultado' && resultado && (
            <div>
              <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 6,
                padding: 16, marginBottom: 12 }}>
                <h3 style={{ margin: '0 0 8px 0', color: '#15803d' }}>✅ Importação concluída</h3>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
                  <li><strong>{resultado.rotas_processadas}</strong> rotas processadas</li>
                  <li><strong>{resultado.paradas_inseridas}</strong> paradas inseridas/atualizadas</li>
                  {resultado.rotas_ignoradas > 0 && (
                    <li style={{ color: '#92400e' }}>
                      <strong>{resultado.rotas_ignoradas}</strong> rotas ignoradas (sem OT correspondente)
                    </li>
                  )}
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
      flex: '1 1 100px', background: 'var(--bg2)', padding: 10,
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
