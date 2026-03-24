// Utilitário de export Excel usando SheetJS (carregado via CDN no index.html)
// Uso: exportExcel(dados, colunas, nomeArquivo)

export function exportExcel(rows, colunas, nomeArquivo = 'export') {
  if (!window.XLSX) {
    alert('Biblioteca de Excel não carregada. Recarregue a página.');
    return;
  }

  // Monta cabeçalho e linhas
  const header = colunas.map(c => c.label);
  const data = rows.map(row =>
    colunas.map(c => {
      const val = c.key.split('.').reduce((o, k) => o?.[k], row);
      if (c.format) return c.format(val, row);
      return val ?? '';
    })
  );

  const ws = window.XLSX.utils.aoa_to_sheet([header, ...data]);

  // Largura automática das colunas
  ws['!cols'] = colunas.map(c => ({ wch: Math.max(c.label.length, 14) }));

  // Estilo do cabeçalho (negrito)
  const range = window.XLSX.utils.decode_range(ws['!ref']);
  for (let C = range.s.c; C <= range.e.c; C++) {
    const addr = window.XLSX.utils.encode_cell({ r: 0, c: C });
    if (!ws[addr]) continue;
    ws[addr].s = { font: { bold: true }, fill: { fgColor: { rgb: '1E3A5F' } } };
  }

  const wb = window.XLSX.utils.book_new();
  window.XLSX.utils.book_append_sheet(wb, ws, 'Dados');
  window.XLSX.writeFile(wb, `${nomeArquivo}_${new Date().toLocaleDateString('pt-BR').replace(/\//g,'-')}.xlsx`);
}

// Definições de colunas por módulo
export const COLUNAS = {
  ordens: [
    { key: 'data',          label: 'Data',       format: v => v ? new Date(v+'T12:00:00').toLocaleDateString('pt-BR') : '' },
    { key: 'numero_rota',   label: 'Rota' },
    { key: 'seq',           label: 'Seq.' },
    { key: 'cliente_nome',  label: 'Cliente' },
    { key: 'motorista_nome',label: 'Motorista' },
    { key: 'veiculo_tipo',  label: 'Veículo' },
    { key: 'placa',         label: 'Placa' },
    { key: 'regiao',        label: 'Região' },
    { key: 'peso',          label: 'Peso (kg)',  format: v => v ? Number(v).toLocaleString('pt-BR') : '' },
    { key: 'nf',            label: 'NF' },
    { key: 'remessa',       label: 'Remessa' },
    { key: 'status',        label: 'Status' },
    { key: 'tipo',          label: 'Tipo' },
    { key: 'ajuda_diesel',  label: 'Ajuda Diesel', format: v => v ? `R$ ${Number(v).toFixed(2)}` : '' },
    { key: 'taxa_descarga', label: 'Taxa Descarga',format: v => v ? `R$ ${Number(v).toFixed(2)}` : '' },
    { key: 'obs',           label: 'Observações' },
  ],

  clientes: [
    { key: 'nome',       label: 'Nome' },
    { key: 'tipo_doc',   label: 'Tipo Doc.' },
    { key: 'documento',  label: 'Documento' },
    { key: 'telefone',   label: 'Telefone' },
    { key: 'email',      label: 'E-mail' },
    { key: 'contato',    label: 'Contato' },
    { key: 'cidade',     label: 'Cidade' },
    { key: 'estado',     label: 'Estado' },
    { key: 'logradouro', label: 'Endereço' },
    { key: 'numero',     label: 'Número' },
    { key: 'bairro',     label: 'Bairro' },
    { key: 'cep',        label: 'CEP' },
  ],

  contas_receber: [
    { key: 'cliente',        label: 'Cliente' },
    { key: 'regiao',         label: 'Região' },
    { key: 'valor',          label: 'Valor (R$)',    format: v => v ? Number(v).toFixed(2) : '' },
    { key: 'vencimento',     label: 'Vencimento',   format: v => v ? new Date(v+'T12:00:00').toLocaleDateString('pt-BR') : '' },
    { key: 'data_pagamento', label: 'Dt. Pagamento',format: v => v ? new Date(v+'T12:00:00').toLocaleDateString('pt-BR') : '' },
    { key: 'status',         label: 'Status' },
    { key: 'obs',            label: 'Observações' },
  ],

  contas_pagar: [
    { key: 'transportadora_nome', label: 'Transportadora' },
    { key: 'motorista_nome',      label: 'Motorista' },
    { key: 'regiao',              label: 'Região' },
    { key: 'valor',               label: 'Valor (R$)',    format: v => v ? Number(v).toFixed(2) : '' },
    { key: 'vencimento',          label: 'Vencimento',   format: v => v ? new Date(v+'T12:00:00').toLocaleDateString('pt-BR') : '' },
    { key: 'data_pagamento',      label: 'Dt. Pagamento',format: v => v ? new Date(v+'T12:00:00').toLocaleDateString('pt-BR') : '' },
    { key: 'status',              label: 'Status' },
  ],

  manutencoes: [
    { key: 'data_manutencao',  label: 'Data',        format: v => v ? new Date(v+'T12:00:00').toLocaleDateString('pt-BR') : '' },
    { key: 'placa',            label: 'Placa' },
    { key: 'modelo',           label: 'Modelo' },
    { key: 'tipo_manutencao',  label: 'Tipo' },
    { key: 'componente',       label: 'Componente' },
    { key: 'descricao',        label: 'Descrição' },
    { key: 'valor_orcamento',  label: 'Valor (R$)',  format: v => v ? Number(v).toFixed(2) : '' },
    { key: 'aprovado_por',     label: 'Aprovado por' },
  ],

  multas: [
    { key: 'data_infracao',      label: 'Data',       format: v => v ? new Date(v+'T12:00:00').toLocaleDateString('pt-BR') : '' },
    { key: 'placa',              label: 'Placa' },
    { key: 'modelo',             label: 'Modelo' },
    { key: 'motorista_nome',     label: 'Motorista' },
    { key: 'valor',              label: 'Valor (R$)', format: v => v ? Number(v).toFixed(2) : '' },
    { key: 'motorista_indicado', label: 'Indicado',   format: v => v ? 'Sim' : 'Não' },
    { key: 'cabe_recurso',       label: 'Recurso',    format: v => v ? 'Sim' : 'Não' },
    { key: 'descricao',          label: 'Descrição' },
  ],

  relatorios_faturamento: [
    { key: 'veiculo_tipo',    label: 'Veículo' },
    { key: 'total_rotas',     label: 'Rotas' },
    { key: 'total_entregas',  label: 'Entregas' },
    { key: 'entregas_ok',     label: 'Entregues' },
    { key: 'devolucoes',      label: 'Devoluções' },
    { key: 'valor_receber',   label: 'Faturado (R$)',format: v => v ? Number(v).toFixed(2) : '' },
    { key: 'valor_pagar',     label: 'A Pagar (R$)', format: v => v ? Number(v).toFixed(2) : '' },
    { key: 'margem',          label: 'Margem (R$)',  format: v => v ? Number(v).toFixed(2) : '' },
  ],
};
