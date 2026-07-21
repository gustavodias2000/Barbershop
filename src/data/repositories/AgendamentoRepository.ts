/**
 * AgendamentoRepository — único ponto de acesso à coleção `agendamentos`.
 *
 * Item 9.3 da auditoria: o cliente agora é identificado por `clienteUid`
 * (imutável) em vez de email. O email continua gravado no doc apenas para
 * exibição/contato.
 */
import { db } from '../../../firebaseConfig';
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  addDoc,
  doc,
  updateDoc,
  limit,
  serverTimestamp,
  type QueryConstraint,
} from 'firebase/firestore';
import type { Agendamento, NovoAgendamento, StatusAgendamento } from '../../types';

interface ListarClienteOpts {
  status?: StatusAgendamento | 'todos';
  max?: number;
}

const fromSnap = (d: { id: string; data: () => unknown }): Agendamento => ({
  ...(d.data() as Omit<Agendamento, 'id'>),
  id: d.id,
});

/**
 * Lista agendamentos do cliente logado (por uid, não por email).
 */
export async function listarDoCliente(
  clienteUid?: string | null,
  { status, max = 50 }: ListarClienteOpts = {},
): Promise<Agendamento[]> {
  if (!clienteUid) return [];
  const filtros: QueryConstraint[] = [
    where('clienteUid', '==', clienteUid),
    ...(status && status !== 'todos' ? [where('status', '==', status)] : []),
    orderBy('createdAt', 'desc'),
    limit(max),
  ];
  const snap = await getDocs(query(collection(db, 'agendamentos'), ...filtros));
  return snap.docs.map(fromSnap);
}

/**
 * Lista agendamentos do barbeiro logado.
 */
export async function listarDoBarbeiro(
  barbeiroId?: string | null,
  max: number = 50,
): Promise<Agendamento[]> {
  if (!barbeiroId) return [];
  const snap = await getDocs(
    query(
      collection(db, 'agendamentos'),
      where('barbeiroId', '==', barbeiroId),
      orderBy('createdAt', 'desc'),
      limit(max),
    ),
  );
  return snap.docs.map(fromSnap);
}

/**
 * Cria um novo agendamento. createdAt é sempre do servidor.
 * @returns id do documento criado
 */
export async function criarAgendamento(dados: NovoAgendamento): Promise<string> {
  const docRef = await addDoc(collection(db, 'agendamentos'), {
    ...dados,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

/**
 * Atualiza o status de um agendamento com carimbo de tempo do servidor.
 */
export async function atualizarStatus(
  id: string,
  status: Exclude<StatusAgendamento, 'pendente'>,
  extras: Record<string, unknown> = {},
): Promise<void> {
  const stampField: Record<Exclude<StatusAgendamento, 'pendente'>, string> = {
    confirmado: 'confirmedAt',
    cancelado: 'cancelledAt',
    concluido: 'concludedAt',
    avaliado: 'ratedAt',
  };

  await updateDoc(doc(db, 'agendamentos', id), {
    status,
    [stampField[status]]: serverTimestamp(),
    ...extras,
  });
}
