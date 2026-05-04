import { useState } from 'react';
import { api } from '../lib/api';
import { Field, Input, Select } from './UI';

/**
 * Modal de pré-cadastro rápido (Supervisor de Rota).
 * Cria motorista ou veículo com status 'pendente_admin' usando endpoints reduzidos.
 *
 * Props:
 *  - tipo: 'motorista' | 'veiculo'
 *  - open: boolean
 *  - onClose: () => void
 *  - onSuccess: (criado) => void  // recebe o registro criado para auto-selecionar
 *  - transportadoras, veiculos: listas opcionais para preencher selects
 */
export default function PreCadastroModal({
  tipo, open, onClose, onSuccess,
  transportadoras = [],
}) {
  const [form, setForm] = useState({});
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  if (!open) return null;

  const isMotorista = tipo === 'motorista';
  const titulo = isMotorista ? '+ Novo Motorista (rápido)' : '+ Novo Veículo (rápido)';

  function fechar() {
    setForm({});
    setErro('');
    onClose?.();
  }

  async function salvar() {
    setErro('');
    if (isMotorista) {
      if (!form.nome?.trim()) { setErro('Nome é obrigatório'); return; }
    } else {
      if (!form.placa?.trim()) { setErro('Placa é obrigatória'); return; }
      if (!form.tipo) { setErro('Tipo é obrigatório'); return; }
      if (!form.ag_ft) { setErro('Frota (Agregado/Próprio) é obrigatória'); return; }
    }

    setSalvando(true);
    try {
      const endpoint = isMotorista ? '/motoristas/pre-cadastro' : '/veiculos/pre-cadastro';
      const criado = await api.post(endpoint, form);
      onSuccess?.(criado);
      fechar();
    } catch (e) {
      setErro(e.message || 'Erro ao cadastrar');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={fechar} style={{ zIndex: 2000 }}>
      <div className="modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{titulo}</h2>
          <button className="modal-close" onClick={fechar}>×</button>
        </div>

        <div className="modal-body">
          <div style={{
            background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6,
            padding: 10, fontSize: 12, marginBottom: 12, color: '#92400e'
          }}>
            ⚠️ Cadastro rápido. Será marcado como <strong>"pendente administrativo"</strong> até o admin completar.
          </div>

          {erro && (
            <div style={{
              background: '#fee', border: '1px solid #fcc', color: '#900',
              padding: 8, borderRadius: 6, marginBottom: 10, fontSize: 13
            }}>{erro}</div>
          )}

          {isMotorista ? (
            <>
              <Field label="Nome completo *">
                <Input
                  value={form.nome || ''}
                  onChange={e => setForm({ ...form, nome: e.target.value })}
                  placeholder="Ex: João da Silva"
                  autoFocus
                />
              </Field>
              <Field label="CNH">
                <Input value={form.cnh || ''} onChange={e => setForm({ ...form, cnh: e.target.value })} />
              </Field>
              <Field label="Telefone">
                <Input value={form.telefone || ''} onChange={e => setForm({ ...form, telefone: e.target.value })} />
              </Field>
            </>
          ) : (
            <>
              <Field label="Frota *">
                <Select
                  value={form.ag_ft || ''}
                  onChange={e => setForm({ ...form, ag_ft: e.target.value })}
                  options={[
                    { value: 'frota', label: '🏠 Próprio' },
                    { value: 'agregado', label: '🚛 Agregado' },
                  ]}
                  autoFocus
                />
              </Field>
              <Field label="Placa *">
                <Input
                  value={form.placa || ''}
                  onChange={e => setForm({ ...form, placa: e.target.value.toUpperCase() })}
                  placeholder="ABC1D23"
                  maxLength={8}
                />
              </Field>
              <Field label="Tipo *">
                <Select
                  value={form.tipo || ''}
                  onChange={e => setForm({ ...form, tipo: e.target.value })}
                  options={[
                    { value: 'HR', label: 'HR' },
                    { value: 'IVECO', label: 'IVECO' },
                    { value: '3/4', label: '3/4' },
                    { value: 'TOCO', label: 'TOCO' },
                    { value: 'TRUCK', label: 'TRUCK' },
                    { value: 'MASTER', label: 'MASTER' },
                    { value: 'SPRINTER', label: 'SPRINTER' },
                  ]}
                />
              </Field>
              {form.ag_ft === 'agregado' && (
                <Field label="Transportadora">
                  <Select
                    value={form.transportadora_id || ''}
                    onChange={e => setForm({ ...form, transportadora_id: e.target.value })}
                    options={[{ value: '', label: '— Nenhuma —' },
                      ...(transportadoras || []).map(t => ({ value: t.id, label: t.nome }))]}
                  />
                </Field>
              )}
            </>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={fechar}>Cancelar</button>
          <button className="btn btn-primary" onClick={salvar} disabled={salvando}>
            {salvando ? 'Salvando...' : 'Cadastrar'}
          </button>
        </div>
      </div>
    </div>
  );
}
