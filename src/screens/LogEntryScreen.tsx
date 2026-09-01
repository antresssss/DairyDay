import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Card } from '../components/Card';
import { DateStepper } from '../components/DateStepper';
import { PrimaryButton } from '../components/PrimaryButton';
import { getEntryByDate, getLatestRate, upsertShift } from '../db';
import { addDays, formatLedgerDate, todayISO } from '../format';
import { colors } from '../theme';
import type { RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'LogEntry'>;

export function LogEntryScreen({ navigation, route }: Props) {
  const { shift } = route.params;
  const [date, setDate] = useState(todayISO());
  const [litres, setLitres] = useState('');
  const [rate, setRate] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [entry, latestRate] = await Promise.all([getEntryByDate(date), getLatestRate()]);
      if (cancelled) {
        return;
      }
      const existingLitres = shift === 'morning' ? entry?.morning_litres : entry?.afternoon_litres;
      setLitres(existingLitres != null ? String(existingLitres) : '');
      setRate(String(entry?.rate ?? latestRate ?? ''));
    })();
    return () => {
      cancelled = true;
    };
  }, [date, shift]);

  const today = todayISO();
  const shiftLabel = shift === 'morning' ? 'Morning' : 'Evening';

  async function onSave() {
    const trimmedLitres = litres.trim();
    if (trimmedLitres.length === 0) {
      Alert.alert('Check litres', 'Please enter milk litres.');
      return;
    }
    const litresValue = Number(trimmedLitres);
    const rateValue = Number(rate);
    if (!Number.isFinite(litresValue) || litresValue < 0) {
      Alert.alert('Check litres', 'Enter a litres value of 0 or greater.');
      return;
    }
    if (!Number.isFinite(rateValue) || rateValue <= 0) {
      Alert.alert('Check rate', 'Enter a rate in Rs. per litre greater than 0.');
      return;
    }
    setSaving(true);
    try {
      await upsertShift({ date, shift, litres: litresValue, rate: rateValue });
      navigation.goBack();
    } catch (error) {
      Alert.alert('Could not save', String(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.title}>Log {shiftLabel} Milk</Text>
      <DateStepper
        label="Date"
        value={formatLedgerDate(date)}
        onPrev={() => setDate((current) => addDays(current, -1))}
        onNext={() => setDate((current) => addDays(current, 1))}
        nextDisabled={date >= today}
      />

      <Card style={styles.form}>
        <Text style={styles.label}>Litres</Text>
        <TextInput
          keyboardType="decimal-pad"
          onChangeText={setLitres}
          placeholder="e.g. 100"
          placeholderTextColor={colors.muted}
          style={styles.input}
          value={litres}
        />
        <Text style={styles.label}>Rate (Rs. per litre)</Text>
        <TextInput
          keyboardType="decimal-pad"
          onChangeText={setRate}
          placeholder="e.g. 60"
          placeholderTextColor={colors.muted}
          style={styles.input}
          value={rate}
        />
      </Card>

      <PrimaryButton
        loading={saving}
        onPress={onSave}
        title={`Save ${shiftLabel} entry`}
        variant={shift === 'afternoon' ? 'evening' : 'primary'}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.bg,
    flex: 1,
    gap: 16,
    padding: 20,
  },
  title: {
    color: colors.ink,
    fontSize: 22,
    fontWeight: '800',
  },
  form: {
    gap: 10,
  },
  label: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '600',
  },
  input: {
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: 10,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 18,
    fontWeight: '600',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
});
