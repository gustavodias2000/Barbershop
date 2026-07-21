/**
 * Tipos de domínio do Barbershop (item 16 da auditoria — migração TS).
 *
 * Fonte única de verdade para os modelos que circulam entre telas,
 * repositories e Firestore.
 */
import type { Timestamp, FieldValue } from 'firebase/firestore';

// ─── Primitivos de domínio ───────────────────────────────────────────────────

export type TipoUsuario = 'cliente' | 'barbeiro';

export type StatusAgendamento =
  | 'pendente'
  | 'confirmado'
  | 'concluido'
  | 'cancelado'
  | 'avaliado';

/** Data no formato local YYYY-MM-DD (ex.: "2026-07-21") */
export type DataISO = string;

/** Horário no formato HH:mm (ex.: "09:30") */
export type Horario = string;

/** Campo de data vindo do Firestore: Timestamp ao ler, FieldValue ao gravar */
export type FirestoreDate = Timestamp | FieldValue;

// ─── Modelos ─────────────────────────────────────────────────────────────────

export interface Usuario {
  uid: string;
  nome: string;
  email: string;
  telefone: string;
  tipo: TipoUsuario;
  fcmToken?: string;
  consentimentoLGPD?: boolean;
  consentimentoEm?: FirestoreDate;
  createdAt?: FirestoreDate;
  updatedAt?: FirestoreDate;
}

export interface Barbeiro {
  /** id do documento == uid do barbeiro */
  id: string;
  uid?: string;
  nome: string;
  telefone?: string;
  especialidade?: string;
  /** Legado: preço como string "25,00" (mantido p/ compatibilidade) */
  preco?: string;
  /** Preferido: preço como inteiro em centavos (2500 = R$ 25,00) */
  precoEmCentavos?: number;
  createdAt?: FirestoreDate;
  updatedAt?: FirestoreDate;
}

export interface Agendamento {
  id: string;
  barbeiroId: string;
  barbeiroNome: string;
  barbeiroTelefone?: string;
  /** Email do cliente (apenas exibição/contato — identidade é clienteUid) */
  cliente: string;
  clienteUid: string;
  clienteNome: string;
  clienteTelefone?: string;
  status: StatusAgendamento;
  data: DataISO;
  horario: Horario;
  servico?: string;
  preco?: string;
  precoEmCentavos?: number;
  rating?: number;
  paymentMethod?: string;
  cancelledBy?: 'cliente' | 'barbeiro';
  createdAt?: FirestoreDate;
  confirmedAt?: FirestoreDate;
  cancelledAt?: FirestoreDate;
  concludedAt?: FirestoreDate;
  ratedAt?: FirestoreDate;
}

/** Dados de um novo agendamento antes de ganhar id/createdAt */
export type NovoAgendamento = Omit<Agendamento, 'id' | 'createdAt'>;

export interface Avaliacao {
  agendamentoId: string;
  barbeiroId: string;
  barbeiroNome: string;
  cliente: string;
  clienteNome?: string;
  rating: number;
  comment?: string;
  createdAt?: FirestoreDate;
}

// ─── Navegação ───────────────────────────────────────────────────────────────

export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  Cliente: undefined;
  Barbeiro: undefined;
  Agendamento: { barbeiro: Barbeiro };
  Historico: undefined;
  Payment: { agendamento: Agendamento };
  Perfil: undefined;
  Privacidade: undefined;
};
