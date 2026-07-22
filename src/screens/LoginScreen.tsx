/**
 * LoginScreen — redesenhada com visual premium: Azul Profundo + Âmbar.
 *
 * Fundo escuro fixo (independente do tema do sistema), círculos decorativos,
 * card semi-transparente, inputs com borda âmbar no foco e botão com brilho.
 */
import React, { useState, useRef } from 'react';
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
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../../firebaseConfig';
import { getProfile } from '../data/repositories/UsuarioRepository';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

interface FormErrors {
  email?: string | null;
  senha?: string | null;
}

const { width: W } = Dimensions.get('window');

// Cores fixas — login sempre escuro independente do tema
const C = {
  bg: '#0F1923',
  card: '#1A2735',
  cardBorder: '#2A3F54',
  amber: '#F59E0B',
  amberGlow: 'rgba(245,158,11,0.18)',
  amberDim: 'rgba(245,158,11,0.12)',
  input: '#1F3144',
  inputBorder: '#2A3F54',
  inputFocus: '#F59E0B',
  text: '#F8FAFC',
  textSec: '#94A3B8',
  textMuted: '#5C7A96',
  error: '#EF4444',
  errorBg: 'rgba(239,68,68,0.10)',
  white: '#fff',
  circle1: 'rgba(245,158,11,0.06)',
  circle2: 'rgba(245,158,11,0.04)',
  circle3: 'rgba(96,165,250,0.05)',
};

export default function LoginScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [emailFocused, setEmailFocused] = useState(false);
  const [senhaFocused, setSenhaFocused] = useState(false);

  const senhaRef = useRef<TextInput>(null);

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
      navigation.replace(userData?.tipo === 'barbeiro' ? 'Barbeiro' : 'Cliente');
    } catch (error: any) {
      console.error('Erro no login:', error);
      let msg = 'Erro ao fazer login. Tente novamente.';
      switch (error.code) {
        case 'auth/user-not-found':
          msg = 'Usuário não encontrado.'; break;
        case 'auth/wrong-password':
        case 'auth/invalid-credential':
          msg = 'Email ou senha incorretos.'; break;
        case 'auth/invalid-email':
          msg = 'Email inválido.'; break;
        case 'auth/user-disabled':
          msg = 'Conta desabilitada. Entre em contato com o suporte.'; break;
        case 'auth/too-many-requests':
          msg = 'Muitas tentativas. Aguarde alguns minutos.'; break;
        case 'auth/network-request-failed':
          msg = 'Sem conexão. Verifique sua internet.'; break;
        default:
          msg = 'Erro inesperado. Verifique sua conexão.';
      }
      Alert.alert('Erro no login', msg);
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
              await sendPasswordResetEmail(auth, email.trim());
              Alert.alert('Email enviado!', 'Verifique sua caixa de entrada e spam.');
            } catch (e: any) {
              Alert.alert('Erro', e.code === 'auth/user-not-found'
                ? 'Nenhuma conta encontrada com este email.'
                : 'Não foi possível enviar o email de recuperação.');
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

      {/* ── Círculos decorativos de fundo ── */}
      <View style={s.circleTopRight} pointerEvents="none" />
      <View style={s.circleBottomLeft} pointerEvents="none" />
      <View style={s.circleCenter} pointerEvents="none" />

      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >

          {/* ── Hero ── */}
          <View style={s.hero}>
            <View style={s.logoGlow}>
              <View style={s.logoCircle}>
                <Text style={s.logoEmoji}>💈</Text>
              </View>
            </View>
            <Text style={s.appName}>Barbershop</Text>
            <Text style={s.tagline}>Seu corte, do seu jeito</Text>
          </View>

          {/* ── Card formulário ── */}
          <View style={s.card}>
            <Text style={s.cardTitle}>Entrar na conta</Text>

            {/* Email */}
            <View style={s.fieldGroup}>
              <Text style={s.label}>EMAIL</Text>
              <View style={[
                s.inputWrap,
                emailFocused && s.inputWrapFocused,
                errors.email ? s.inputWrapError : null,
              ]}>
                <Text style={s.inputIcon}>✉️</Text>
                <TextInput
                  value={email}
                  onChangeText={(t) => { setEmail(t); clearError('email'); }}
                  style={s.input}
                  placeholder="seu@email.com"
                  placeholderTextColor={C.textMuted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="next"
                  onSubmitEditing={() => senhaRef.current?.focus()}
                  onFocus={() => setEmailFocused(true)}
                  onBlur={() => setEmailFocused(false)}
                  accessibilityLabel="Campo de email"
                />
              </View>
              {errors.email ? (
                <View style={s.errorRow}>
                  <Text style={s.errorText}>⚠ {errors.email}</Text>
                </View>
              ) : null}
            </View>

            {/* Senha */}
            <View style={s.fieldGroup}>
              <Text style={s.label}>SENHA</Text>
              <View style={[
                s.inputWrap,
                senhaFocused && s.inputWrapFocused,
                errors.senha ? s.inputWrapError : null,
              ]}>
                <Text style={s.inputIcon}>🔒</Text>
                <TextInput
                  ref={senhaRef}
                  value={senha}
                  onChangeText={(t) => { setSenha(t); clearError('senha'); }}
                  style={s.input}
                  placeholder="Sua senha"
                  placeholderTextColor={C.textMuted}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="done"
                  onSubmitEditing={handleLogin}
                  onFocus={() => setSenhaFocused(true)}
                  onBlur={() => setSenhaFocused(false)}
                  accessibilityLabel="Campo de senha"
                />
              </View>
              {errors.senha ? (
                <View style={s.errorRow}>
                  <Text style={s.errorText}>⚠ {errors.senha}</Text>
                </View>
              ) : null}
            </View>

            {/* Botão entrar */}
            <TouchableOpacity
              style={[s.loginBtn, loading && s.loginBtnDisabled]}
              onPress={handleLogin}
              disabled={loading}
              accessibilityRole="button"
              accessibilityLabel="Entrar no aplicativo"
              accessibilityState={{ disabled: loading }}
            >
              {loading ? (
                <ActivityIndicator color="#000" />
              ) : (
                <Text style={s.loginBtnText}>Entrar →</Text>
              )}
            </TouchableOpacity>

            {/* Esqueci senha */}
            <TouchableOpacity
              style={s.forgotBtn}
              onPress={handleForgotPassword}
              accessibilityRole="button"
            >
              <Text style={s.forgotText}>Esqueceu sua senha?</Text>
            </TouchableOpacity>
          </View>

          {/* ── Criar conta ── */}
          <View style={s.registerSection}>
            <Text style={s.registerPrompt}>Ainda não tem conta?</Text>
            <TouchableOpacity
              style={s.registerBtn}
              onPress={() => navigation.navigate('Register')}
              accessibilityRole="button"
              accessibilityLabel="Criar nova conta"
            >
              <Text style={s.registerBtnText}>Criar conta grátis</Text>
            </TouchableOpacity>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: C.bg,
  },
  flex: { flex: 1 },

  // ── Círculos decorativos ──
  circleTopRight: {
    position: 'absolute',
    width: W * 0.85,
    height: W * 0.85,
    borderRadius: W * 0.425,
    backgroundColor: C.circle1,
    top: -W * 0.25,
    right: -W * 0.3,
  },
  circleBottomLeft: {
    position: 'absolute',
    width: W * 0.7,
    height: W * 0.7,
    borderRadius: W * 0.35,
    backgroundColor: C.circle2,
    bottom: -W * 0.2,
    left: -W * 0.25,
  },
  circleCenter: {
    position: 'absolute',
    width: W * 0.5,
    height: W * 0.5,
    borderRadius: W * 0.25,
    backgroundColor: C.circle3,
    top: '35%',
    left: '25%',
  },

  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 32,
    justifyContent: 'center',
  },

  // ── Hero ──
  hero: {
    alignItems: 'center',
    paddingTop: 24,
    marginBottom: 36,
  },
  logoGlow: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: C.amberGlow,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  logoCircle: {
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: C.amber,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: C.amber,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 14,
    elevation: 10,
  },
  logoEmoji: {
    fontSize: 42,
  },
  appName: {
    fontSize: 36,
    fontWeight: '800',
    color: C.text,
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  tagline: {
    fontSize: 15,
    color: C.textSec,
    letterSpacing: 0.2,
  },

  // ── Card ──
  card: {
    backgroundColor: C.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.cardBorder,
    padding: 24,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: C.text,
    marginBottom: 24,
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  fieldGroup: {
    marginBottom: 18,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: C.amber,
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.input,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: C.inputBorder,
    paddingHorizontal: 14,
    minHeight: 52,
  },
  inputWrapFocused: {
    borderColor: C.inputFocus,
    shadowColor: C.amber,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  inputWrapError: {
    borderColor: C.error,
  },
  inputIcon: {
    fontSize: 16,
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: C.text,
    paddingVertical: 0,
  },
  errorRow: {
    marginTop: 6,
    backgroundColor: C.errorBg,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  errorText: {
    color: C.error,
    fontSize: 13,
    fontWeight: '500',
  },

  // ── Botão principal ──
  loginBtn: {
    backgroundColor: C.amber,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    minHeight: 54,
    justifyContent: 'center',
    shadowColor: C.amber,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 6,
  },
  loginBtnDisabled: {
    backgroundColor: C.textMuted,
    shadowOpacity: 0,
    elevation: 0,
  },
  loginBtnText: {
    color: '#000',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  forgotBtn: {
    alignItems: 'center',
    marginTop: 16,
    minHeight: 44,
    justifyContent: 'center',
  },
  forgotText: {
    color: C.textSec,
    fontSize: 14,
    fontWeight: '500',
  },

  // ── Criar conta ──
  registerSection: {
    alignItems: 'center',
    gap: 14,
  },
  registerPrompt: {
    fontSize: 15,
    color: C.textSec,
  },
  registerBtn: {
    borderWidth: 1.5,
    borderColor: C.amber,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 32,
    alignItems: 'center',
    minHeight: 52,
    justifyContent: 'center',
    width: '100%',
    backgroundColor: C.amberDim,
  },
  registerBtnText: {
    color: C.amber,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
