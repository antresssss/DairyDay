import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { Card } from '../components/Card';
import { DateStepper } from '../components/DateStepper';
import { PrimaryButton } from '../components/PrimaryButton';
import { getLedgerRows, getProfile } from '../db';
import {
  addDays,
  formatLedgerDate,
  formatQty,
  formatRupees,
  monthBounds,
  todayISO,
} from '../format';
import { buildLedgerHtml } from '../ledgerHtml';
import { colors } from '../theme';
import type { LedgerRow } from '../types';

export function LedgerScreen() {
  const bounds = monthBounds(todayISO());
  const [start, setStart] = useState(bounds.start);
  const [end, setEnd] = useState(bounds.end);
  const [rows, setRows] = useState<LedgerRow[]>([]);
  const [farmerName, setFarmerName] = useState('');
  const [farmerAddress, setFarmerAddress] = useState('');
  const [exporting, setExporting] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const from = start <= end ? start : end;
        const to = start <= end ? end : start;
        const [ledger, profile] = await Promise.all([getLedgerRows(from, to), getProfile()]);
        if (cancelled) {
          return;
        }
        setRows(ledger);
        setFarmerName(profile.farmer_name);
        setFarmerAddress(profile.farmer_address);
      })();
      return () => {
        cancelled = true;
      };
    }, [start, end])
  );

  const morningTotal = rows.reduce((sum, row) => sum + (row.morning_litres ?? 0), 0);
  const afternoonTotal = rows.reduce((sum, row) => sum + (row.afternoon_litres ?? 0), 0);
  const litresTotal = rows.reduce((sum, row) => sum + row.total, 0);
  const amountTotal = rows.reduce((sum, row) => sum + row.amount, 0);
  const rate = rows[0]?.rate ?? 0;

  async function exportPdf() {
    if (rows.length === 0) {
      Alert.alert('Nothing to export', 'Log some milk in this date range first.');
      return;
    }
    setExporting(true);
    try {
      const from = start <= end ? start : end;
      const to = start <= end ? end : start;
      const html = buildLedgerHtml({
        start: from,
        end: to,
        farmerName,
        farmerAddress,
        rows,
      });
      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          UTI: '.pdf',
          mimeType: 'application/pdf',
          dialogTitle: 'Send milk ledger',
        });
      } else {
        Alert.alert('PDF ready', uri);
      }
    } catch (error) {
      Alert.alert('Export failed', String(error));
    } finally {
      setExporting(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.screen} horizontal={false}>
      <DateStepper
        label="From"
        value={formatLedgerDate(start)}
        onPrev={() => setStart((current) => addDays(current, -1))}
        onNext={() => setStart((current) => addDays(current, 1))}
      />
      <DateStepper
        label="To"
        value={formatLedgerDate(end)}
        onPrev={() => setEnd((current) => addDays(current, -1))}
        onNext={() => setEnd((current) => addDays(current, 1))}
      />

      <PrimaryButton loading={exporting} onPress={exportPdf} title="Export PDF & share" />

      <Card>
        <Text style={styles.title}>
          {farmerName || 'Set farmer name in Settings'}
          {farmerAddress ? `, ${farmerAddress}` : ''}
        </Text>
        {rows.length === 0 ? (
          <Text style={styles.empty}>No rows in this range.</Text>
        ) : (
          <ScrollView horizontal>
            <View>
              <View style={[styles.tr, styles.head]}>
                <Text style={[styles.th, styles.dateCol]}>Date</Text>
                <Text style={styles.th}>Morning</Text>
                <Text style={styles.th}>Afternoon</Text>
                <Text style={styles.th}>Total</Text>
                <Text style={styles.th}>Rate</Text>
                <Text style={styles.th}>Amount</Text>
              </View>
              {rows.map((row) => (
                <View key={row.date} style={styles.tr}>
                  <Text style={[styles.td, styles.dateCol]}>{formatLedgerDate(row.date)}</Text>
                  <Text style={styles.td}>{formatQty(row.morning_litres)}</Text>
                  <Text style={styles.td}>{formatQty(row.afternoon_litres)}</Text>
                  <Text style={styles.td}>{formatQty(row.total)}</Text>
                  <Text style={styles.td}>{formatQty(row.rate)}</Text>
                  <Text style={styles.td}>{formatQty(row.amount)}</Text>
                </View>
              ))}
              <View style={[styles.tr, styles.total]}>
                <Text style={[styles.td, styles.dateCol, styles.bold]}>TOTAL</Text>
                <Text style={[styles.td, styles.bold]}>{formatQty(morningTotal)}</Text>
                <Text style={[styles.td, styles.bold]}>{formatQty(afternoonTotal)}</Text>
                <Text style={[styles.td, styles.bold]}>{formatQty(litresTotal)}</Text>
                <Text style={[styles.td, styles.bold]}>{formatQty(rate)}</Text>
                <Text style={[styles.td, styles.bold]}>{formatRupees(amountTotal)}</Text>
              </View>
            </View>
          </ScrollView>
        )}
      </Card>
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
  title: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 12,
  },
  empty: {
    color: colors.muted,
  },
  tr: {
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    flexDirection: 'row',
  },
  head: {
    backgroundColor: colors.bg,
  },
  total: {
    backgroundColor: colors.goldSoft,
  },
  th: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
    padding: 8,
    width: 78,
  },
  td: {
    color: colors.ink,
    fontSize: 12,
    padding: 8,
    width: 78,
  },
  dateCol: {
    width: 88,
  },
  bold: {
    fontWeight: '800',
  },
});
