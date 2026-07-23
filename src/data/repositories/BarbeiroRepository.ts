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
import CacheService from '../../services/CacheService';
import type { Barbeiro } from '../../types';

const TTL_BARBEIRO_MS = 2 * 60 * 1000; // 2min — config individual
const TTL_LISTA_MS = 60 * 1000; // 1min — vitrine (lista muda pouco, mas cadastros novos devem aparecer logo)
const PREFIXO_LISTA = 'barbeiros:list:';

/**
 * Busca um barbeiro pelo uid. Cacheado em memória (ver CacheService) — toda
 * escrita em `barbeiros/{uid}` (aqui ou em NegocioRepository) invalida a
 * chave correspondente, então nunca serve dado desatualizado após um save.
 */
export async function getBarbeiro(uid: string): Promise<Barbeiro | null> {
  return CacheService.getOrFetch(`barbeiro:${uid}`, TTL_BARBEIRO_MS, async () => {
    const snap = await getDoc(doc(db, 'barbeiros', uid));
    if (!snap.exists()) return null;
    return { ...(snap.data() as Omit<Barbeiro, 'id'>), id: snap.id };
  });
}

/**
 * Lista os barbeiros disponíveis (paginado). Cacheada por 1 minuto — a
 * vitrine é lida repetidamente (toda vez que o cliente volta pra Home).
 */
export async function listarBarbeiros(max: number = 50): Promise<Barbeiro[]> {
  return CacheService.getOrFetch(`${PREFIXO_LISTA}${max}`, TTL_LISTA_MS, async () => {
    const q = query(collection(db, 'barbeiros'), limit(max));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ ...(d.data() as Omit<Barbeiro, 'id'>), id: d.id }));
  });
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
  CacheService.invalidate(`barbeiro:${uid}`);
  CacheService.invalidatePrefix(PREFIXO_LISTA);
}

/**
 * Remove o barbeiro da vitrine (usado na exclusão de conta — LGPD).
 */
export async function removerBarbeiro(uid: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'barbeiros', uid));
  } catch (error: any) {
    console.warn('Não foi possível remover da vitrine:', error?.message);
  } finally {
    CacheService.invalidate(`barbeiro:${uid}`);
    CacheService.invalidatePrefix(PREFIXO_LISTA);
  }
}
