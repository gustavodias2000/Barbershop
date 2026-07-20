import React, { useState, useEffect } from 'react';
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
import { auth, db } from '../../firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { useTheme } from '../context/ThemeContext';
import ThemeSelector from '../components/ThemeSelector';
import { maskPhone, formatPhoneToE164 } from '../utils/dateUtils';

export default function PerfilScreen({ navigation }) {
  const { theme } = useTheme();
  const [userData, setUserData] = useState(null);
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  // Para troca de senha
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarNovaSenha, setConfirmarNovaSenha] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [showPasswordSection, setShowPasswordSection] = useState(false);

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      const uid = auth.currentUser?.uid;
      if (!uid) return;

      const userDoc = await getDoc(doc(db, 'usuarios', uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        setUserData(data);
        setNome(data.nome || '');

        // Formatar telefone para exibição
        const digits = (data.telefone || '').replace(/\D/g, '');
        const local = digits.startsWith('55') ? digits.slice(2) : digits;
        setTelefone(maskPhone(local));
      }
    } catch (error) {
      console.error('Erro ao buscar perfil:', error);
      Alert.alert('Erro', 'Não foi possível carregar o perfil.');
    } finally {
      setLoading(false);
    }
  };

  const validateProfile = () => {
    const newErrors = {};
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
      await updateDoc(doc(db, 'usuarios', uid), {
        nome: nome.trim(),
        telefone: formatPhoneToE164(telefone),
        updatedAt: new Date(),
      });

      Alert.alert('Sucesso!', 'Perfil atualizado com sucesso.');
    } catch (error) {
      console.error('Erro ao salvar perfil:', error);
      Alert.alert('Erro', 'Não foi possível salvar as alterações.');
    } finally {
      setSaving(false);
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
      const credential = EmailAuthProvider.credential(user.email, senhaAtual);

      // Reautenticar antes de trocar a senha
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, novaSenha);

      Alert.alert('Sucesso!', 'Senha alterada com sucesso.');
      setSenhaAtual('');
      setNovaSenha('');
      setConfirmarNovaSenha('');
      setShowPasswordSection(false);
    } catch (error) {
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
