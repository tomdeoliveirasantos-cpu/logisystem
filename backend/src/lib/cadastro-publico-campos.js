// backend/src/lib/cadastro-publico-campos.js
// Catálogo central dos campos do cadastro público de colaborador.
// Compartilhado entre:
//   - Backend (rota de parâmetros + validação no POST do convite)
//   - Frontend admin (tela de parâmetros)
//   - Frontend público (form dinâmico)

const CAMPOS = [
  // Passo 0: Dados Pessoais
  { chave: 'tipo_colaborador', label: 'Tipo de Colaborador',  passo: 0, grupo: 'Dados Pessoais', default: 'obrigatorio', fixo: true  },
  { chave: 'nome',             label: 'Nome Completo',        passo: 0, grupo: 'Dados Pessoais', default: 'obrigatorio', fixo: true  },
  { chave: 'cpf',              label: 'CPF',                  passo: 0, grupo: 'Dados Pessoais', default: 'obrigatorio', fixo: true  },
  { chave: 'rg',               label: 'RG',                   passo: 0, grupo: 'Dados Pessoais', default: 'obrigatorio' },
  { chave: 'cnh_numero',       label: 'Nº CNH',               passo: 0, grupo: 'Dados Pessoais', default: 'opcional' },
  { chave: 'cnh_categoria',    label: 'Categoria CNH',        passo: 0, grupo: 'Dados Pessoais', default: 'opcional' },
  { chave: 'cnh_validade',     label: 'Validade CNH',         passo: 0, grupo: 'Dados Pessoais', default: 'opcional' },
  { chave: 'telefone',         label: 'Telefone',             passo: 0, grupo: 'Dados Pessoais', default: 'obrigatorio' },
  { chave: 'email',            label: 'Email',                passo: 0, grupo: 'Dados Pessoais', default: 'opcional' },
  { chave: 'cep',              label: 'CEP',                  passo: 0, grupo: 'Endereço Residencial', default: 'opcional' },
  { chave: 'estado',           label: 'Estado',               passo: 0, grupo: 'Endereço Residencial', default: 'obrigatorio' },
  { chave: 'endereco',         label: 'Endereço',             passo: 0, grupo: 'Endereço Residencial', default: 'obrigatorio' },
  { chave: 'numero',           label: 'Número',               passo: 0, grupo: 'Endereço Residencial', default: 'obrigatorio' },
  { chave: 'complemento',      label: 'Complemento',          passo: 0, grupo: 'Endereço Residencial', default: 'opcional' },
  { chave: 'bairro',           label: 'Bairro',               passo: 0, grupo: 'Endereço Residencial', default: 'opcional' },
  { chave: 'cidade',           label: 'Cidade',               passo: 0, grupo: 'Endereço Residencial', default: 'obrigatorio' },

  // Passo 1: Dados da Empresa (PJ)
  { chave: 'razao_social',     label: 'Razão Social',         passo: 1, grupo: 'Dados da Empresa', default: 'obrigatorio' },
  { chave: 'cnpj',             label: 'CNPJ',                 passo: 1, grupo: 'Dados da Empresa', default: 'obrigatorio' },
  { chave: 'data_abertura',    label: 'Data de Abertura',     passo: 1, grupo: 'Dados da Empresa', default: 'obrigatorio' },
  { chave: 'cep_pj',           label: 'CEP PJ',               passo: 1, grupo: 'Endereço PJ',     default: 'opcional' },
  { chave: 'estado_pj',        label: 'Estado PJ',            passo: 1, grupo: 'Endereço PJ',     default: 'obrigatorio' },
  { chave: 'endereco_pj',      label: 'Endereço PJ',          passo: 1, grupo: 'Endereço PJ',     default: 'obrigatorio' },
  { chave: 'numero_pj',        label: 'Número PJ',            passo: 1, grupo: 'Endereço PJ',     default: 'obrigatorio' },
  { chave: 'complemento_pj',   label: 'Complemento PJ',       passo: 1, grupo: 'Endereço PJ',     default: 'opcional' },
  { chave: 'bairro_pj',        label: 'Bairro PJ',            passo: 1, grupo: 'Endereço PJ',     default: 'opcional' },
  { chave: 'cidade_pj',        label: 'Cidade PJ',            passo: 1, grupo: 'Endereço PJ',     default: 'obrigatorio' },

  // Passo 2: Veículo
  { chave: 'veiculo_placa',    label: 'Placa',                passo: 2, grupo: 'Veículo', default: 'opcional' },
  { chave: 'veiculo_modelo',   label: 'Modelo',               passo: 2, grupo: 'Veículo', default: 'opcional' },
  { chave: 'veiculo_ano',      label: 'Ano',                  passo: 2, grupo: 'Veículo', default: 'opcional' },
  { chave: 'veiculo_rntrc',    label: 'RNTRC (ANTT)',         passo: 2, grupo: 'Veículo', default: 'opcional' },

  // Passo 3: Dados Bancários
  { chave: 'banco',            label: 'Banco',                passo: 3, grupo: 'Dados Bancários', default: 'obrigatorio' },
  { chave: 'agencia',          label: 'Agência',              passo: 3, grupo: 'Dados Bancários', default: 'opcional' },
  { chave: 'conta',            label: 'Conta',                passo: 3, grupo: 'Dados Bancários', default: 'opcional' },
  { chave: 'tipo_conta',       label: 'Tipo de Conta',        passo: 3, grupo: 'Dados Bancários', default: 'opcional' },
  { chave: 'pix',              label: 'Chave PIX',            passo: 3, grupo: 'Dados Bancários', default: 'obrigatorio' },

  // Passo 4: Documentos (uploads)
  { chave: 'doc_cnh',                  label: 'Anexo CNH (frente e verso)',        passo: 4, grupo: 'Documentos', default: 'opcional', tipo: 'arquivo' },
  { chave: 'doc_cnpj_contrato_social', label: 'Anexo Cartão CNPJ / Contrato Social', passo: 4, grupo: 'Documentos', default: 'opcional', tipo: 'arquivo' },
  { chave: 'doc_rntrc',                label: 'Anexo RNTRC (ANTT)',                 passo: 4, grupo: 'Documentos', default: 'opcional', tipo: 'arquivo' },
  { chave: 'doc_comprovante_endereco', label: 'Anexo Comprovante de Endereço',      passo: 4, grupo: 'Documentos', default: 'opcional', tipo: 'arquivo' },
];

const PASSOS = [
  { id: 0, titulo: 'Dados Pessoais' },
  { id: 1, titulo: 'Dados da Empresa' },
  { id: 2, titulo: 'Veículo' },
  { id: 3, titulo: 'Dados Bancários' },
  { id: 4, titulo: 'Documentos e Contrato' },
];

const VALORES_VALIDOS = ['obrigatorio', 'opcional', 'oculto'];

// Mescla os parametros salvos (parcial) com os defaults do catálogo
function mergeComDefaults(parametrosSalvos = {}) {
  const result = {};
  for (const c of CAMPOS) {
    // Campos "fixos" sempre obrigatórios (não dá pra esconder ou tornar opcional)
    if (c.fixo) {
      result[c.chave] = 'obrigatorio';
      continue;
    }
    const v = parametrosSalvos[c.chave];
    result[c.chave] = VALORES_VALIDOS.includes(v) ? v : c.default;
  }
  return result;
}

// Sanitiza um payload de update — descarta chaves desconhecidas, força fixos
function sanitizar(parametros = {}) {
  const result = {};
  for (const c of CAMPOS) {
    if (c.fixo) continue; // Não deixa alterar fixos
    const v = parametros[c.chave];
    if (VALORES_VALIDOS.includes(v)) result[c.chave] = v;
  }
  return result;
}

module.exports = { CAMPOS, PASSOS, VALORES_VALIDOS, mergeComDefaults, sanitizar };
