/**
 * Utilitários de formatação de data e moeda compartilhados entre telas.
 */
import type { Timestamp, FieldValue } from 'firebase/firestore';

/** Valor de data aceito pelos formatadores: Timestamp do Firestore, Date ou string */
type DateLike = Timestamp | FieldValue | Date | string | number | null | undefined;

interface ComPreco {
  precoEmCentavos?: number;
  preco?: string;
}

// ─── Moeda ────────────────────────────────────────────────────────────────────

/**
 * Converte preço legado (string "25,00") ou número (reais) para centavos inteiros.
 */
export const precoParaCentavos = (preco?: string | number | null): number => {
  if (typeof preco === 'number') return Math.round(preco * 100);
  if (typeof preco === 'string') {
    return Math.round(parseFloat(preco.replace(',', '.') || '0') * 100);
  }
  return 2500; // fallback R$ 25,00
};

/**
 * Formata centavos para exibição em BRL.
 * Ex.: formatMoney(2500) → "R$ 25,00"
 */
export const formatMoney = (centavos?: number | null): string => {
  const value = typeof centavos === 'number' ? centavos / 100 : 0;
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

/**
 * Retorna o preço formatado de um documento barbeiro/agendamento.
 * Aceita tanto o campo novo (precoEmCentavos: int) quanto o legado (preco: string).
 */
export const formatPreco = (doc?: ComPreco | null): string => {
  if (doc?.precoEmCentavos != null) return formatMoney(doc.precoEmCentavos);
  if (doc?.preco) return `R$ ${doc.preco}`;
  return 'R$ 25,00';
};

// ─── Datas ────────────────────────────────────────────────────────────────────

const toDateObj = (date: DateLike): Date | null => {
  if (!date) return null;
  try {
    const dateObj =
      typeof (date as Timestamp).toDate === 'function'
        ? (date as Timestamp).toDate()
        : new Date(date as string | number | Date);
    return isNaN(dateObj.getTime()) ? null : dateObj;
  } catch {
    return null;
  }
};

/**
 * Formata uma data com hora: dd/mm/aaaa às HH:mm
 */
export const formatDateTime = (date: DateLike): string => {
  const dateObj = toDateObj(date);
  if (!dateObj) return date ? 'Data inválida' : 'Data não disponível';
  const datePart = dateObj.toLocaleDateString('pt-BR');
  const timePart = dateObj.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${datePart} às ${timePart}`;
};

/**
 * Formata uma Date em YYYY-MM-DD usando a data LOCAL (não UTC).
 * Evita o bug de timezone onde toISOString() pode retornar o dia anterior
 * em fusos negativos (ex.: BRT = UTC-3).
 */
export const toLocalDateString = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

// ─── Telefone ─────────────────────────────────────────────────────────────────

/**
 * Formata número de telefone para padrão internacional brasileiro
 * @returns Telefone no formato 5511999999999
 */
export const formatPhoneToE164 = (phone?: string | null): string => {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('55') && digits.length >= 12) return digits;
  if (digits.length === 11) return `55${digits}`;
  if (digits.length === 10) return `55${digits}`;
  return digits;
};

/**
 * Máscara visual de telefone: (11) 99999-9999
 */
export const maskPhone = (value: string): string => {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
};
