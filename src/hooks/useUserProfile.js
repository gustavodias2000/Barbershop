/**
 * useUserProfile — hook compartilhado para carregar o perfil do usuário logado.
 *
 * Item 12 da auditoria: substitui o bloco fetchUserProfile que estava
 * duplicado em 4 telas (ClienteHome, BarbeiroHome, AgendamentoScreen, Perfil).
 */
import { useState, useEffect, useCallback } from 'react';
import { auth } from '../../firebase';
import { getProfile } from '../data/repositories/UsuarioRepository';

export default function useUserProfile() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const uid = auth.currentUser?.uid;
      if (!uid) {
        setProfile(null);
        return null;
      }
      const data = await getProfile(uid);
      setProfile(data);
      return data;
    } catch (error) {
      console.error('Erro ao buscar perfil:', error);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { profile, loading, refresh };
}
