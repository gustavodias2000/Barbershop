/**
 * Utilitários de status de agendamento.
 * Fonte única da verdade para labels e cores de status —
 * elimina a duplicação em ClienteHome, BarbeiroHome e HistoricoScreen.
 */

export const STATUS_MAP = {
  pendente:   { label: 'Pendente',   color: '#e07b00' }, // contraste 3.1:1 (UI component)
  confirmado: { label: 'Confirmado', color: '#27ae60' },
  concluido:  { label: 'Concluído',  color: '#8e44ad' },
  cancelado:  { label: 'Cancelado',  color: '#c0392b' }, // um pouco mais escuro que #e74c3c
  avaliado:   { label: 'Avaliado',   color: '#2471a3' }, // um pouco mais escuro que #2980b9
};

/**
 * Retorna a cor de fundo do badge para um dado status.
 * @param {string} status
 * @returns {string} cor hex
 */
export const getStatusColor = (status) =>
  (STATUS_MAP[status] || STATUS_MAP.pendente).color;

/**
 * Retorna o texto de exibição do status em português.
 * @param {string} status
 * @returns {string}
 */
export const getStatusText = (status) =>
  (STATUS_MAP[status] || STATUS_MAP.pendente).label;
