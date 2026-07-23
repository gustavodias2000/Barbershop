/**
 * EquipeScreen — painel do dono para gerenciar o negócio multi-profissional.
 *
 * Sem equipe ainda: mostra um CTA para "transformar" o perfil atual em um
 * negócio com equipe (não é destrutivo — o próprio dono vira o primeiro
 * membro, papel 'dono', igual funcionava antes).
 * Com equipe: lista os profissionais, permite ativar/desativar e adicionar
 * novos (que não precisam de login próprio — ver NegocioRepository).
 */
import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { auth } from '../../firebaseConfig';
import {
  getNegocioPorDono,
  listarMembros,
  listarProfissionaisDoNegocio,
  criarNegocio,
  definirAtivoProfissional,
} from '../data/repositories/NegocioRepository';
import { useTheme, type Theme } from '../context/ThemeContext';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList, Barbeiro, MembroEquipe, Negocio } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Equipe'>;

interface ProfissionalComPapel {
  barbeiro: Barbeiro;
  membro?: MembroEquipe;
}

export default function EquipeScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const s = getStyles(theme);
  const uid = auth.currentUser?.uid;

  const [loading, setLoading] = useState(true);
  const [negocio, setNegocio] = useState<Negocio | null>(null);
  const [profissionais, setProfissionais] = useState<ProfissionalComPapel[]>([]);

  // Criação do negócio
  const [nomeNegocio, setNomeNegocio] = useState('');
  const [criando, setCriando] = useState(false);

  const carregar = useCallback(async () => {
    if (!uid) return;
    try {
      const meuNegocio = await getNegocioPorDono(uid);
      setNegocio(meuNegocio);
      if (meuNegocio) {
        const [barbeiros, membros] = await Promise.all([
          listarProfissionaisDoNegocio(meuNegocio.id),
          listarMembros(meuNegocio.id),
        ]);
        const membrosPorId = new Map(membros.map((m) => [m.barbeiroId, m]));
        const combinados = barbeiros
          .map((b) => ({ barbeiro: b, membro: membrosPorId.get(b.id) }))
          .sort((a, b) => {
            if (a.membro?.papel === 'dono') return -1;
            if (b.membro?.papel === 'dono') return 1;
            return (a.barbeiro.nome || '').localeCompare(b.barbeiro.nome || '');
          });
        setProfissionais(combinados);
      } else {
        setProfissionais([]);
      }
    } catch (error) {
      console.error('Erro ao carregar equipe:', error);
      Alert.alert('Erro', 'Não foi possível carregar sua equipe.');
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar]),
  );

  const handleCriarNegocio = async () => {
    if (!uid) return;
    if (!nomeNegocio.trim() || nomeNegocio.trim().length < 2) {
      Alert.alert('Atenção', 'Digite o nome da sua barbearia/negócio.');
      return;
    }
    setCriando(true);
    try {
      const novo = await criarNegocio(uid, nomeNegocio.trim());
      setNegocio(novo);
      await carregar();
    } catch (error) {
      console.error('Erro ao criar negócio:', error);
      Alert.alert('Erro', 'Não foi possível criar sua equipe. Tente novamente.');
    } finally {
      setCriando(false);
    }
  };

  const toggleAtivo = async (barbeiroId: string, ativoAtual: boolean) => {
    if (!negocio) return;
    try {
      await definirAtivoProfissional(negocio.id, barbeiroId, !ativoAtual);
      setProfissionais((prev) =>
        prev.map((p) =>
          p.barbeiro.id === barbeiroId
            ? { ...p, barbeiro: { ...p.barbeiro, ativo: !ativoAtual }, membro: p.membro ? { ...p.membro, ativo: !ativoAtual } : p.membro }
            : p,
        ),
      );
    } catch (error) {
      console.error('Erro ao atualizar profissional:', error);
      Alert.alert('Erro', 'Não foi possível atualizar. Tente novamente.');
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

  if (!negocio) {
    return (
      <SafeAreaView style={s.container} edges={['bottom']}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <View style={s.introCard}>
            <Text style={s.introIcon}>👥</Text>
            <Text style={s.introTitle}>Transforme seu perfil em uma equipe</Text>
            <Text style={s.introText}>
              Cadastre outros profissionais da sua barbearia — cada um com a
              própria agenda e serviços — sem que precisem instalar o app ou
              ter uma senha. Você continua com o mesmo login de sempre.
            </Text>
          </View>

          <View style={s.formCard}>
            <Text style={s.label}>Nome da barbearia/negócio</Text>
            <TextInput
              value={nomeNegocio}
              onChangeText={setNomeNegocio}
              style={s.input}
              placeholder="Ex.: Barbearia do Zé"
              placeholderTextColor={theme.colors.textMuted}
              autoCapitalize="words"
            />
            <TouchableOpacity
              style={[s.primaryButton, criando && s.buttonDisabled]}
              onPress={handleCriarNegocio}
              disabled={criando}
              accessibilityRole="button"
              accessibilityLabel="Criar equipe"
            >
              {criando ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={s.primaryButtonText}>Criar equipe</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={s.scroll}>
        <Text style={s.negocioNome}>{negocio.nome}</Text>

        <View style={s.group}>
          {profissionais.map((p, i) => {
            const isDono = p.membro?.papel === 'dono';
            const ativo = p.barbeiro.ativo !== false;
            return (
              <TouchableOpacity
                key={p.barbeiro.id}
                style={[s.item, i === profissionais.length - 1 && s.itemLast]}
                onPress={() => navigation.navigate('EditarProfissional', { profissionalId: p.barbeiro.id })}
                accessibilityRole="button"
                accessibilityLabel={`Editar ${p.barbeiro.nome}`}
              >
                <View style={s.avatar}>
                  <Text style={s.avatarText}>
                    {(p.barbeiro.nome || '?').charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={s.itemText}>
                  <Text style={s.itemNome}>{p.barbeiro.nome || 'Sem nome'}</Text>
                  <Text style={s.itemDesc}>
                    {isDono ? 'Dono da barbearia' : (p.barbeiro.especialidade || 'Profissional')}
                  </Text>
                </View>
                {!isDono && (
                  <Switch
                    value={ativo}
                    onValueChange={() => toggleAtivo(p.barbeiro.id, ativo)}
                    trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                    accessibilityLabel={`${ativo ? 'Desativar' : 'Ativar'} ${p.barbeiro.nome}`}
                  />
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity
          style={s.addButton}
          onPress={() => navigation.navigate('EditarProfissional', undefined)}
          accessibilityRole="button"
          accessibilityLabel="Adicionar profissional"
        >
          <Text style={s.addButtonText}>+ Adicionar profissional</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={s.linkCard}
          onPress={() => navigation.navigate('Comissoes')}
          accessibilityRole="button"
          accessibilityLabel="Comissões e fechamento"
        >
          <Text style={s.linkIcon}>💰</Text>
          <View style={s.itemText}>
            <Text style={s.itemNome}>Comissões e fechamento</Text>
            <Text style={s.itemDesc}>Configure a comissão de cada profissional e veja o relatório</Text>
          </View>
          <Text style={s.chevron}>›</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (theme: Theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: 16, paddingBottom: 32 },
  introCard: {
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: 24,
    marginBottom: 16,
  },
  introIcon: { fontSize: 40, marginBottom: 12 },
  introTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  introText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  formCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: 16,
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
  negocioNome: {
    fontSize: 22,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 16,
  },
  group: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: theme.colors.surface,
    marginBottom: 16,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
  },
  itemLast: { borderBottomWidth: 0 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  itemText: { flex: 1 },
  itemNome: { fontSize: 15, fontWeight: '700', color: theme.colors.text },
  itemDesc: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },
  addButton: {
    borderWidth: 1,
    borderColor: theme.colors.primary,
    borderStyle: 'dashed',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 16,
  },
  addButtonText: { color: theme.colors.primary, fontSize: 15, fontWeight: '700' },
  linkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: 16,
  },
  linkIcon: { fontSize: 22, marginRight: 14 },
  chevron: { fontSize: 22, color: theme.colors.textMuted, marginLeft: 8 },
});
