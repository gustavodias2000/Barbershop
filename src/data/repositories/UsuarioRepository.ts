/**
 * UsuarioRepository — único ponto de acesso à coleção `usuarios`.
 *
 * Item 12 da auditoria: camada de Repository isola o Firestore das telas,
 * elimina a duplicação de fetchUserProfile (antes copiada em 4 telas) e
 * facilita testes (basta mockar este módulo).
 */
import { db } from '../../../firebaseConfig';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import type { Usuario } from '../../types';

const ref = (uid: string) => doc(db, 'usuarios', uid);

/**
 * Busca o perfil do usuário. Retorna null se não existir.
 */
export async function getProfile(uid?: string | null): Promise<Usuario | null> {
  if (!uid) return null;
  const snap = await getDoc(ref(uid));
  return snap.exists() ? (snap.data() as Usuario) : null;
}

/**
 * Cria o perfil no cadastro.
 */
export async function createProfile(
  uid: string,
  data: Omit<Usuario, 'uid' | 'createdAt'>,
): Promise<void> {
  await setDoc(ref(uid), {
    uid,
    ...data,
    createdAt: serverTimestamp(),
  });
}

/**
 * Atualiza campos do perfil.
 */
export async function updateProfile(
  uid: string,
  data: Partial<Omit<Usuario, 'uid' | 'tipo'>>,
): Promise<void> {
  await updateDoc(ref(uid), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Salva o token de push (FCM) no perfil — usado pelos lembretes automáticos.
 */
export async function saveFcmToken(
  uid?: string | null,
  token?: string | null,
): Promise<void> {
  if (!uid || !token) return;
  try {
    await updateDoc(ref(uid), { fcmToken: token, fcmTokenAt: serverTimestamp() });
  } catch (error: any) {
    // Não é crítico: o app funciona sem push
    console.warn('Não foi possível salvar o token de push:', error?.message);
  }
}

/**
 * Exclui o documento de perfil (LGPD — direito de exclusão).
 */
export async function deleteProfile(uid: string): Promise<void> {
  await deleteDoc(ref(uid));
}
