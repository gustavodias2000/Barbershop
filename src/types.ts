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
  /**
   * Turno extra opcional (ex.: período noturno), além do horário principal
   * (horaInicio–horaFim). Gera slots adicionais nesse segundo bloco, sem
   * intervalo de almoço aplicado a ele.
   */
  turnoExtraAtivo?: boolean;
  turnoExtraInicio?: string;    // "19:00"
  turnoExtraFim?: string;       // "21:00"
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

// ─── Agenda de clientes do barbeiro (cadastro manual/importado) ──────────────

/**
 * Contato de cliente cadastrado pelo barbeiro (manualmente ou importado da
 * agenda do telefone). Independente de `Usuario` — não exige que o cliente
 * tenha conta no app. Serve como base para futuro agendamento manual.
 */
export interface ClienteContato {
  id: string;
  nome: string;
  telefone?: string;
  origem: 'manual' | 'contatos';
  createdAt?: FirestoreDate;
}

// ─── Negócio / equipe multi-profissional ──────────────────────────────────────

/**
 * Um negócio agrupa vários profissionais (Barbeiro) sob um dono único.
 * Opcional: barbeiros solo (sem equipe) nunca têm `negocioId` e continuam
 * funcionando exatamente como antes.
 */
export interface Negocio {
  id: string;
  donoUid: string;
  nome: string;
  endereco?: string;
  createdAt?: FirestoreDate;
  updatedAt?: FirestoreDate;
}

export type PapelEquipe = 'dono' | 'profissional';
export type TipoComissao = 'percentual' | 'fixo';

/**
 * Membro da equipe de um negócio — dado privado (nunca exposto na vitrine
 * pública do barbeiro). Guarda o papel e a configuração de comissão.
 * O id do documento é sempre igual ao `barbeiroId`.
 */
export interface MembroEquipe {
  id: string;
  barbeiroId: string;
  papel: PapelEquipe;
  ativo: boolean;
  comissaoTipo?: TipoComissao;
  /** 0–100, usado quando comissaoTipo === 'percentual' */
  comissaoPercentual?: number;
  /** Em centavos, usado quando comissaoTipo === 'fixo' */
  comissaoFixaCentavos?: number;
  createdAt?: FirestoreDate;
  updatedAt?: FirestoreDate;
}

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
  /**
   * Endereço formatado pelo Google Places (quando o barbeiro escolheu uma
   * sugestão do autocomplete, em vez de digitar o endereço livremente).
   */
  enderecoFormatado?: string;
  /** Coordenadas do endereço (Google Places), usadas para um pino preciso no mapa. */
  latitude?: number;
  longitude?: number;
  /** Datas em que o barbeiro não atende (formato YYYY-MM-DD) — folgas, férias, feriados */
  datasBloqueadas?: DataISO[];
  /**
   * Presente quando este profissional faz parte de uma equipe (negócio).
   * Ausente = profissional solo, comportamento idêntico ao de sempre.
   */
  negocioId?: string;
  /**
   * Nome do negócio, denormalizado para a vitrine do cliente poder agrupar
   * profissionais da mesma equipe sem precisar ler `negocios/{id}` (coleção
   * privada, só o dono tem acesso).
   */
  negocioNome?: string;
  /**
   * Visibilidade na vitrine para membros de equipe (ausente/true = visível).
   * Espelha `MembroEquipe.ativo`, mas fica no doc público porque a vitrine
   * do cliente não tem acesso à subcoleção privada de membros do negócio.
   */
  ativo?: boolean;
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
  /** Denormalizado do Barbeiro no momento da criação — usado nas regras de
   * segurança (dono do negócio pode ver/gerenciar) e no relatório de comissões. */
  negocioId?: string;
  /** Comissão calculada (centavos) quando o agendamento é concluído, se o
   * profissional pertence a uma equipe com comissão configurada. */
  comissaoCentavos?: number;
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
  // profissionalId presente = dono editando um membro da equipe;
  // ausente = usuário logado editando o próprio perfil (comportamento de sempre).
  ConfigAgenda: { profissionalId?: string; profissionalNome?: string } | undefined;
  Folgas: { profissionalId?: string; profissionalNome?: string } | undefined;
  ConfigServicos: { profissionalId?: string; profissionalNome?: string } | undefined;
  SetupBarbeiro: undefined;
  Clientes: undefined;
  Equipe: undefined;
  EditarProfissional: { profissionalId?: string } | undefined;
  Comissoes: undefined;
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
