/**
 * BarbeiroPerfilTab — aba de perfil do barbeiro.
 * Mostra dados do perfil e opções: editar perfil, privacidade e sair.
 */
import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth } from '../../../firebaseConfig';
import useUserProfile from '../../hooks/useUserProfile';
import { useTheme, type Theme } from '../../context/ThemeContext';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../types';

type Props = CompositeScreenProps<
  BottomTabScreenProps<any, 'Perfil'>,
  NativeStackScreenProps<RootStackParamList>
>;

export default function BarbeiroPerfilTab({ navigation }: Props) {
  const { theme, themeMode, toggleTheme } = useTheme();
  const s = getStyles(theme);
  const { profile } = useUserProfile();

  const nome = profile?.nome || auth.currentUser?.email?.split('@')[0] || 'Barbeiro';
  const email = auth.currentUser?.email || '';
  const inicial = nome.charAt(0).toUpperCase();

  const handleLogout = () => {
    Alert.alert(
      'Sair do aplicativo',
      'Deseja realmente sair?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sair',
          style: 'destructive',
          onPress: async () => {
            await auth.signOut();
            navigation.replace('Login');
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={s.header}>
        <Text style={s.title}>Perfil</Text>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Avatar e nome */}
        <View style={s.avatarSection}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>{inicial}</Text>
          </View>
          <Text style={s.nome}>{nome}</Text>
          <Text style={s.email}>{email}</Text>
          <View style={s.badge}>
            <Text style={s.badgeText}>✂️ Barbeiro</Text>
          </View>
        </View>

        {/* Ações do perfil */}
        <Text style={s.sectionLabel}>CONTA</Text>
        <View style={s.group}>
          <TouchableOpacity
            style={s.item}
            onPress={() => navigation.navigate('Perfil')}
            accessibilityRole="button"
          >
            <Text style={s.itemIcon}>✏️</Text>
            <Text style={s.itemLabel}>Editar Perfil</Text>
            <Text style={s.chevron}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={s.item}
            onPress={() => navigation.navigate('Privacidade')}
            accessibilityRole="button"
          >
            <Text style={s.itemIcon}>🔒</Text>
            <Text style={s.itemLabel}>Política de Privacidade</Text>
            <Text style={s.chevron}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Tema */}
        <Text style={[s.sectionLabel, { marginTop: 24 }]}>APARÊNCIA</Text>
        <View style={s.group}>
          {(['system', 'dark', 'light'] as const).map((mode) => {
            const labels = { system: '🌗 Automático', dark: '🌙 Escuro', light: '☀️ Claro' };
            return (
              <TouchableOpacity
                key={mode}
                style={s.item}
                onPress={() => toggleTheme(mode)}
                accessibilityRole="button"
              >
                <Text style={s.itemLabel}>{labels[mode]}</Text>
                {themeMode === mode && <Text style={s.checkmark}>✓</Text>}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Sair */}
        <TouchableOpacity
          style={s.logoutButton}
          onPress={handleLogout}
          accessibilityRole="button"
          accessibilityLabel="Sair do aplicativo"
        >
          <Text style={s.logoutText}>🚪  Sair do aplicativo</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (theme: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: theme.colors.text,
  },
  scroll: {
    padding: 16,
    paddingBottom: 40,
  },
  avatarSection: {
    alignItems: 'center',
    paddingVertical: 28,
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '800',
    color: '#000',
  },
  nome: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 4,
  },
  email: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 10,
  },
  badge: {
    backgroundColor: theme.colors.surfaceVariant,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 5,
  },
  badgeText: {
    fontSize: 13,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.primary,
    letterSpacing: 1,
    marginBottom: 8,
    marginLeft: 4,
  },
  group: {
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
    minHeight: 52,
  },
  itemIcon: {
    fontSize: 18,
    marginRight: 12,
  },
  itemLabel: {
    flex: 1,
    fontSize: 15,
    color: theme.colors.text,
    fontWeight: '500',
  },
  chevron: {
    fontSize: 22,
    color: theme.colors.textMuted,
  },
  checkmark: {
    fontSize: 18,
    color: theme.colors.primary,
    fontWeight: '700',
  },
  logoutButton: {
    marginTop: 28,
    backgroundColor: theme.colors.error,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    minHeight: 54,
    justifyContent: 'center',
  },
  logoutText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
