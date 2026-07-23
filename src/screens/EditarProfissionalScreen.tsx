/**
 * EditarProfissionalScreen — dono cria ou edita um membro da equipe.
 * Sem `profissionalId`: cadastra um profissional novo (sem login próprio).
 * Com `profissionalId`: edita nome/especialidade e dá acesso rápido à
 * agenda, serviços e folgas desse profissional (reaproveitando as telas de
 * sempre, agora com o profissional selecionado via parâmetro de rota).
 */
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth } from '../../firebaseConfig';
import { getBarbeiro } from '../data/repositories/BarbeiroRepository';
import {
  getNegocioPorDono,
  criarProfissional,
  atualizarProfissional,
} from '../data/repositories/NegocioRepository';
import { useTheme, type Theme } from '../context/ThemeContext';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList, Barbeiro } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'EditarProfissional'>;

export default function EditarProfissionalScreen({ navigation, route }: Props) {
  const { theme } = useTheme();
  const s = getStyles(theme);
  const profissionalId = route.params?.profissionalId;

  const [loading, setLoading] = useState(!!profissionalId);
  const [saving, setSaving] = useState(false);
  const [nome, setNome] = useState('');
  const [especialidade, setEspecialidade] = useState('');
  const [profissional, setProfissional] = useState<Barbeiro | null>(null);

  useEffect(() => {
    if (!profissionalId) return;
    (async () => {
      try {
        const b = await getBarbeiro(profissionalId);
        setProfissional(b);
        setNome(b?.nome || '');
        setEspecialidade(b?.especialidade || '');
      } catch (error) {
        console.error('Erro ao carregar profissional:', error);
        Alert.alert('Erro', 'Não foi possível carregar os dados do profissional.');
      } finally {
        setLoading(false);
      }
    })();
  }, [profissionalId]);

  const handleSalvar = async () => {
    if (!nome.trim() || nome.trim().length < 2) {
      Alert.alert('Atenção', 'Digite o nome do profissional.');
      return;
    }

    setSaving(true);
    try {
      if (profissionalId) {
        await atualizarProfissional(profissionalId, {
          nome: nome.trim(),
          ...(especialidade.trim() ? { especialidade: especialidade.trim() } : {}),
        });
        Alert.alert('Sucesso!', 'Dados atualizados.');
        navigation.goBack();
        return;
      }

      const uid = auth.currentUser?.uid;
      const negocio = uid ? await getNegocioPorDono(uid) : null;
      if (!negocio) {
        Alert.alert('Erro', 'Você ainda não tem uma equipe criada.');
        return;
      }

      const novo = await criarProfissional(negocio.id, {
        nome: nome.trim(),
        especialidade: especialidade.trim() || undefined,
      });

      // Troca para o "modo edição" do próprio profissional recém-criado,
      // revelando os atalhos de agenda/serviços/folgas abaixo.
      navigation.replace('EditarProfissional', { profissionalId: novo.id });
    } catch (error) {
      console.error('Erro ao salvar profissional:', error);
      Alert.alert('Erro', 'Não foi possível salvar. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={s.container} edges={['bottom']}>
        <View style={s.centered}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <SafeAreaView style={s.container} edges={['bottom']}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <View style={s.formCard}>
            <Text style={s.label}>Nome do profissional</Text>
            <TextInput
              value={nome}
              onChangeText={setNome}
              style={s.input}
              placeholder="Ex.: João Silva"
              placeholderTextColor={theme.colors.textMuted}
              autoCapitalize="words"
            />

            <Text style={s.label}>Especialidade (opcional)</Text>
            <TextInput
              value={especialidade}
              onChangeText={setEspecialidade}
              style={s.input}
              placeholder="Ex.: Corte e barba, degradê"
              placeholderTextColor={theme.colors.textMuted}
              autoCapitalize="sentences"
            />

            <TouchableOpacity
              style={[s.primaryButton, saving && s.buttonDisabled]}
              onPress={handleSalvar}
              disabled={saving}
              accessibilityRole="button"
              accessibilityLabel={profissionalId ? 'Salvar alterações' : 'Cadastrar profissional'}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={s.primaryButtonText}>
                  {profissionalId ? 'Salvar alterações' : 'Cadastrar profissional'}
                </Text>
              )}
            </TouchableOpacity>
          </View>

          {profissionalId && profissional && (
            <View style={s.group}>
              <Text style={s.hint}>
                Configure a agenda e os serviços deste profissional — os
                clientes verão exatamente essas opções ao agendar com ele.
              </Text>

              <TouchableOpacity
                style={s.item}
                onPress={() => navigation.navigate('ConfigAgenda', { profissionalId, profissionalNome: nome })}
                accessibilityRole="button"
              >
                <Text style={s.itemIcon}>📅</Text>
                <Text style={s.itemLabel}>Horário de atendimento</Text>
                <Text style={s.chevron}>›</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={s.item}
                onPress={() => navigation.navigate('ConfigServicos', { profissionalId, profissionalNome: nome })}
                accessibilityRole="button"
              >
                <Text style={s.itemIcon}>✂️</Text>
                <Text style={s.itemLabel}>Serviços</Text>
                <Text style={s.chevron}>›</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[s.item, s.itemLast]}
                onPress={() => navigation.navigate('Folgas', { profissionalId, profissionalNome: nome })}
                accessibilityRole="button"
              >
                <Text style={s.itemIcon}>🚫</Text>
                <Text style={s.itemLabel}>Dias de folga</Text>
                <Text style={s.chevron}>›</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const getStyles = (theme: Theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: 16, paddingBottom: 32 },
  formCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    color: theme.colors.text,
    backgroundColor: theme.colors.background,
    marginBottom: 16,
  },
  primaryButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  buttonDisabled: { opacity: 0.6 },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  hint: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    lineHeight: 17,
    padding: 16,
    paddingBottom: 8,
  },
  group: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: theme.colors.surface,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
  },
  itemLast: { borderBottomWidth: 0 },
  itemIcon: { fontSize: 18, marginRight: 14 },
  itemLabel: { flex: 1, fontSize: 15, fontWeight: '600', color: theme.colors.text },
  chevron: { fontSize: 22, color: theme.colors.textMuted, marginLeft: 8 },
});
