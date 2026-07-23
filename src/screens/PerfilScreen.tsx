import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { auth } from '../../firebaseConfig';
import {
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
  sendEmailVerification,
  deleteUser,
} from 'firebase/auth';
import {
  getProfile,
  updateProfile,
  deleteProfile,
} from '../data/repositories/UsuarioRepository';
import { upsertBarbeiro, removerBarbeiro, getBarbeiro } from '../data/repositories/BarbeiroRepository';
import {
  buscarSugestoesEndereco,
  buscarDetalhesEndereco,
  type SugestaoEndereco,
} from '../services/GeocodingService';
import { useTheme, type Theme } from '../context/ThemeContext';
import ThemeSelector from '../components/ThemeSelector';
import { maskPhone, formatPhoneToE164 } from '../utils/dateUtils';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList, Usuario } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Perfil'>;

interface FormErrors {
  nome?: string | null;
  telefone?: string | null;
}

export default function PerfilScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const [userData, setUserData] = useState<Usuario | null>(null);
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [endereco, setEndereco] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  // Autocomplete de endereço (Google Places, via Cloud Function — item de
  // geocoding do plano competitivo). lat/lng só ficam preenchidos quando o
  // usuário escolhe uma sugestão da lista; digitar livremente continua
  // funcionando como antes (sem coordenadas).
  const [sugestoesEndereco, setSugestoesEndereco] = useState<SugestaoEndereco[]>([]);
  const [buscandoEndereco, setBuscandoEndereco] = useState(false);
  const [coordenadas, setCoordenadas] = useState<{ lat: number; lng: number } | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Para troca de senha
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarNovaSenha, setConfirmarNovaSenha] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [showPasswordSection, setShowPasswordSection] = useState(false);

  // Exclusão de conta (LGPD)
  const [showDeleteSection, setShowDeleteSection] = useState(false);
  const [senhaExclusao, setSenhaExclusao] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [resendingVerification, setResendingVerification] = useState(false);

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      const uid = auth.currentUser?.uid;
      if (!uid) return;

      const data = await getProfile(uid);
      if (data) {
        setUserData(data);
        setNome(data.nome || '');

        // Formatar telefone para exibição
        const digits = (data.telefone || '').replace(/\D/g, '');
        const local = digits.startsWith('55') ? digits.slice(2) : digits;
        setTelefone(maskPhone(local));

        // Endereço só existe na vitrine do barbeiro (coleção `barbeiros`)
        if (data.tipo === 'barbeiro') {
          const barbeiroDoc = await getBarbeiro(uid);
          setEndereco(barbeiroDoc?.enderecoFormatado || barbeiroDoc?.endereco || '');
          if (barbeiroDoc?.latitude != null && barbeiroDoc?.longitude != null) {
            setCoordenadas({ lat: barbeiroDoc.latitude, lng: barbeiroDoc.longitude });
          }
        }
      }
    } catch (error) {
      console.error('Erro ao buscar perfil:', error);
      Alert.alert('Erro', 'Não foi possível carregar o perfil.');
    } finally {
      setLoading(false);
    }
  };

  const validateProfile = () => {
    const newErrors: FormErrors = {};
    if (!nome.trim() || nome.trim().length < 3) {
      newErrors.nome = 'Nome deve ter pelo menos 3 caracteres';
    }
    const digits = telefone.replace(/\D/g, '');
    if (!digits || digits.length < 10) {
      newErrors.telefone = 'Telefone inválido';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSaveProfile = async () => {
    if (!validateProfile()) return;

    setSaving(true);
    try {
      const uid = auth.currentUser?.uid;
      if (!uid) return;
      const telefoneE164 = formatPhoneToE164(telefone);

      await updateProfile(uid, {
        nome: nome.trim(),
        telefone: telefoneE164,
      });

      // Se for barbeiro, mantém a vitrine (coleção `barbeiros`) sincronizada.
      // upsert com merge também cria o doc caso o barbeiro seja antigo (item 3).
      if (userData?.tipo === 'barbeiro') {
        await upsertBarbeiro(uid, {
          nome: nome.trim(),
          telefone: telefoneE164,
          ...(endereco.trim() ? { endereco: endereco.trim() } : {}),
          // Coordenadas só existem quando o endereço veio de uma sugestão do
          // autocomplete — texto digitado livremente não tem lat/lng.
          ...(coordenadas ? { latitude: coordenadas.lat, longitude: coordenadas.lng } : {}),
        });
      }

      Alert.alert('Sucesso!', 'Perfil atualizado com sucesso.');
    } catch (error) {
      console.error('Erro ao salvar perfil:', error);
      Alert.alert('Erro', 'Não foi possível salvar as alterações.');
    } finally {
      setSaving(false);
    }
  };

  const handleChangeEndereco = (texto: string) => {
    setEndereco(texto);
    // Qualquer edição manual invalida a sugestão escolhida antes — só volta
    // a ter coordenadas se o usuário escolher uma sugestão nova.
    setCoordenadas(null);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (texto.trim().length < 3) {
      setSugestoesEndereco([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setBuscandoEndereco(true);
      try {
        const sugestoes = await buscarSugestoesEndereco(texto);
        setSugestoesEndereco(sugestoes);
      } finally {
        setBuscandoEndereco(false);
      }
    }, 400);
  };

  const handleSelecionarSugestao = async (sugestao: SugestaoEndereco) => {
    setSugestoesEndereco([]);
    setEndereco(sugestao.description);
    setBuscandoEndereco(true);
    try {
      const detalhes = await buscarDetalhesEndereco(sugestao.placeId);
      if (detalhes?.formattedAddress) {
        setEndereco(detalhes.formattedAddress);
      }
      if (detalhes?.latitude != null && detalhes?.longitude != null) {
        setCoordenadas({ lat: detalhes.latitude, lng: detalhes.longitude });
      }
    } finally {
      setBuscandoEndereco(false);
    }
  };

  const handleChangePassword = async () => {
    if (!senhaAtual.trim()) {
      Alert.alert('Erro', 'Informe sua senha atual.');
      return;
    }
    if (!novaSenha.trim() || novaSenha.length < 6) {
      Alert.alert('Erro', 'Nova senha deve ter pelo menos 6 caracteres.');
      return;
    }
    if (novaSenha !== confirmarNovaSenha) {
      Alert.alert('Erro', 'Novas senhas não conferem.');
      return;
    }

    setChangingPassword(true);
    try {
      const user = auth.currentUser;
      if (!user?.email) return;
      const credential = EmailAuthProvider.credential(user.email, senhaAtual);

      // Reautenticar antes de trocar a senha
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, novaSenha);

      Alert.alert('Sucesso!', 'Senha alterada com sucesso.');
      setSenhaAtual('');
      setNovaSenha('');
      setConfirmarNovaSenha('');
      setShowPasswordSection(false);
    } catch (error: any) {
      console.error('Erro ao trocar senha:', error);
      let msg = 'Não foi possível alterar a senha.';
      if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        msg = 'Senha atual incorreta.';
      }
      Alert.alert('Erro', msg);
    } finally {
      setChangingPassword(false);
    }
  };

  const handleResendVerification = async () => {
    const user = auth.currentUser;
    if (!user) return;
    setResendingVerification(true);
    try {
      await sendEmailVerification(user);
      Alert.alert(
        'Email enviado',
        'Verifique sua caixa de entrada (e o spam) e clique no link de confirmação.',
      );
    } catch (error: any) {
      let msg = 'Não foi possível enviar o email. Tente novamente mais tarde.';
      if (error.code === 'auth/too-many-requests') {
        msg = 'Muitas tentativas. Aguarde alguns minutos e tente de novo.';
      }
      Alert.alert('Erro', msg);
    } finally {
      setResendingVerification(false);
    }
  };

  /**
   * Exclusão de conta (LGPD — direito de exclusão dos dados).
   * Reautentica, remove os documentos do Firestore e apaga a conta do Auth.
   */
  const handleDeleteAccount = async () => {
    if (!senhaExclusao.trim()) {
      Alert.alert('Atenção', 'Digite sua senha para confirmar a exclusão.');
      return;
    }

    Alert.alert(
      'Excluir conta',
      'Esta ação é permanente: seu perfil e seus dados pessoais serão apagados. Deseja continuar?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir definitivamente',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              const user = auth.currentUser;
              if (!user?.email) return;
              const uid = user.uid;

              // 1. Reautentica (o Firebase exige login recente para excluir)
              const credential = EmailAuthProvider.credential(
                user.email,
                senhaExclusao,
              );
              await reauthenticateWithCredential(user, credential);

              // 2. Remove os dados do Firestore (perfil + vitrine, se barbeiro)
              if (userData?.tipo === 'barbeiro') {
                await removerBarbeiro(uid);
              }
              await deleteProfile(uid);

              // 3. Apaga a conta de autenticação
              await deleteUser(user);

              Alert.alert(
                'Conta excluída',
                'Sua conta e seus dados pessoais foram removidos.',
                [{ text: 'OK', onPress: () => navigation.replace('Login') }],
              );
            } catch (error: any) {
              console.error('Erro ao excluir conta:', error);
              let msg = 'Não foi possível excluir a conta. Tente novamente.';
              if (
                error.code === 'auth/wrong-password' ||
                error.code === 'auth/invalid-credential'
              ) {
                msg = 'Senha incorreta.';
              }
              Alert.alert('Erro', msg);
            } finally {
              setDeleting(false);
            }
          },
        },
      ],
    );
  };

  const handleLogout = () => {
    Alert.alert('Sair', 'Deseja realmente sair?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sair',
        style: 'destructive',
        onPress: async () => {
          await auth.signOut();
          navigation.replace('Login');
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>
          Carregando perfil...
        </Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
        {/* Avatar */}
        <View style={styles.avatarSection}>
          <View style={[styles.avatar, { backgroundColor: theme.colors.primary }]}>
            <Text style={styles.avatarText}>
              {nome ? nome.charAt(0).toUpperCase() : '?'}
            </Text>
          </View>
          <Text style={[styles.userName, { color: theme.colors.text }]}>{nome}</Text>
          <Text style={[styles.userEmail, { color: theme.colors.textSecondary }]}>
            {auth.currentUser?.email}
          </Text>
          <View style={[styles.tipoBadge, { backgroundColor: theme.colors.primary + '20' }]}>
            <Text style={[styles.tipoText, { color: theme.colors.primary }]}>
              {userData?.tipo === 'barbeiro' ? '💈 Barbeiro' : '✂️ Cliente'}
            </Text>
          </View>
        </View>

        {/* Verificação de email (item 13) */}
        {auth.currentUser && !auth.currentUser.emailVerified && (
          <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              ✉️ Email não verificado
            </Text>
            <Text style={[styles.verificationText, { color: theme.colors.textSecondary }]}>
              Confirme seu email para garantir a recuperação da sua conta.
            </Text>
            <TouchableOpacity
              style={[styles.saveButton, resendingVerification && styles.saveButtonDisabled]}
              accessibilityRole="button"
              accessibilityLabel="Reenviar email de verificação"
              onPress={handleResendVerification}
              disabled={resendingVerification}
            >
              {resendingVerification ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.saveButtonText}>Reenviar email de verificação</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Dados do perfil */}
        <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Dados pessoais
          </Text>

          <View style={styles.inputContainer}>
            <Text style={[styles.label, { color: theme.colors.text }]}>Nome completo</Text>
            <TextInput
              value={nome}
              onChangeText={(t) => { setNome(t); if (errors.nome) setErrors((p) => ({ ...p, nome: null })); }}
              style={[
                styles.input,
                { backgroundColor: theme.colors.background, color: theme.colors.text, borderColor: theme.colors.border },
                errors.nome && styles.inputError,
              ]}
              placeholder="Seu nome completo"
              placeholderTextColor={theme.colors.textSecondary}
              autoCapitalize="words"
            />
            {errors.nome ? <Text style={styles.errorText}>{errors.nome}</Text> : null}
          </View>

          <View style={styles.inputContainer}>
            <Text style={[styles.label, { color: theme.colors.text }]}>Telefone / WhatsApp</Text>
            <TextInput
              value={telefone}
              onChangeText={(t) => { setTelefone(maskPhone(t)); if (errors.telefone) setErrors((p) => ({ ...p, telefone: null })); }}
              style={[
                styles.input,
                { backgroundColor: theme.colors.background, color: theme.colors.text, borderColor: theme.colors.border },
                errors.telefone && styles.inputError,
              ]}
              placeholder="(11) 99999-9999"
              placeholderTextColor={theme.colors.textSecondary}
              keyboardType="phone-pad"
              maxLength={15}
            />
            {errors.telefone ? <Text style={styles.errorText}>{errors.telefone}</Text> : null}
          </View>

          {userData?.tipo === 'barbeiro' && (
            <View style={[styles.inputContainer, { zIndex: 10 }]}>
              <Text style={[styles.label, { color: theme.colors.text }]}>
                Endereço do estabelecimento
              </Text>
              <View>
                <TextInput
                  value={endereco}
                  onChangeText={handleChangeEndereco}
                  style={[
                    styles.input,
                    { backgroundColor: theme.colors.background, color: theme.colors.text, borderColor: theme.colors.border },
                  ]}
                  placeholder="Comece a digitar e escolha uma sugestão"
                  placeholderTextColor={theme.colors.textSecondary}
                  autoCapitalize="sentences"
                />
                {buscandoEndereco && (
                  <ActivityIndicator
                    size="small"
                    color={theme.colors.primary}
                    style={styles.enderecoSpinner}
                  />
                )}
                {sugestoesEndereco.length > 0 && (
                  <View style={[styles.sugestoesBox, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                    {sugestoesEndereco.map((s) => (
                      <TouchableOpacity
                        key={s.placeId}
                        style={styles.sugestaoItem}
                        onPress={() => handleSelecionarSugestao(s)}
                        accessibilityRole="button"
                      >
                        <Text style={[styles.sugestaoText, { color: theme.colors.text }]} numberOfLines={2}>
                          📍 {s.description}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
              <Text style={[styles.hintSmall, { color: theme.colors.textSecondary }]}>
                {coordenadas
                  ? '✓ Endereço confirmado com localização no mapa.'
                  : 'Exibido aos clientes na confirmação do agendamento, com link para o mapa.'}
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={handleSaveProfile}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.saveButtonText}>Salvar alterações</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Aparência / Tema */}
        <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Aparência</Text>
          <ThemeSelector />
        </View>

        {/* Alterar senha */}
        <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
          <TouchableOpacity
            style={styles.sectionHeader}
            onPress={() => setShowPasswordSection((v) => !v)}
          >
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              Alterar senha
            </Text>
            <Text style={{ color: theme.colors.primary, fontSize: 18 }}>
              {showPasswordSection ? '▲' : '▼'}
            </Text>
          </TouchableOpacity>

          {showPasswordSection && (
            <View>
              <View style={styles.inputContainer}>
                <Text style={[styles.label, { color: theme.colors.text }]}>Senha atual</Text>
                <TextInput
                  value={senhaAtual}
                  onChangeText={setSenhaAtual}
                  style={[styles.input, { backgroundColor: theme.colors.background, color: theme.colors.text, borderColor: theme.colors.border }]}
                  placeholder="Digite sua senha atual"
                  placeholderTextColor={theme.colors.textSecondary}
                  secureTextEntry
                  autoCapitalize="none"
                />
              </View>
              <View style={styles.inputContainer}>
                <Text style={[styles.label, { color: theme.colors.text }]}>Nova senha</Text>
                <TextInput
                  value={novaSenha}
                  onChangeText={setNovaSenha}
                  style={[styles.input, { backgroundColor: theme.colors.background, color: theme.colors.text, borderColor: theme.colors.border }]}
                  placeholder="Mínimo 6 caracteres"
                  placeholderTextColor={theme.colors.textSecondary}
                  secureTextEntry
                  autoCapitalize="none"
                />
              </View>
              <View style={styles.inputContainer}>
                <Text style={[styles.label, { color: theme.colors.text }]}>Confirmar nova senha</Text>
                <TextInput
                  value={confirmarNovaSenha}
                  onChangeText={setConfirmarNovaSenha}
                  style={[styles.input, { backgroundColor: theme.colors.background, color: theme.colors.text, borderColor: theme.colors.border }]}
                  placeholder="Repita a nova senha"
                  placeholderTextColor={theme.colors.textSecondary}
                  secureTextEntry
                  autoCapitalize="none"
                />
              </View>
              <TouchableOpacity
                style={[styles.saveButton, changingPassword && styles.saveButtonDisabled]}
                onPress={handleChangePassword}
                disabled={changingPassword}
              >
                {changingPassword ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.saveButtonText}>Alterar senha</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Privacidade (LGPD) */}
        <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Privacidade
          </Text>
          <TouchableOpacity
            style={styles.privacyLink}
            accessibilityRole="button"
            accessibilityLabel="Abrir Política de Privacidade"
            onPress={() => navigation.navigate('Privacidade')}
          >
            <Text style={[styles.privacyLinkText, { color: theme.colors.primary }]}>
              📄 Ver Política de Privacidade
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.privacyLink}
            accessibilityRole="button"
            accessibilityLabel="Excluir minha conta e meus dados"
            onPress={() => setShowDeleteSection((v) => !v)}
          >
            <Text style={[styles.privacyLinkText, { color: '#c0392b' }]}>
              🗑️ Excluir minha conta e meus dados
            </Text>
          </TouchableOpacity>

          {showDeleteSection && (
            <View style={styles.deleteSection}>
              <Text style={[styles.deleteWarning, { color: theme.colors.textSecondary }]}>
                A exclusão é permanente e remove seu perfil e dados pessoais
                (LGPD, art. 18). Digite sua senha para confirmar.
              </Text>
              <TextInput
                value={senhaExclusao}
                onChangeText={setSenhaExclusao}
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.colors.background,
                    color: theme.colors.text,
                    borderColor: theme.colors.border,
                    marginBottom: 12,
                  },
                ]}
                placeholder="Sua senha"
                placeholderTextColor={theme.colors.textSecondary}
                secureTextEntry
                autoCapitalize="none"
                accessibilityLabel="Senha para confirmar exclusão da conta"
              />
              <TouchableOpacity
                style={[styles.deleteButton, deleting && styles.saveButtonDisabled]}
                accessibilityRole="button"
                accessibilityLabel="Confirmar exclusão da conta"
                onPress={handleDeleteAccount}
                disabled={deleting}
              >
                {deleting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.deleteButtonText}>Excluir definitivamente</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutButtonText}>Sair da conta</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContainer: {
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
  },
  avatarSection: {
    alignItems: 'center',
    paddingVertical: 30,
    paddingHorizontal: 20,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarText: {
    color: '#fff',
    fontSize: 32,
    fontWeight: 'bold',
  },
  userName: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 15,
    marginBottom: 8,
  },
  tipoBadge: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 4,
  },
  tipoText: {
    fontSize: 14,
    fontWeight: '600',
  },
  section: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  inputError: {
    borderColor: '#e74c3c',
  },
  errorText: {
    color: '#e74c3c',
    fontSize: 13,
    marginTop: 4,
  },
  hintSmall: {
    fontSize: 12,
    marginTop: 6,
    lineHeight: 16,
  },
  enderecoSpinner: {
    position: 'absolute',
    right: 12,
    top: 14,
  },
  sugestoesBox: {
    borderWidth: 1,
    borderRadius: 8,
    marginTop: -12,
    marginBottom: 4,
    overflow: 'hidden',
  },
  sugestaoItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#00000022',
  },
  sugestaoText: {
    fontSize: 14,
    lineHeight: 19,
  },
  saveButton: {
    backgroundColor: '#3498db',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  saveButtonDisabled: {
    backgroundColor: '#bdc3c7',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  verificationText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  privacyLink: {
    paddingVertical: 12,
    minHeight: 44,
    justifyContent: 'center',
  },
  privacyLinkText: {
    fontSize: 15,
    fontWeight: '600',
  },
  deleteSection: {
    marginTop: 8,
  },
  deleteWarning: {
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 12,
  },
  deleteButton: {
    backgroundColor: '#c0392b',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  logoutButton: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    backgroundColor: '#e74c3c',
  },
  logoutButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
