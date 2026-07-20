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
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../../firebase';
import { maskPhone, formatPhoneToE164 } from '../utils/dateUtils';

export default function RegisterScreen({ navigation }) {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [tipo, setTipo] = useState('cliente'); // 'cliente' | 'barbeiro'
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
        senha
      );
      const { uid } = userCredential.user;

      // Salvar dados do usuário (incluindo role) no Firestore
      await setDoc(doc(db, 'usuarios', uid), {
        uid,
        nome: nome.trim(),
        email: email.trim().toLowerCase(),
        telefone: formatPhoneToE164(telefone),
        tipo, // 'cliente' ou 'barbeiro'
        createdAt: new Date(),
      });

      // Navegar para a tela correspondente ao tipo
      if (tipo === 'barbeiro') {
        navigation.replace('Barbeiro');
      } else {
        navigation.replace('Cliente');
      }
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
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.title}>Barbershop</Text>
          <Text style={styles.subtitle}>Criar nova conta</Text>
        </View>

        <View style={styles.form}>
          {/* Tipo de conta */}
          <Text style={styles.label}>Tipo de conta</Text>
          <View style={styles.tipoContainer}>
            <TouchableOpacity
              style={[styles.tipoButton, tipo === 'cliente' && styles.tipoButtonActive]}
              onPress={() => setTipo('cliente')}
            >
              <Text
                style={[
                  styles.tipoButtonText,
                  tipo === 'cliente' && styles.tipoButtonTextActive,
                ]}
              >
                ✂️ Cliente
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tipoButton, tipo === 'barbeiro' && styles.tipoButtonActive]}
              onPress={() => setTipo('barbeiro')}
            >
              <Text
                style={[
                  styles.tipoButtonText,
                  tipo === 'barbeiro' && styles.tipoButtonTextActive,
                ]}
              >
                💈 Barbeiro
              </Text>
            </TouchableOpacity>
          </View>

          {/* Nome */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Nome completo</Text>
            <TextInput
              value={nome}
              onChangeText={(t) => { setNome(t); clearError('nome'); }}
              style={[styles.input, errors.nome && styles.inputError]}
              placeholder="Seu nome completo"
              placeholderTextColor="#999"
              autoCapitalize="words"
              autoCorrect={false}
            />
            {errors.nome ? <Text style={styles.errorText}>{errors.nome}</Text> : null}
          </View>

          {/* Email */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              value={email}
              onChangeText={(t) => { setEmail(t); clearError('email'); }}
              style={[styles.input, errors.email && styles.inputError]}
              placeholder="seuemail@exemplo.com"
              placeholderTextColor="#999"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {errors.email ? <Text style={styles.errorText}>{errors.email}</Text> : null}
          </View>

          {/* Telefone */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Telefone / WhatsApp</Text>
            <TextInput
              value={telefone}
              onChangeText={(t) => { setTelefone(maskPhone(t)); clearError('telefone'); }}
              style={[styles.input, errors.telefone && styles.inputError]}
              placeholder="(11) 99999-9999"
              placeholderTextColor="#999"
              keyboardType="phone-pad"
              maxLength={15}
            />
            {errors.telefone ? <Text style={styles.errorText}>{errors.telefone}</Text> : null}
          </View>

          {/* Senha */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Senha</Text>
            <TextInput
              value={senha}
              onChangeText={(t) => { setSenha(t); clearError('senha'); }}
              style={[styles.input, errors.senha && styles.inputError]}
              placeholder="Mínimo 6 caracteres"
              placeholderTextColor="#999"
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />
            {errors.senha ? <Text style={styles.errorText}>{errors.senha}</Text> : null}
          </View>

          {/* Confirmar Senha */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Confirmar senha</Text>
            <TextInput
              value={confirmarSenha}
              onChangeText={(t) => { setConfirmarSenha(t); clearError('confirmarSenha'); }}
              style={[styles.input, errors.confirmarSenha && styles.inputError]}
              placeholder="Repita a senha"
              placeholderTextColor="#999"
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />
            {errors.confirmarSenha ? (
              <Text style={styles.errorText}>{errors.confirmarSenha}</Text>
            ) : null}
          </View>

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleRegister}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Criar conta</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.loginLink}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.loginLinkText}>
              Já tem conta?{' '}
              <Text style={styles.loginLinkBold}>Entrar</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
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
    color: '#2c3e50',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#7f8c8d',
  },
  form: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
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
    borderColor: '#ddd',
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
  },
  tipoButtonActive: {
    borderColor: '#3498db',
    backgroundColor: '#ebf5fb',
  },
  tipoButtonText: {
    fontSize: 15,
    color: '#7f8c8d',
    fontWeight: '600',
  },
  tipoButtonTextActive: {
    color: '#3498db',
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
    color: '#2c3e50',
  },
  inputError: {
    borderColor: '#e74c3c',
    backgroundColor: '#fdf2f2',
  },
  errorText: {
    color: '#e74c3c',
    fontSize: 13,
    marginTop: 4,
  },
  button: {
    backgroundColor: '#3498db',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    backgroundColor: '#bdc3c7',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  loginLink: {
    alignItems: 'center',
    marginTop: 20,
  },
  loginLinkText: {
    fontSize: 15,
    color: '#7f8c8d',
  },
  loginLinkBold: {
    color: '#3498db',
    fontWeight: '600',
  },
});
