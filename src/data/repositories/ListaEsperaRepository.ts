/**
 * ListaEsperaRepository — coleção `listaEspera`
 *
 * Armazena solicitações de clientes que querem agendar quando
 * não há horários disponíveis. Ao abrir um slot, o barbeiro
 * pode notificar o próximo da fila.
 */
import { db } from '../../../firebaseConfig';
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
  orderBy,
} from 'firebase/firestore';
import type { EntradaListaEspera } from '../../types';

/**
 * Adiciona o cliente à lista de espera para uma data com o barbeiro.
 */
export async function entrarNaFila(
  entrada: Omit<EntradaListaEspera, 'id' | 'createdAt' | 'status'>,
): Promise<string> {
  const ref = await addDoc(collection(db, 'listaEspera'), {
    ...entrada,
    status: 'aguardando',
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

/**
 * Lista todos os clientes em espera para um barbeiro (por data, mais antigos primeiro).
 */
export async function listarFilaDoBarbeiro(
  barbeiroId: string,
  data?: string,
): Promise<EntradaListaEspera[]> {
  const constraints: any[] = [where('barbeiroId', '==', barbeiroId)];
  if (data) constraints.push(where('data', '==', data));
  constraints.push(where('status', '==', 'aguardando'));
  constraints.push(orderBy('createdAt', 'asc'));

  const q = query(collection(db, 'listaEspera'), ...constraints);
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({
    ...(d.data() as Omit<EntradaListaEspera, 'id'>),
    id: d.id,
  }));
}

/**
 * Verifica se o cliente já está na fila para aquela data/barbeiro.
 */
export async function jaEstaNaFila(
  barbeiroId: string,
  clienteUid: string,
  data: string,
): Promise<boolean> {
  const q = query(
    collection(db, 'listaEspera'),
    where('barbeiroId', '==', barbeiroId),
    where('clienteUid', '==', clienteUid),
    where('data', '==', data),
    where('status', '==', 'aguardando'),
  );
  const snap = await getDocs(q);
  return !snap.empty;
}

/**
 * Atualiza o status de uma entrada da fila.
 */
export async function atualizarStatusFila(
  entradaId: string,
  status: EntradaListaEspera['status'],
): Promise<void> {
  await updateDoc(doc(db, 'listaEspera', entradaId), { status });
}
