/**
 * AgendamentoRepository — único ponto de acesso à coleção `agendamentos`.
 *
 * Item 9.3 da auditoria: o cliente agora é identificado por `clienteUid`
 * (imutável) em vez de email. O email continua gravado no doc apenas para
 * exibição/contato.
 */
import { db } from '../../../firebase';
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
} from 'firebase/firestore';

/**
 * Lista agendamentos do cliente logado (por uid, não por email).
 * @param {string} clienteUid
 * @param {{ status?: string, max?: number }} opts
 */
export async function listarDoCliente(clienteUid, { status, max = 50 } = {}) {
  if (!clienteUid) return [];
  const filtros = [
    where('clienteUid', '==', clienteUid),
    ...(status && status !== 'todos' ? [where('status', '==', status)] : []),
    orderBy('createdAt', 'desc'),
    limit(max),
  ];
  const snap = await getDocs(query(collection(db, 'agendamentos'), ...filtros));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Lista agendamentos do barbeiro logado.
 */
export async function listarDoBarbeiro(barbeiroId, max = 50) {
  if (!barbeiroId) return [];
  const snap = await getDocs(
    query(
      collection(db, 'agendamentos'),
      where('barbeiroId', '==', barbeiroId),
      orderBy('createdAt', 'desc'),
      limit(max),
    ),
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Cria um novo agendamento. createdAt é sempre do servidor.
 */
export async function criarAgendamento(dados) {
  const docRef = await addDoc(collection(db, 'agendamentos'), {
    ...dados,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

/**
 * Atualiza o status de um agendamento com carimbo de tempo do servidor.
 * @param {string} id
 * @param {'confirmado'|'cancelado'|'concluido'|'avaliado'} status
 * @param {object} extras — campos adicionais (ex.: cancelledBy)
 */
export async function atualizarStatus(id, status, extras = {}) {
  const stampField = {
    confirmado: 'confirmedAt',
    cancelado: 'cancelledAt',
    concluido: 'concludedAt',
    avaliado: 'ratedAt',
  }[status];

  await updateDoc(doc(db, 'agendamentos', id), {
    status,
    ...(stampField ? { [stampField]: serverTimestamp() } : {}),
    ...extras,
  });
}
