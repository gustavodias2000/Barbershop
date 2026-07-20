/**
 * Utilitários de formatação de data compartilhados entre telas.
 */

/**
 * Formata uma data (Firestore Timestamp ou Date) para dd/mm/aaaa
 */
export const formatDate = (date) => {
  if (!date) return 'Data não disponível';
  try {
    const dateObj = date.toDate ? date.toDate() : new Date(date);
    if (isNaN(dateObj.getTime())) return 'Data inválida';
    return dateObj.toLocaleDateString('pt-BR');
  } catch {
    return 'Data inválida';
  }
};

/**
 * Formata uma data com hora: dd/mm/aaaa às HH:mm
 */
export const formatDateTime = (date) => {
  if (!date) return 'Data não disponível';
  try {
    const dateObj = date.toDate ? date.toDate() : new Date(date);
    if (isNaN(dateObj.getTime())) return 'Data inválida';
    const datePart = dateObj.toLocaleDateString('pt-BR');
    const timePart = dateObj.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });
    return `${datePart} às ${timePart}`;
  } catch {
    return 'Data inválida';
  }
};

/**
 * Retorna os próximos N dias úteis (sem domingos), com display formatado.
 * @param {number} qtd - Quantidade de dias (padrão 7)
 */
export const getNextDays = (qtd = 7) => {
  const days = [];
  const today = new Date();
  let count = 0;
  let i = 0;

  while (count < qtd) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    i++;
    // Pular domingos (0 = domingo)
    if (date.getDay() === 0) continue;
    days.push({
      date: date.toISOString().split('T')[0],
      display: date.toLocaleDateString('pt-BR', {
        weekday: 'short',
        day: '2-digit',
        month: '2-digit',
      }),
    });
    count++;
  }
  return days;
};

/**
 * Formata número de telefone para padrão internacional brasileiro
 * @param {string} phone - Telefone raw (com ou sem formatação)
 * @returns {string} Telefone no formato 5511999999999
 */
export const formatPhoneToE164 = (phone) => {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('55') && digits.length >= 12) return digits;
  if (digits.length === 11) return `55${digits}`;
  if (digits.length === 10) return `55${digits}`;
  return digits;
};

/**
 * Mascara visual de telefone: (11) 99999-9999
 */
export const maskPhone = (value) => {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
};
