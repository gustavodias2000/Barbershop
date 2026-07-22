/**
 * LoginScreen — visual premium Azul Profundo + Âmbar (v2).
 *
 * Novidades:
 *  • Animações de entrada: hero desliza de cima, card sobe do fundo
 *  • Mostrar/ocultar senha com toggle
 *  • Listras diagonais de fundo (referência à pole de barbearia)
 *  • Scale feedback ao pressionar o botão principal
 */
import React, { useState, useRef, useEffect } from 'react';
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
  Animated,
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

const { width: W, height: H } = Dimensions.get('window');

// ─── Paleta fixa — login sempre escuro ───────────────────────────────────────
const C = {
  bg:           '#0F1923',
  stripe:       'rgba(245,158,11,0.04)',
  card:         '#1A2735',
  cardBorder:   '#2A3F54',
  amber:        '#F59E0B',
  amberGlow:    'rgba(245,158,11,0.20)',
  amberDim:     'rgba(245,158,11,0.10)',
  amberShadow:  'rgba(245,158,11,0.45)',
  input:        '#1F3144',
  inputBorder:  '#2A3F54',
  text:         '#F8FAFC',
  textSec:      '#94A3B8',
  textMuted:    '#5C7A96',
  error:        '#EF4444',
  errorBg:      'rgba(239,68,68,0.10)',
  circle1:      'rgba(245,158,11,0.07)',
  circle2:      'rgba(245,158,11,0.04)',
  circle3:      'rgba(96,165,250,0.05)',
};

// ─── Listras diagonais ────────────────────────────────────────────────────────
const STRIPE_COUNT = 12;
const STRIPE_W = 2;
const STRIPE_GAP = W / STRIPE_COUNT;

export default function LoginScreen({ navigation }: Props) {
  const [email, setEmail]                 = useState('');
  const [senha, setSenha]                 = useState('');
  const [loading, setLoading]             = useState(false);
  const [errors, setErrors]               = useState<FormErrors>({});
  const [emailFocused, setEmailFocused]   = useState(false);
  const [senhaFocused, setSenhaFocused]   = useState(false);
  const [mostrarSenha, setMostrarSenha]   = useState(false);

  const senhaRef = useRef<TextInput>(null);

  // ── Animações de entrada ──
  const heroOpacity   = useRef(new Animated.Value(0)).current;
  const heroTranslateY = useRef(new Animated.Value(-24)).current;
  const cardOpacity   = useRef(new Animated.Value(0)).current;
  const cardTranslateY = useRef(new Animated.Value(32)).current;
  const btnScale      = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Usar timing (duração fixa) ao invés de spring para evitar que
    // o card ainda esteja se movendo quando o usuário toca nos inputs.
    Animated.parallel([
      Animated.timing(heroOpacity, {
        toValue: 1, duration: 400, useNativeDriver: true,
      }),
      Animated.timing(heroTranslateY, {
        toValue: 0, duration: 350, useNativeDriver: true,
      }),
      Animated.timing(cardOpacity, {
        toValue: 1, duration: 400, delay: 150, useNativeDriver: true,
      }),
      Animated.timing(cardTranslateY, {
        toValue: 0, duration: 350, delay: 150, useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const onPressIn = () =>
    Animated.spring(btnScale, { toValue: 0.96, useNativeDriver: true }).start();
  const onPressOut = () =>
    Animated.spring(btnScale, { toValue: 1, useNativeDriver: true }).start();

  // ── Validação ──
  const validateEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

  const validateForm = () => {
    const errs: FormErrors = {};
    if (!email.trim())               errs.email = 'Email é obrigatório';
    else if (!validateEmail(email.trim())) errs.email = 'Email inválido';
    if (!senha.trim())               errs.senha = 'Senha é obrigatória';
    else if (senha.length < 6)       errs.senha = 'Mínimo 6 caracteres';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const clearError = (field: keyof FormErrors) => {
    if (errors[field]) setErrors(p => ({ ...p, [field]: null }));
  };

  // ── Login ──
  const handleLogin = async () => {
    if (!validateForm()) return;
    setLoading(true);
    try {
      const { user } = await signInWithEmailAndPassword(auth, email.trim(), senha);
      const userData = await getProfile(user.uid);
      navigation.replace(userData?.tipo === 'barbeiro' ? 'Barbeiro' : 'Cliente');
    } catch (error: any) {
      let msg = 'Erro ao fazer login. Tente novamente.';
      switch (error.code) {
        case 'auth/user-not-found':         msg = 'Usuário não encontrado.'; break;
        case 'auth/wrong-password':
        case 'auth/invalid-credential':     msg = 'Email ou senha incorretos.'; break;
        case 'auth/invalid-email':          msg = 'Email inválido.'; break;
        case 'auth/user-disabled':          msg = 'Conta desabilitada.'; break;
        case 'auth/too-many-requests':      msg = 'Muitas tentativas. Aguarde.'; break;
        case 'auth/network-request-failed': msg = 'Sem conexão com internet.'; break;
      }
      Alert.alert('Erro no login', msg);
    } finally {
      setLoading(false);
    }
  };

  // ── Recuperar senha ──
  const handleForgotPassword = () => {
    if (!email.trim()) {
      Alert.alert('Recuperar senha', 'Digite seu email acima primeiro.');
      return;
    }
    if (!validateEmail(email.trim())) {
      Alert.alert('Email inválido', 'Digite um email válido para continuar.');
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
                ? 'Nenhuma conta com este email.'
                : 'Não foi possível enviar o email.');
            }
          },
        },
      ],
    );
  };

  return (
    // Android: edges apenas 'top' — bottom é gerenciado pelo adjustResize do AndroidManifest.
    // 'bottom' junto com adjustResize causa duplo recálculo de inset ao abrir o teclado.
    <SafeAreaView style={s.safeArea} edges={['top']}>

      {/* ── Listras diagonais de fundo ── */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {Array.from({ length: STRIPE_COUNT }).map((_, i) => (
          <View
            key={i}
            style={[
              s.stripe,
              { left: i * STRIPE_GAP - H * 0.3 },
            ]}
          />
        ))}
      </View>

      {/* ── Círculos decorativos ── */}
      <View style={s.circleTopRight}  pointerEvents="none" />
      <View style={s.circleBottomLeft} pointerEvents="none" />
      <View style={s.circleCenter}    pointerEvents="none" />

      {/* No Android, o AndroidManifest já tem adjustResize — não usar behavior
          para evitar duplo ajuste que descarta o foco do input */}
      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >

          {/* ── Hero animado ── */}
          <Animated.View
            style={[
              s.hero,
              { opacity: heroOpacity, transform: [{ translateY: heroTranslateY }] },
            ]}
          >
            <View style={s.logoGlow}>
              <View style={s.logoCircle}>
                <Text style={s.logoEmoji}>💈</Text>
              </View>
            </View>
            <Text style={s.appName}>Barbershop</Text>
            <Text style={s.tagline}>Seu corte, do seu jeito</Text>

            {/* Divider decorativo âmbar */}
            <View style={s.divider}>
              <View style={s.dividerLine} />
              <View style={s.dividerDot} />
              <View style={s.dividerLine} />
            </View>
          </Animated.View>

          {/* ── Card animado ── */}
          <Animated.View
            style={[
              s.card,
              { opacity: cardOpacity, transform: [{ translateY: cardTranslateY }] },
            ]}
          >
            <Text style={s.cardTitle}>Entrar na conta</Text>

            {/* Email */}
            <View style={s.fieldGroup}>
              <Text style={s.label}>EMAIL</Text>
              <View style={[
                s.inputWrap,
                emailFocused  && s.inputWrapFocused,
                errors.email  && s.inputWrapError,
              ]}>
                <Text style={s.inputIcon}>✉️</Text>
                <TextInput
                  value={email}
                  onChangeText={t => { setEmail(t); clearError('email'); }}
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
                senhaFocused  && s.inputWrapFocused,
                errors.senha  && s.inputWrapError,
              ]}>
                <Text style={s.inputIcon}>🔒</Text>
                <TextInput
                  ref={senhaRef}
                  value={senha}
                  onChangeText={t => { setSenha(t); clearError('senha'); }}
                  style={s.input}
                  placeholder="Sua senha"
                  placeholderTextColor={C.textMuted}
                  secureTextEntry={!mostrarSenha}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="done"
                  onSubmitEditing={handleLogin}
                  onFocus={() => setSenhaFocused(true)}
                  onBlur={() => setSenhaFocused(false)}
                  accessibilityLabel="Campo de senha"
                />
                {/* Toggle mostrar/ocultar senha */}
                <TouchableOpacity
                  onPress={() => setMostrarSenha(v => !v)}
                  style={s.eyeBtn}
                  accessibilityRole="button"
                  accessibilityLabel={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={s.eyeIcon}>{mostrarSenha ? '🙈' : '👁️'}</Text>
                </TouchableOpacity>
              </View>
              {errors.senha ? (
                <View style={s.errorRow}>
                  <Text style={s.errorText}>⚠ {errors.senha}</Text>
                </View>
              ) : null}
            </View>

            {/* Botão principal com scale feedback */}
            <Animated.View style={{ transform: [{ scale: btnScale }] }}>
              <TouchableOpacity
                style={[s.loginBtn, loading && s.loginBtnDisabled]}
                onPress={handleLogin}
                onPressIn={onPressIn}
                onPressOut={onPressOut}
                disabled={loading}
                accessibilityRole="button"
                accessibilityLabel="Entrar no aplicativo"
                accessibilityState={{ disabled: loading }}
              >
                {loading
                  ? <ActivityIndicator color="#000" />
                  : <Text style={s.loginBtnText}>Entrar  →</Text>
                }
              </TouchableOpacity>
            </Animated.View>

            {/* Esqueci a senha */}
            <TouchableOpacity
              style={s.forgotBtn}
              onPress={handleForgotPassword}
              accessibilityRole="button"
            >
              <Text style={s.forgotText}>Esqueceu sua senha?</Text>
            </TouchableOpacity>
          </Animated.View>

          {/* ── Criar conta ── */}
          <Animated.View
            style={[
              s.registerSection,
              { opacity: cardOpacity },
            ]}
          >
            <Text style={s.registerPrompt}>Ainda não tem conta?</Text>
            <TouchableOpacity
              style={s.registerBtn}
              onPress={() => navigation.navigate('Register')}
              accessibilityRole="button"
              accessibilityLabel="Criar nova conta"
            >
              <Text style={s.registerBtnText}>Criar conta grátis</Text>
            </TouchableOpacity>
          </Animated.View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: C.bg,
  },
  flex: { flex: 1 },

  // ── Listras ──
  stripe: {
    position: 'absolute',
    top: 0,
    width: STRIPE_W,
    height: H * 1.6,
    backgroundColor: C.stripe,
    transform: [{ rotate: '20deg' }],
  },

  // ── Círculos ──
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
    marginBottom: 28,
  },
  logoGlow: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: C.amberGlow,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
  },
  logoCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: C.amber,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: C.amber,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 14,
    elevation: 10,
  },
  logoEmoji: { fontSize: 40 },
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
    marginBottom: 20,
  },
  // Divider âmbar decorativo
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dividerLine: {
    width: 48,
    height: 1,
    backgroundColor: C.amber,
    opacity: 0.4,
  },
  dividerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.amber,
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
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: C.text,
    marginBottom: 24,
    textAlign: 'center',
    letterSpacing: 0.2,
  },

  // ── Campos ──
  fieldGroup: { marginBottom: 18 },
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
    // Elevation FIXA — nunca muda com o foco.
    // No Android, mudar elevation no onFocus (0 → 4) gera evento de layout
    // que o sistema interpreta como motivo para fechar o teclado.
    elevation: 2,
  },
  inputWrapFocused: {
    // Apenas muda a cor da borda — sem alterar elevation, shadow ou dimensões.
    // Qualquer mudança de layout/elevation aqui conflita com adjustResize no Android.
    borderColor: C.amber,
    // shadowColor/shadowOffset/shadowOpacity/shadowRadius são iOS-only;
    // no Android não têm efeito, por isso foram removidos daqui.
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
  eyeBtn: {
    paddingLeft: 8,
    minHeight: 44,
    justifyContent: 'center',
  },
  eyeIcon: {
    fontSize: 18,
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
    shadowColor: C.amberShadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
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
    letterSpacing: 0.5,
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
