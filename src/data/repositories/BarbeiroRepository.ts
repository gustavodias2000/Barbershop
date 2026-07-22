/**
 * BarbeiroRepository — único ponto de acesso à coleção `barbeiros`
 * (a "vitrine" que os clientes veem).
 */
import { db } from '../../../firebaseConfig';
import {
  collection,
  query,
  getDocs,
  getDoc,
  doc,
  setDoc,
  deleteDoc,
  limit,
  serverTimestamp,
} from 'firebase/firestore';
import type { Barbeiro } from '../../types';

/**
 * Busca um barbeiro pelo uid.
 */
export async function getBarbeiro(uid: string): Promise<Barbeiro | null> {
  const snap = await getDoc(doc(db, 'barbeiros', uid));
  if (!snap.exists()) return null;
  return { ...(snap.data() as Omit<Barbeiro, 'id'>), id: snap.id };
}

/**
 * Lista os barbeiros disponíveis (paginado).
 */
export async function listarBarbeiros(max: number = 50): Promise<Barbeiro[]> {
  const q = query(collection(db, 'barbeiros'), limit(max));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ ...(d.data() as Omit<Barbeiro, 'id'>), id: d.id }));
}

/**
 * Cria/atualiza a entrada do barbeiro na vitrine (id do doc == uid).
 */
export async function upsertBarbeiro(
  uid: string,
  data: Partial<Omit<Barbeiro, 'id' | 'uid'>>,
): Promise<void> {
  await setDoc(
    doc(db, 'barbeiros', uid),
    { id: uid, uid, ...data, updatedAt: serverTimestamp() },
    { merge: true },
  );
}

/**
 * Remove o barbeiro da vitrine (usado na exclusão de conta — LGPD).
 */
export async function removerBarbeiro(uid: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'barbeiros', uid));
  } catch (error: any) {
    console.warn('Não foi possível remover da vitrine:', error?.message);
  }
}
