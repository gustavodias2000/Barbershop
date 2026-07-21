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
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../../firebaseConfig';
import { getProfile } from '../data/repositories/UsuarioRepository';
import { useTheme, type Theme } from '../context/ThemeContext';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

interface FormErrors {
  email?: string | null;
  senha?: string | null;
}

export default function LoginScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const s = getStyles(theme);

  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  const validateEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

  const validateForm = () => {
    const newErrors: FormErrors = {};
    if (!email.trim()) {
      newErrors.email = 'Email é obrigatório';
    } else if (!validateEmail(email.trim())) {
      newErrors.email = 'Email inválido';
    }
    if (!senha.trim()) {
      newErrors.senha = 'Senha é obrigatória';
    } else if (senha.length < 6) {
      newErrors.senha = 'Senha deve ter pelo menos 6 caracteres';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email.trim(), senha);
      const uid = userCredential.user.uid;

      const userData = await getProfile(uid);

      // Item 8.5: sem perfil no banco, o fallback é SEMPRE cliente.
      navigation.replace(userData?.tipo === 'barbeiro' ? 'Barbeiro' : 'Cliente');
    } catch (error: any) {
      console.error('Erro no login:', error);
      let errorMessage = 'Erro ao fazer login. Tente novamente.';

      switch (error.code) {
        case 'auth/user-not-found':
          errorMessage = 'Usuário não encontrado.';
          break;
        case 'auth/wrong-password':
        case 'auth/invalid-credential':
          errorMessage = 'Email ou senha incorretos.';
          break;
        case 'auth/invalid-email':
          errorMessage = 'Email inválido.';
          break;
        case 'auth/user-disabled':
          errorMessage = 'Conta desabilitada. Entre em contato com o suporte.';
          break;
        case 'auth/too-many-requests':
          errorMessage = 'Muitas tentativas. Aguarde alguns minutos e tente novamente.';
          break;
        case 'auth/network-request-failed':
          errorMessage = 'Sem conexão. Verifique sua internet.';
          break;
        default:
          errorMessage = 'Erro inesperado. Verifique sua conexão.';
      }

      Alert.alert('Erro no login', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = () => {
    if (!email.trim()) {
      Alert.alert('Recuperar senha', 'Digite seu email no campo acima e tente novamente.');
      return;
    }
    if (!validateEmail(email.trim())) {
      Alert.alert('Email inválido', 'Digite um email válido para recuperar a senha.');
      return;
    }

    Alert.alert(
      'Recuperar senha',
      `Enviar link de recuperação para:\n${email.trim()}`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Enviar',
          onPress: async () => {
            try {
              // languageCode já está em pt-BR (definido no firebaseConfig)
              await sendPasswordResetEmail(auth, email.trim());
              Alert.alert(
                'Email enviado!',
                'Verifique sua caixa de entrada e spam para redefinir sua senha.',
              );
            } catch (error: any) {
              console.error('Erro ao enviar reset:', error);
              let msg = 'Não foi possível enviar o email de recuperação.';
              if (error.code === 'auth/user-not-found') {
                msg = 'Nenhuma conta encontrada com este email.';
              }
              Alert.alert('Erro', msg);
            }
          },
        },
      ],
    );
  };

  const clearError = (field: keyof FormErrors) => {
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
          showsVerticalScrollIndicator={false}
        >
          {/* ── Cabeçalho visual ── */}
          <View style={s.hero}>
            <View style={s.logoCircle}>
              <Text style={s.logoEmoji}>💈</Text>
            </View>
            <Text style={s.appName}>Barbershop</Text>
            <Text style={s.tagline}>Agende seu horário com facilidade</Text>
          </View>

          {/* ── Formulário ── */}
          <View style={s.card}>
            <Text style={s.cardTitle}>Entrar na sua conta</Text>

            <View style={s.inputContainer}>
              <Text style={s.label}>Email</Text>
              <TextInput
                value={email}
                onChangeText={(text) => { setEmail(text); clearError('email'); }}
                style={[s.input, errors.email && s.inputError]}
                placeholder="seu@email.com"
                placeholderTextColor={theme.colors.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                accessibilityLabel="Campo de email"
                accessibilityHint="Digite seu endereço de email"
              />
              {errors.email ? <Text style={s.errorText}>{errors.email}</Text> : null}
            </View>

            <View style={s.inputContainer}>
              <Text style={s.label}>Senha</Text>
              <TextInput
                value={senha}
                onChangeText={(text) => { setSenha(text); clearError('senha'); }}
                style={[s.input, errors.senha && s.inputError]}
                placeholder="Sua senha"
                placeholderTextColor={theme.colors.textMuted}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                accessibilityLabel="Campo de senha"
                accessibilityHint="Digite sua senha de acesso"
              />
              {errors.senha ? <Text style={s.errorText}>{errors.senha}</Text> : null}
            </View>

            <TouchableOpacity
              style={[s.loginButton, loading && s.loginButtonDisabled]}
              accessibilityRole="button"
              accessibilityLabel="Entrar no aplicativo"
              accessibilityState={{ disabled: loading }}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={s.loginButtonText}>Entrar</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={s.forgotPassword}
              accessibilityRole="button"
              accessibilityLabel="Esqueci minha senha"
              onPress={handleForgotPassword}
            >
              <Text style={s.forgotPasswordText}>Esqueceu sua senha?</Text>
            </TouchableOpacity>
          </View>

          {/* ── Criar conta ── */}
          <View style={s.registerSection}>
            <Text style={s.registerPrompt}>Ainda não tem conta?</Text>
            <TouchableOpacity
              style={s.registerButton}
              accessibilityRole="button"
              accessibilityLabel="Criar nova conta"
              onPress={() => navigation.navigate('Register')}
            >
              <Text style={s.registerButtonText}>Criar conta grátis</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const getStyles = (theme: Theme) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    padding: 24,
    justifyContent: 'center',
  },

  /* ── Hero / Logo ── */
  hero: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  logoEmoji: {
    fontSize: 44,
  },
  appName: {
    fontSize: 34,
    fontWeight: 'bold',
    color: theme.colors.text,
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  tagline: {
    fontSize: 15,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },

  /* ── Card do formulário ── */
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.10,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 20,
    textAlign: 'center',
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: theme.colors.surfaceVariant,
    color: theme.colors.text,
    minHeight: 50,
  },
  inputError: {
    borderColor: theme.colors.error,
  },
  errorText: {
    color: theme.colors.error,
    fontSize: 13,
    marginTop: 4,
  },
  loginButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 8,
    minHeight: 52,
    justifyContent: 'center',
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.30,
    shadowRadius: 5,
    elevation: 4,
  },
  loginButtonDisabled: {
    backgroundColor: theme.colors.textMuted,
    shadowOpacity: 0,
    elevation: 0,
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  forgotPassword: {
    alignItems: 'center',
    marginTop: 16,
    paddingVertical: 8,
    minHeight: 44,
    justifyContent: 'center',
  },
  forgotPasswordText: {
    color: theme.colors.primary,
    fontSize: 14,
    fontWeight: '500',
  },

  /* ── Seção "criar conta" ── */
  registerSection: {
    alignItems: 'center',
    gap: 12,
  },
  registerPrompt: {
    fontSize: 15,
    color: theme.colors.textSecondary,
  },
  registerButton: {
    borderWidth: 2,
    borderColor: theme.colors.primary,
    borderRadius: 10,
    paddingVertical: 13,
    paddingHorizontal: 32,
    alignItems: 'center',
    minHeight: 52,
    justifyContent: 'center',
    width: '100%',
  },
  registerButtonText: {
    color: theme.colors.primary,
    fontSize: 16,
    fontWeight: '700',
  },
});
