import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { Card } from '../components/Card';
import { DateStepper } from '../components/DateStepper';
import { getLedgerRows, getLoggedDates, getMonthSummary } from '../db';
import {
  addMonths,
  datesInRange,
  daysInMonth,
  formatLedgerDate,
  formatQty,
  formatRupees,
  monthBounds,
  monthYearLabel,
  todayISO,
} from '../format';
import { colors, radius } from '../theme';
import type { LedgerRow } from '../types';

export function DashboardScreen() {
  const [month, setMonth] = useState(todayISO());
  const [litres, setLitres] = useState(0);
  const [revenue, setRevenue] = useState(0);
  const [daysLogged, setDaysLogged] = useState(0);
  const [missed, setMissed] = useState<string[]>([]);
  const [rows, setRows] = useState<LedgerRow[]>([]);

  const { start, end } = monthBounds(month);
  const totalDays = daysInMonth(month);
  const currentMonth = todayISO().slice(0, 7);
  const selectedMonth = month.slice(0, 7);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const [summary, logged, ledger] = await Promise.all([
          getMonthSummary(start, end),
          getLoggedDates(start, end),
          getLedgerRows(start, end),
        ]);
        if (cancelled) {
          return;
        }
        const loggedSet = new Set(logged);
        const lastCountable = todayISO() < end ? todayISO() : end;
        const missing = datesInRange(start, lastCountable).filter((date) => !loggedSet.has(date));
        setLitres(summary.total_litres);
        setRevenue(summary.total_revenue);
        setDaysLogged(summary.days_logged);
        setMissed(missing);
        setRows(ledger);
      })();
      return () => {
        cancelled = true;
      };
    }, [start, end])
  );

  const maxTotal = Math.max(...rows.map((row) => row.total), 1);

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <DateStepper
        label="Month"
        value={monthYearLabel(month)}
        onPrev={() => setMonth((current) => addMonths(current, -1))}
        onNext={() => setMonth((current) => addMonths(current, 1))}
        nextDisabled={selectedMonth >= currentMonth}
      />

      <View style={styles.stats}>
        <Card style={styles.stat}>
          <Text style={styles.statLabel}>Total litres</Text>
          <Text style={styles.statValue}>{formatQty(litres)} L</Text>
        </Card>
        <Card style={styles.stat}>
          <Text style={styles.statLabel}>Revenue</Text>
          <Text style={styles.statValue}>{formatRupees(revenue)}</Text>
        </Card>
      </View>

      <Card>
        <Text style={styles.statLabel}>Days logged</Text>
        <Text style={styles.days}>
          {daysLogged} of {totalDays} · {missed.length} missed
        </Text>
        {missed.length > 0 ? (
          <Text style={styles.missed}>
            Missed: {missed.map((date) => formatLedgerDate(date).split('/')[0]).join(', ')}
          </Text>
        ) : (
          <Text style={styles.missed}>
            {daysLogged === totalDays ? 'Every day this month is logged.' : 'No missed days so far this month.'}
          </Text>
        )}
      </Card>

      <Text style={styles.chartTitle}>Daily totals</Text>
      {rows.length === 0 ? (
        <Text style={styles.empty}>No entries this month yet.</Text>
      ) : (
        rows.map((row) => (
          <View key={row.date} style={styles.barRow}>
            <Text style={styles.barLabel}>{formatLedgerDate(row.date).split('/')[0]}</Text>
            <View style={styles.barTrack}>
              <View style={[styles.barFill, { width: `${(row.total / maxTotal) * 100}%` }]} />
            </View>
            <Text style={styles.barValue}>{formatQty(row.total)}</Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.bg,
    gap: 14,
    padding: 20,
    paddingBottom: 40,
  },
  stats: {
    flexDirection: 'row',
    gap: 10,
  },
  stat: {
    flex: 1,
  },
  statLabel: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '600',
  },
  statValue: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: '800',
    marginTop: 6,
  },
  days: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: '800',
    marginTop: 6,
  },
  missed: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 8,
  },
  chartTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '800',
    marginTop: 4,
  },
  empty: {
    color: colors.muted,
  },
  barRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  barLabel: {
    color: colors.muted,
    fontVariant: ['tabular-nums'],
    width: 22,
  },
  barTrack: {
    backgroundColor: colors.line,
    borderRadius: radius.sm,
    flex: 1,
    height: 12,
    overflow: 'hidden',
  },
  barFill: {
    backgroundColor: colors.primary,
    height: 12,
  },
  barValue: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: '700',
    width: 48,
    textAlign: 'right',
  },
});
