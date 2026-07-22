/**
 * BarbeiroAnalyticsTab — aba de analytics do barbeiro.
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth } from '../../../firebaseConfig';
import AnalyticsDashboard from '../../components/AnalyticsDashboard';
import { useTheme } from '../../context/ThemeContext';

export default function BarbeiroAnalyticsTab() {
  const { theme } = useTheme();
  const uid = auth.currentUser?.uid ?? '';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top']}>
      <View style={styles.container}>
        <AnalyticsDashboard barbeiroId={uid} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
