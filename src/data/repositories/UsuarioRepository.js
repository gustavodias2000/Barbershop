/**
 * UsuarioRepository — único ponto de acesso à coleção `usuarios`.
 *
 * Item 12 da auditoria: camada de Repository isola o Firestore das telas,
 * elimina a duplicação de fetchUserProfile (antes copiada em 4 telas) e
 * facilita testes (basta mockar este módulo).
 */
import { db } from '../../../firebase';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';

const ref = (uid) => doc(db, 'usuarios', uid);

/**
 * Busca o perfil do usuário. Retorna null se não existir.
 */
export async function getProfile(uid) {
  if (!uid) return null;
  const snap = await getDoc(ref(uid));
  return snap.exists() ? snap.data() : null;
}

/**
 * Cria o perfil no cadastro.
 */
export async function createProfile(uid, data) {
  await setDoc(ref(uid), {
    uid,
    ...data,
    createdAt: serverTimestamp(),
  });
}

/**
 * Atualiza campos do perfil.
 */
export async function updateProfile(uid, data) {
  await updateDoc(ref(uid), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Salva o token de push (FCM) no perfil — usado pelos lembretes automáticos.
 */
export async function saveFcmToken(uid, token) {
  if (!uid || !token) return;
  try {
    await updateDoc(ref(uid), { fcmToken: token, fcmTokenAt: serverTimestamp() });
  } catch (error) {
    // Não é crítico: o app funciona sem push
    console.warn('Não foi possível salvar o token de push:', error?.message);
  }
}

/**
 * Exclui o documento de perfil (LGPD — direito de exclusão).
 */
export async function deleteProfile(uid) {
  await deleteDoc(ref(uid));
}
