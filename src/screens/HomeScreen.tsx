import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card } from '../components/Card';
import { PrimaryButton } from '../components/PrimaryButton';
import { getEntryByDate, getMonthSummary } from '../db';
import { formatQty, formatRupees, monthBounds, monthYearLabel, todayISO } from '../format';
import { colors } from '../theme';
import type { CollectionEntry, RootStackParamList } from '../types';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Home'>;
};

export function HomeScreen({ navigation }: Props) {
  const today = todayISO();
  const { start, end } = monthBounds(today);
  const [entry, setEntry] = useState<CollectionEntry | null>(null);
  const [litres, setLitres] = useState(0);
  const [revenue, setRevenue] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const [todayEntry, summary] = await Promise.all([
          getEntryByDate(today),
          getMonthSummary(start, end),
        ]);
        if (cancelled) {
          return;
        }
        setEntry(todayEntry);
        setLitres(summary.total_litres);
        setRevenue(summary.total_revenue);
      })();
      return () => {
        cancelled = true;
      };
    }, [today, start, end])
  );

  const morningDone = entry?.morning_litres != null;
  const eveningDone = entry?.afternoon_litres != null;

  return (
    <SafeAreaView style={styles.screen}>
      <Text style={styles.kicker}>DairyDay</Text>
      <Text style={styles.header}>
        {monthYearLabel(today)} · {formatQty(litres)} L · {formatRupees(revenue)}
      </Text>

      <Card>
        <Text style={styles.statusLabel}>Today</Text>
        <Text style={styles.status}>
          Morning {morningDone ? '✓' : '— not logged'} · Evening {eveningDone ? '✓' : '— not logged'}
        </Text>
      </Card>

      <View style={styles.actions}>
        <PrimaryButton
          title="Log Morning Milk"
          onPress={() => navigation.navigate('LogEntry', { shift: 'morning' })}
        />
        <PrimaryButton
          title="Log Evening Milk"
          variant="evening"
          onPress={() => navigation.navigate('LogEntry', { shift: 'afternoon' })}
        />
      </View>

      <View style={styles.links}>
        <Pressable onPress={() => navigation.navigate('Dashboard')} style={styles.link}>
          <Text style={styles.linkText}>View Dashboard</Text>
        </Pressable>
        <Pressable onPress={() => navigation.navigate('Ledger')} style={styles.link}>
          <Text style={styles.linkText}>Generate Ledger</Text>
        </Pressable>
        <Pressable onPress={() => navigation.navigate('Settings')} style={styles.link}>
          <Text style={styles.linkText}>Profile / Settings</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.bg,
    flex: 1,
    gap: 16,
    padding: 20,
  },
  kicker: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  header: {
    color: colors.ink,
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 30,
  },
  statusLabel: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
  },
  status: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '600',
  },
  actions: {
    gap: 10,
  },
  links: {
    gap: 8,
    marginTop: 8,
  },
  link: {
    paddingVertical: 8,
  },
  linkText: {
    color: colors.primaryDark,
    fontSize: 16,
    fontWeight: '700',
  },
});
