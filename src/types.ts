/**
 * Tipos de domínio do Barbershop (item 16 da auditoria — migração TS).
 *
 * Fonte única de verdade para os modelos que circulam entre telas,
 * repositories e Firestore.
 */
import type { Timestamp, FieldValue } from 'firebase/firestore';

// ─── Primitivos de domínio ───────────────────────────────────────────────────

export type TipoUsuario = 'cliente' | 'barbeiro';

// ─── Serviços do barbeiro ─────────────────────────────────────────────────────

export interface ServicoBarbeiro {
  id: string;
  nome: string;
  duracaoMinutos: number;   // Ex.: 30, 45, 60, 90
  precoEmCentavos: number;  // Ex.: 4500 = R$ 45,00
}

// ─── Configuração de agenda ───────────────────────────────────────────────────

export interface ConfiguracaoAgenda {
  horaInicio: string;           // "09:00"
  horaFim: string;              // "18:00"
  almocoInicio: string;         // "12:00" — "" desativa o almoço
  almocoFim: string;            // "13:00"
  antecedenciaMinutos: number;  // 0 = sem restrição, 30 = mínimo 30min de antecedência
  antecedenciaMaximaDias: number; // 7 a 120 dias à frente; 0 = sem limite
  diasAtendimento: number[];    // 0=dom, 1=seg, ..., 6=sab; ex.: [1,2,3,4,5,6]
  /** Intervalo de descanso/limpeza após cada atendimento (minutos). 0 = sem buffer. */
  intervaloAposAtendimentoMinutos?: number;
}

// ─── Templates de mensagem WhatsApp ──────────────────────────────────────────

export interface TemplatesMensagem {
  agendamento: string;    // Variáveis: {nome_barbeiro}, {nome_cliente}, {data}, {horario}, {servico}
  confirmacao: string;
  cancelamento: string;
  lembrete: string;
}

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

// ─── Clientes banidos ─────────────────────────────────────────────────────────

export interface ClienteBanido {
  uid: string;
  nome: string;
  email: string;
  bannedAt?: FirestoreDate;
}

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
  /** Lista de serviços oferecidos com duração e preço */
  servicos?: ServicoBarbeiro[];
  /** Configuração de horários de atendimento */
  configuracaoAgenda?: ConfiguracaoAgenda;
  /** Templates de mensagens WhatsApp */
  templatesMensagem?: TemplatesMensagem;
  /** Lista de clientes banidos pelo barbeiro */
  clientesBanidos?: ClienteBanido[];
  /** Mensagem exibida ao cliente após confirmar o agendamento */
  mensagemPosAgendamento?: string;
  /** Endereço do estabelecimento (exibido na confirmação e usado no link do mapa) */
  endereco?: string;
  /** Datas em que o barbeiro não atende (formato YYYY-MM-DD) — folgas, férias, feriados */
  datasBloqueadas?: DataISO[];
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

// ─── Lista de espera ──────────────────────────────────────────────────────────

export interface EntradaListaEspera {
  id: string;
  barbeiroId: string;
  clienteUid: string;
  clienteNome: string;
  clienteEmail: string;
  clienteTelefone?: string;
  data: DataISO;       // data desejada
  servicoId?: string;
  servicoNome?: string;
  status: 'aguardando' | 'notificado' | 'agendado' | 'expirado';
  createdAt?: FirestoreDate;
}

// ─── Agendamentos recorrentes ─────────────────────────────────────────────────

export type FrequenciaRecorrencia = 'semanal' | 'quinzenal' | 'mensal';

export interface Recorrencia {
  id: string;
  barbeiroId: string;
  clienteUid: string;
  clienteNome: string;
  clienteEmail: string;
  clienteTelefone?: string;
  servicoId: string;
  servicoNome: string;
  precoEmCentavos: number;
  diaSemana: number;         // 0=dom ... 6=sab
  horario: Horario;          // "09:00"
  frequencia: FrequenciaRecorrencia;
  ativo: boolean;
  ultimoAgendamento?: DataISO;
  createdAt?: FirestoreDate;
}

// ─── Navegação ───────────────────────────────────────────────────────────────

export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  Cliente: undefined;
  Barbeiro: undefined;
  Agendamento: { barbeiro: Barbeiro };
  AgendamentoConfirmado: {
    agendamento: NovoAgendamento & { id?: string };
    barbeiro: Barbeiro;
    whatsappEnviado: boolean;
    mensagemPosAgendamento?: string | null;
  };
  Historico: undefined;
  Perfil: undefined;
  Privacidade: undefined;
  // Telas de configuração do barbeiro
  ConfigAgenda: undefined;
  Folgas: undefined;
  ConfigServicos: undefined;
  TemplatesMensagem: undefined;
  ClientesBanidos: undefined;
  HistoricoCliente: { clienteUid: string; clienteNome: string; barbeiroId: string };
  QRCode: undefined;
  Suporte: undefined;
  ListaEspera: undefined;
  Recorrencias: undefined;
  CriarRecorrencia: {
    clienteUid: string;
    clienteNome: string;
    clienteEmail: string;
    clienteTelefone?: string;
    barbeiroId: string;
  };
  Onboarding: { tipo: 'cliente' | 'barbeiro' };
};
