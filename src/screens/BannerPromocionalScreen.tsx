/**
 * BannerPromocionalScreen — o barbeiro configura um banner promocional
 * exibido no topo da tela de agendamento (AgendamentoScreen) para os
 * clientes que estão prestes a marcar um horário. Gap competitivo com o
 * Masters ("banner promocional").
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth } from '../../firebaseConfig';
import { upsertBarbeiro, getBarbeiro } from '../data/repositories/BarbeiroRepository';
import { useTheme, type Theme } from '../context/ThemeContext';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'BannerPromocional'>;

export default function BannerPromocionalScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const s = getStyles(theme);
  const uid = auth.currentUser?.uid;

  const [texto, setTexto] = useState('');
  const [ativo, setAtivo] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    try {
      if (!uid) return;
      const barbeiro = await getBarbeiro(uid);
      if (barbeiro?.bannerPromocional) {
        setTexto(barbeiro.bannerPromocional.texto || '');
        setAtivo(!!barbeiro.bannerPromocional.ativo);
      }
    } catch (error) {
      console.error('Erro ao carregar banner:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (ativo && !texto.trim()) {
      Alert.alert('Atenção', 'Escreva o texto do banner antes de ativá-lo.');
      return;
    }
    setSaving(true);
    try {
      if (!uid) return;
      await upsertBarbeiro(uid, {
        bannerPromocional: { texto: texto.trim(), ativo },
      });
      Alert.alert('Sucesso!', 'Banner promocional salvo.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      console.error('Erro ao salvar banner:', error);
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
    <SafeAreaView style={s.container} edges={['bottom']}>
      <View style={s.scroll}>
        <View style={s.card}>
          <View style={s.rowBetween}>
            <View style={{ flex: 1 }}>
              <Text style={s.cardTitle}>Banner Promocional</Text>
              <Text style={s.hint}>
                Exibido no topo da tela quando um cliente for agendar com você. Use para avisar sobre
                promoções, descontos ou novidades.
              </Text>
            </View>
            <Switch
              value={ativo}
              onValueChange={setAtivo}
              trackColor={{ true: theme.colors.primary }}
              thumbColor="#fff"
            />
          </View>

          <TextInput
            value={texto}
            onChangeText={setTexto}
            style={s.textArea}
            placeholder="Ex.: 🔥 Corte + Barba com 15% OFF até domingo!"
            placeholderTextColor={theme.colors.textMuted}
            multiline
            numberOfLines={3}
            maxLength={140}
          />
          <Text style={s.charCount}>{texto.length}/140</Text>

          {ativo && texto.trim() ? (
            <View style={s.preview}>
              <Text style={s.previewLabel}>Prévia:</Text>
              <View style={s.previewBanner}>
                <Text style={s.previewIcon}>🏷️</Text>
                <Text style={s.previewText}>{texto}</Text>
              </View>
            </View>
          ) : null}
        </View>

        <TouchableOpacity
          style={[s.saveButton, saving && s.buttonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveButtonText}>Salvar</Text>}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const getStyles = (theme: Theme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    scroll: { padding: 16 },
    card: {
      backgroundColor: theme.colors.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
    },
    rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, gap: 12 },
    cardTitle: { fontSize: 16, fontWeight: '700', color: theme.colors.text, marginBottom: 4 },
    hint: { fontSize: 12, color: theme.colors.textSecondary, lineHeight: 17 },
    textArea: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 14,
      color: theme.colors.text,
      backgroundColor: theme.colors.surfaceVariant,
      minHeight: 80,
      textAlignVertical: 'top',
    },
    charCount: { fontSize: 11, color: theme.colors.textMuted, textAlign: 'right', marginTop: 4 },
    preview: { marginTop: 16 },
    previewLabel: { fontSize: 12, fontWeight: '700', color: theme.colors.textMuted, marginBottom: 6 },
    previewBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.primary,
      borderRadius: 10,
      padding: 14,
    },
    previewIcon: { fontSize: 18, marginRight: 10 },
    previewText: { flex: 1, fontSize: 14, fontWeight: '700', color: '#fff', lineHeight: 19 },
    saveButton: {
      backgroundColor: theme.colors.primary,
      borderRadius: 10,
      paddingVertical: 16,
      alignItems: 'center',
      minHeight: 52,
      justifyContent: 'center',
    },
    saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
    buttonDisabled: { opacity: 0.6 },
  });
