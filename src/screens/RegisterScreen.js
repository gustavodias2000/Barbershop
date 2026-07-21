import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { createUserWithEmailAndPassword, sendEmailVerification } from 'firebase/auth';
import { serverTimestamp } from 'firebase/firestore';
import { auth } from '../../firebase';
import { createProfile } from '../data/repositories/UsuarioRepository';
import { upsertBarbeiro } from '../data/repositories/BarbeiroRepository';
import { maskPhone, formatPhoneToE164, precoParaCentavos } from '../utils/dateUtils';
import { useTheme } from '../context/ThemeContext';

export default function RegisterScreen({ navigation }) {
  const { theme } = useTheme();
  const s = getStyles(theme);

  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [tipo, setTipo] = useState('cliente');
  const [especialidade, setEspecialidade] = useState('');
  const [preco, setPreco] = useState('');
  const [aceitouPolitica, setAceitouPolitica] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const validateEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

  const validateForm = () => {
    const newErrors = {};
    if (!nome.trim() || nome.trim().length < 3) {
      newErrors.nome = 'Nome deve ter pelo menos 3 caracteres';
    }
    if (!email.trim()) {
      newErrors.email = 'Email é obrigatório';
    } else if (!validateEmail(email.trim())) {
      newErrors.email = 'Email inválido';
    }
    const digits = telefone.replace(/\D/g, '');
    if (!digits || digits.length < 10) {
      newErrors.telefone = 'Telefone inválido (mínimo 10 dígitos)';
    }
    if (!senha.trim()) {
      newErrors.senha = 'Senha é obrigatória';
    } else if (senha.length < 6) {
      newErrors.senha = 'Senha deve ter pelo menos 6 caracteres';
    }
    if (senha !== confirmarSenha) {
      newErrors.confirmarSenha = 'Senhas não conferem';
    }
    // LGPD: consentimento explícito é obrigatório para tratar dados pessoais
    if (!aceitouPolitica) {
      newErrors.politica = 'É necessário aceitar a Política de Privacidade';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleRegister = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email.trim(),
        senha,
      );
      const { uid } = userCredential.user;

      const telefoneE164 = formatPhoneToE164(telefone);

      await createProfile(uid, {
        nome: nome.trim(),
        email: email.trim().toLowerCase(),
        telefone: telefoneE164,
        tipo,
        // LGPD: registra o consentimento com carimbo do servidor
        consentimentoLGPD: true,
        consentimentoEm: serverTimestamp(),
      });

      // Item 13: dispara o email de verificação (não bloqueia o fluxo)
      sendEmailVerification(userCredential.user).catch(() => {});

      // CORRIGIDO (item 3): barbeiro também aparece na vitrine para os clientes
      if (tipo === 'barbeiro') {
        const precoDisplay = preco.trim() || '25,00';
        await upsertBarbeiro(uid, {
          nome: nome.trim(),
          telefone: telefoneE164,
          especialidade: especialidade.trim() || 'Corte e barba',
          preco: precoDisplay,                          // mantido p/ compatibilidade
          precoEmCentavos: precoParaCentavos(precoDisplay), // novo campo numérico
        });
      }

      Alert.alert(
        'Conta criada!',
        'Enviamos um email de verificação para ' +
          email.trim() +
          '. Confirme quando puder — você já pode usar o app.',
        [
          {
            text: 'OK',
            onPress: () =>
              navigation.replace(tipo === 'barbeiro' ? 'Barbeiro' : 'Cliente'),
          },
        ],
      );
    } catch (error) {
      console.error('Erro no cadastro:', error);
      let errorMessage = 'Erro ao criar conta. Tente novamente.';
      switch (error.code) {
        case 'auth/email-already-in-use':
          errorMessage = 'Este email já está cadastrado.';
          break;
        case 'auth/invalid-email':
          errorMessage = 'Email inválido.';
          break;
        case 'auth/weak-password':
          errorMessage = 'Senha muito fraca. Use pelo menos 6 caracteres.';
          break;
        case 'auth/network-request-failed':
          errorMessage = 'Erro de conexão. Verifique sua internet.';
          break;
        default:
          errorMessage = 'Erro inesperado. Tente novamente.';
      }
      Alert.alert('Erro no Cadastro', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const clearError = (field) => {
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: null }));
  };

  return (
    <SafeAreaView style={s.safeArea} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={s.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={s.scrollContainer}
          keyboardShouldPersistTaps="handled"
        >
          <View style={s.header}>
            <Text style={s.title}>Barbershop</Text>
            <Text style={s.subtitle}>Criar nova conta</Text>
          </View>

          <View style={s.form}>
            {/* Tipo de conta */}
            <Text style={s.label}>Tipo de conta</Text>
            <View style={s.tipoContainer}>
              <TouchableOpacity
                style={[s.tipoButton, tipo === 'cliente' && s.tipoButtonActive]}
                accessibilityRole="button"
                accessibilityLabel="Cadastrar como cliente"
                accessibilityState={{ selected: tipo === 'cliente' }}
                onPress={() => setTipo('cliente')}
              >
                <Text
                  style={[s.tipoButtonText, tipo === 'cliente' && s.tipoButtonTextActive]}
                >
                  ✂️ Cliente
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.tipoButton, tipo === 'barbeiro' && s.tipoButtonActive]}
                accessibilityRole="button"
                accessibilityLabel="Cadastrar como barbeiro"
                accessibilityState={{ selected: tipo === 'barbeiro' }}
                onPress={() => setTipo('barbeiro')}
              >
                <Text
                  style={[s.tipoButtonText, tipo === 'barbeiro' && s.tipoButtonTextActive]}
                >
                  💈 Barbeiro
                </Text>
              </TouchableOpacity>
            </View>

            {/* Campos exclusivos do barbeiro */}
            {tipo === 'barbeiro' && (
              <>
                <View style={s.inputContainer}>
                  <Text style={s.label}>Especialidade</Text>
                  <TextInput
                    value={especialidade}
                    onChangeText={setEspecialidade}
                    style={s.input}
                    placeholder="Ex: Corte, barba e sobrancelha"
                    placeholderTextColor={theme.colors.textMuted}
                    autoCapitalize="sentences"
                    accessibilityLabel="Especialidade do barbeiro"
                  />
                </View>
                <View style={s.inputContainer}>
                  <Text style={s.label}>Preço do serviço (R$)</Text>
                  <TextInput
                    value={preco}
                    onChangeText={setPreco}
                    style={s.input}
                    placeholder="Ex: 35,00"
                    placeholderTextColor={theme.colors.textMuted}
                    keyboardType="numeric"
                    accessibilityLabel="Preço do serviço em reais"
                  />
                </View>
              </>
            )}

            {/* Nome */}
            <View style={s.inputContainer}>
              <Text style={s.label}>Nome completo</Text>
              <TextInput
                value={nome}
                onChangeText={(t) => { setNome(t); clearError('nome'); }}
                style={[s.input, errors.nome && s.inputError]}
                placeholder="Seu nome completo"
                placeholderTextColor={theme.colors.textMuted}
                autoCapitalize="words"
                autoCorrect={false}
                accessibilityLabel="Nome completo"
              />
              {errors.nome ? <Text style={s.errorText}>{errors.nome}</Text> : null}
            </View>

            {/* Email */}
            <View style={s.inputContainer}>
              <Text style={s.label}>Email</Text>
              <TextInput
                value={email}
                onChangeText={(t) => { setEmail(t); clearError('email'); }}
                style={[s.input, errors.email && s.inputError]}
                placeholder="seuemail@exemplo.com"
                placeholderTextColor={theme.colors.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                accessibilityLabel="Email"
              />
              {errors.email ? <Text style={s.errorText}>{errors.email}</Text> : null}
            </View>

            {/* Telefone */}
            <View style={s.inputContainer}>
              <Text style={s.label}>Telefone / WhatsApp</Text>
              <TextInput
                value={telefone}
                onChangeText={(t) => { setTelefone(maskPhone(t)); clearError('telefone'); }}
                style={[s.input, errors.telefone && s.inputError]}
                placeholder="(11) 99999-9999"
                placeholderTextColor={theme.colors.textMuted}
                keyboardType="phone-pad"
                maxLength={15}
                accessibilityLabel="Telefone ou WhatsApp"
              />
              {errors.telefone ? <Text style={s.errorText}>{errors.telefone}</Text> : null}
            </View>

            {/* Senha */}
            <View style={s.inputContainer}>
              <Text style={s.label}>Senha</Text>
              <TextInput
                value={senha}
                onChangeText={(t) => { setSenha(t); clearError('senha'); }}
                style={[s.input, errors.senha && s.inputError]}
                placeholder="Mínimo 6 caracteres"
                placeholderTextColor={theme.colors.textMuted}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                accessibilityLabel="Senha"
              />
              {errors.senha ? <Text style={s.errorText}>{errors.senha}</Text> : null}
            </View>

            {/* Confirmar Senha */}
            <View style={s.inputContainer}>
              <Text style={s.label}>Confirmar senha</Text>
              <TextInput
                value={confirmarSenha}
                onChangeText={(t) => { setConfirmarSenha(t); clearError('confirmarSenha'); }}
                style={[s.input, errors.confirmarSenha && s.inputError]}
                placeholder="Repita a senha"
                placeholderTextColor={theme.colors.textMuted}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                accessibilityLabel="Confirmar senha"
              />
              {errors.confirmarSenha ? (
                <Text style={s.errorText}>{errors.confirmarSenha}</Text>
              ) : null}
            </View>

            {/* Consentimento LGPD */}
            <TouchableOpacity
              style={s.consentRow}
              accessibilityRole="checkbox"
              accessibilityLabel="Li e aceito a Política de Privacidade"
              accessibilityState={{ checked: aceitouPolitica }}
              onPress={() => {
                setAceitouPolitica((v) => !v);
                clearError('politica');
              }}
            >
              <View style={[s.checkbox, aceitouPolitica && s.checkboxChecked]}>
                {aceitouPolitica ? <Text style={s.checkboxMark}>✓</Text> : null}
              </View>
              <Text style={s.consentText}>
                Li e aceito a{' '}
                <Text
                  style={s.consentLink}
                  onPress={() => navigation.navigate('Privacidade')}
                >
                  Política de Privacidade
                </Text>{' '}
                e o tratamento dos meus dados conforme a LGPD.
              </Text>
            </TouchableOpacity>
            {errors.politica ? (
              <Text style={s.errorText}>{errors.politica}</Text>
            ) : null}

            <TouchableOpacity
              style={[s.button, loading && s.buttonDisabled]}
              accessibilityRole="button"
              accessibilityLabel="Criar conta"
              accessibilityState={{ disabled: loading }}
              onPress={handleRegister}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={s.buttonText}>Criar conta</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={s.loginLink}
              accessibilityRole="button"
              accessibilityLabel="Voltar para login"
              onPress={() => navigation.goBack()}
            >
              <Text style={s.loginLinkText}>
                Já tem conta?{' '}
                <Text style={s.loginLinkBold}>Entrar</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const getStyles = (theme) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: theme.colors.textSecondary,
  },
  form: {
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  tipoContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  tipoButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: theme.colors.border,
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceVariant,
    minHeight: 52,
    justifyContent: 'center',
  },
  tipoButtonActive: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.isDark ? theme.colors.surfaceVariant : '#ebf5fb',
  },
  tipoButtonText: {
    fontSize: 15,
    color: theme.colors.textSecondary,
    fontWeight: '600',
  },
  tipoButtonTextActive: {
    color: theme.colors.primary,
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: theme.colors.surfaceVariant,
    color: theme.colors.text,
    minHeight: 48,
  },
  inputError: {
    borderColor: theme.colors.error,
  },
  errorText: {
    color: theme.colors.error,
    fontSize: 13,
    marginTop: 4,
  },
  consentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 4,
    marginBottom: 4,
    minHeight: 44,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceVariant,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  checkboxMark: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  consentText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    color: theme.colors.textSecondary,
  },
  consentLink: {
    color: theme.colors.primary,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  button: {
    backgroundColor: theme.colors.primary,
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
    minHeight: 52,
    justifyContent: 'center',
  },
  buttonDisabled: {
    backgroundColor: theme.colors.textMuted,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  loginLink: {
    alignItems: 'center',
    marginTop: 20,
    paddingVertical: 10,
    minHeight: 44,
    justifyContent: 'center',
  },
  loginLinkText: {
    fontSize: 15,
    color: theme.colors.textSecondary,
  },
  loginLinkBold: {
    color: theme.colors.primary,
    fontWeight: '600',
  },
});
