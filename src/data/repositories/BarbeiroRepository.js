/**
 * BarbeiroRepository — único ponto de acesso à coleção `barbeiros`
 * (a "vitrine" que os clientes veem).
 */
import { db } from '../../../firebase';
import {
  collection,
  query,
  getDocs,
  doc,
  setDoc,
  deleteDoc,
  limit,
  serverTimestamp,
} from 'firebase/firestore';

/**
 * Lista os barbeiros disponíveis (paginado).
 */
export async function listarBarbeiros(max = 50) {
  const q = query(collection(db, 'barbeiros'), limit(max));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Cria/atualiza a entrada do barbeiro na vitrine (id do doc == uid).
 */
export async function upsertBarbeiro(uid, data) {
  await setDoc(
    doc(db, 'barbeiros', uid),
    { id: uid, uid, ...data, updatedAt: serverTimestamp() },
    { merge: true },
  );
}

/**
 * Remove o barbeiro da vitrine (usado na exclusão de conta — LGPD).
 */
export async function removerBarbeiro(uid) {
  try {
    await deleteDoc(doc(db, 'barbeiros', uid));
  } catch (error) {
    console.warn('Não foi possível remover da vitrine:', error?.message);
  }
}
