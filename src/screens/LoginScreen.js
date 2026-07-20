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
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../../firebase';
import { useTheme } from '../context/ThemeContext';

export default function LoginScreen({ navigation }) {
  const { theme } = useTheme();
  const s = getStyles(theme);

  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const validateEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

  const validateForm = () => {
    const newErrors = {};
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

      const userDoc = await getDoc(doc(db, 'usuarios', uid));

      if (userDoc.exists()) {
        const userData = userDoc.data();
        if (userData.tipo === 'barbeiro') {
          navigation.replace('Barbeiro');
        } else {
          navigation.replace('Cliente');
        }
      } else {
        const emailUser = userCredential.user.email || '';
        const tipo = emailUser.toLowerCase().includes('barbeiro') ? 'barbeiro' : 'cliente';
        navigation.replace(tipo === 'barbeiro' ? 'Barbeiro' : 'Cliente');
      }
    } catch (error) {
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
              await sendPasswordResetEmail(auth, email.trim());
              Alert.alert(
                'Email enviado!',
                'Verifique sua caixa de entrada e spam para redefinir sua senha.',
              );
            } catch (error) {
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
            <Text style={s.subtitle}>Faça seu login</Text>
          </View>

          <View style={s.form}>
            <View style={s.inputContainer}>
              <Text style={s.label}>Email</Text>
              <TextInput
                value={email}
                onChangeText={(text) => { setEmail(text); clearError('email'); }}
                style={[s.input, errors.email && s.inputError]}
                placeholder="Digite seu email"
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
                placeholder="Digite sua senha"
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
              style={[s.button, loading && s.buttonDisabled]}
              accessibilityRole="button"
              accessibilityLabel="Entrar no aplicativo"
              accessibilityState={{ disabled: loading }}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={s.buttonText}>Entrar</Text>
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

            <View style={s.divider}>
              <View style={s.dividerLine} />
              <Text style={s.dividerText}>ou</Text>
              <View style={s.dividerLine} />
            </View>

            <TouchableOpacity
              style={s.registerButton}
              accessibilityRole="button"
              accessibilityLabel="Criar nova conta"
              onPress={() => navigation.navigate('Register')}
            >
              <Text style={s.registerButtonText}>Criar nova conta</Text>
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
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
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
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 8,
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
    fontSize: 14,
    marginTop: 4,
  },
  button: {
    backgroundColor: theme.colors.primary,
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 10,
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
  forgotPassword: {
    alignItems: 'center',
    marginTop: 16,
    paddingVertical: 8,
    minHeight: 44,
    justifyContent: 'center',
  },
  forgotPasswordText: {
    color: theme.colors.primary,
    fontSize: 15,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: theme.colors.border,
  },
  dividerText: {
    marginHorizontal: 12,
    color: theme.colors.textSecondary,
    fontSize: 14,
  },
  registerButton: {
    borderWidth: 2,
    borderColor: theme.colors.primary,
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    minHeight: 52,
    justifyContent: 'center',
  },
  registerButtonText: {
    color: theme.colors.primary,
    fontSize: 16,
    fontWeight: '600',
  },
});
