/**
 * OcupacaoService — controla os horários ocupados de cada barbeiro
 * SEM expor dados pessoais do cliente.
 *
 * A coleção `agendamentos` é privada (só o cliente dono e o barbeiro dono
 * podem ler). Mas o cliente precisa saber quais horários já estão tomados
 * para montar a grade de disponibilidade. Para isso usamos a coleção
 * `ocupacoes`, que contém apenas { barbeiroId, data, horario } — nada de
 * nome, email ou telefone — e por isso pode ser lida por qualquer usuário
 * logado com segurança.
 */
import { db } from '../../firebase';
import {
  collection,
  query,
  where,
  getDocs,
  setDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from 'firebase/firestore';
import type { DataISO, Horario } from '../types';

// ID determinístico do slot: evita duplicidade e facilita liberar depois.
// Ex.: "abc123_2026-07-20_09-00"
const slotId = (barbeiroId: string, data: DataISO, horario: Horario): string =>
  `${barbeiroId}_${data}_${String(horario).replace(':', '-')}`;

/**
 * Retorna os horários já ocupados de um barbeiro numa data.
 * @returns ex.: ['09:00', '10:30']
 */
export async function getHorariosOcupados(
  barbeiroId?: string | null,
  data?: DataISO | null,
): Promise<Horario[]> {
  if (!barbeiroId || !data) return [];
  const q = query(
    collection(db, 'ocupacoes'),
    where('barbeiroId', '==', barbeiroId),
    where('data', '==', data),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => (d.data() as { horario: Horario }).horario);
}

/**
 * Marca um horário como ocupado (ao criar um agendamento).
 */
export async function marcarOcupado(
  barbeiroId: string,
  data: DataISO,
  horario: Horario,
): Promise<void> {
  await setDoc(doc(db, 'ocupacoes', slotId(barbeiroId, data, horario)), {
    barbeiroId,
    data,
    horario,
    createdAt: serverTimestamp(),
  });
}

/**
 * Libera um horário (ao cancelar um agendamento).
 * Silencioso: se o slot não existir, não faz nada.
 */
export async function liberarSlot(
  barbeiroId?: string | null,
  data?: DataISO | null,
  horario?: Horario | null,
): Promise<void> {
  if (!barbeiroId || !data || !horario) return;
  try {
    await deleteDoc(doc(db, 'ocupacoes', slotId(barbeiroId, data, horario)));
  } catch (error: any) {
    console.warn('Não foi possível liberar o slot:', error?.message);
  }
}
