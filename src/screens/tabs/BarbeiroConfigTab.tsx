/**
 * BarbeiroConfigTab — aba de configurações do barbeiro.
 * Lista todos os itens administrativos com navegação clara.
 */
import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme, type Theme } from '../../context/ThemeContext';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../types';

// Navigation type: tab screen que pode navegar para stack screens
type Props = CompositeScreenProps<
  BottomTabScreenProps<any, 'Config'>,
  NativeStackScreenProps<RootStackParamList>
>;

const ITENS = [
  {
    icon: '📅',
    label: 'Horário de Atendimento',
    desc: 'Configure dias, horários e intervalo de almoço',
    route: 'ConfigAgenda' as keyof RootStackParamList,
    destaque: true,
  },
  {
    icon: '✂️',
    label: 'Meus Serviços',
    desc: 'Cadastre serviços com duração e preço',
    route: 'ConfigServicos' as keyof RootStackParamList,
    destaque: true,
  },
  {
    icon: '💬',
    label: 'Templates WhatsApp',
    desc: 'Personalize mensagens de agendamento',
    route: 'TemplatesMensagem' as keyof RootStackParamList,
    destaque: false,
  },
  {
    icon: '🚫',
    label: 'Clientes Banidos',
    desc: 'Gerencie clientes que não podem agendar',
    route: 'ClientesBanidos' as keyof RootStackParamList,
    destaque: false,
  },
  {
    icon: '⏳',
    label: 'Lista de Espera',
    desc: 'Veja clientes aguardando horário disponível',
    route: 'ListaEspera' as keyof RootStackParamList,
    destaque: false,
  },
  {
    icon: '🔄',
    label: 'Recorrências',
    desc: 'Gerencie agendamentos periódicos de clientes fiéis',
    route: 'Recorrencias' as keyof RootStackParamList,
    destaque: false,
  },
  {
    icon: '🔲',
    label: 'QR Code',
    desc: 'Exiba o QR Code para clientes agendarem',
    route: 'QRCode' as keyof RootStackParamList,
    destaque: false,
  },
  {
    icon: '❓',
    label: 'Ajuda e Suporte',
    desc: 'FAQ e contato com o suporte Barbershop',
    route: 'Suporte' as keyof RootStackParamList,
    destaque: false,
  },
];

export default function BarbeiroConfigTab({ navigation }: Props) {
  const { theme } = useTheme();
  const s = getStyles(theme);

  const principal = ITENS.filter((i) => i.destaque);
  const outros = ITENS.filter((i) => !i.destaque);

  const renderItem = (item: typeof ITENS[0]) => (
    <TouchableOpacity
      key={item.route}
      style={s.item}
      onPress={() => navigation.navigate(item.route as any)}
      accessibilityRole="button"
      accessibilityLabel={item.label}
    >
      <View style={s.itemIconContainer}>
        <Text style={s.itemIcon}>{item.icon}</Text>
      </View>
      <View style={s.itemText}>
        <Text style={s.itemLabel}>{item.label}</Text>
        <Text style={s.itemDesc}>{item.desc}</Text>
      </View>
      <Text style={s.chevron}>›</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={s.header}>
        <Text style={s.title}>Configurações</Text>
        <Text style={s.subtitle}>Gerencie seu perfil administrativo</Text>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        <Text style={s.sectionLabel}>ESSENCIAL — Configure primeiro</Text>
        <View style={s.group}>
          {principal.map(renderItem)}
        </View>
        <Text style={s.sectionHint}>
          ⚠️ Sem horários e serviços cadastrados, seus clientes não conseguem agendar.
        </Text>

        <Text style={[s.sectionLabel, { marginTop: 24 }]}>AVANÇADO</Text>
        <View style={s.group}>
          {outros.map(renderItem)}
        </View>

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
  subtitle: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  scroll: {
    padding: 16,
    paddingBottom: 32,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.primary,
    letterSpacing: 1,
    marginBottom: 8,
    marginLeft: 4,
  },
  sectionHint: {
    fontSize: 12,
    color: theme.colors.warning,
    marginTop: 8,
    marginLeft: 4,
    lineHeight: 18,
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
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
  },
  itemIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: theme.colors.surfaceVariant,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  itemIcon: {
    fontSize: 20,
  },
  itemText: {
    flex: 1,
  },
  itemLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 2,
  },
  itemDesc: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    lineHeight: 17,
  },
  chevron: {
    fontSize: 22,
    color: theme.colors.textMuted,
    marginLeft: 8,
  },
});
