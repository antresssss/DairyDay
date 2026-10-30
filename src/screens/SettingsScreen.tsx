import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useCallback, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { Card } from '../components/Card';
import { PrimaryButton } from '../components/PrimaryButton';
import { exportAllDataJson, getProfile, saveProfile } from '../db';
import { todayISO } from '../format';
import { colors } from '../theme';

export function SettingsScreen() {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const profile = await getProfile();
        if (cancelled) {
          return;
        }
        setName(profile.farmer_name);
        setAddress(profile.farmer_address);
      })();
      return () => {
        cancelled = true;
      };
    }, [])
  );

  async function onSave() {
    setSaving(true);
    try {
      await saveProfile(name, address);
      Alert.alert('Saved', 'This name and address will appear on the ledger.');
    } catch (error) {
      Alert.alert('Could not save', String(error));
    } finally {
      setSaving(false);
    }
  }

  async function onExportJson() {
    setExporting(true);
    try {
      const payload = await exportAllDataJson();
      const fileName = `dairyday-export-${todayISO()}.json`;
      const file = new File(Paths.cache, fileName);
      if (file.exists) {
        try {
          file.delete();
        } catch {}
      }
      file.write(JSON.stringify(payload, null, 2));
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, {
          UTI: 'public.json',
          mimeType: 'application/json',
          dialogTitle: 'Export DairyDay data',
        });
      } else {
        Alert.alert('JSON ready', file.uri);
      }
    } catch (error) {
      Alert.alert('Export failed', String(error));
    } finally {
      setExporting(false);
    }
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Profile</Text>
      <Text style={styles.help}>Used only on the printed ledger header.</Text>
      <Card style={styles.form}>
        <Text style={styles.label}>Farmer name</Text>
        <TextInput
          onChangeText={setName}
          placeholder="e.g. Ramesh Patel"
          placeholderTextColor={colors.muted}
          style={styles.input}
          value={name}
        />
        <Text style={styles.label}>Farmer address</Text>
        <TextInput
          multiline
          onChangeText={setAddress}
          placeholder="Village, taluka, district"
          placeholderTextColor={colors.muted}
          style={[styles.input, styles.multiline]}
          value={address}
        />
      </Card>
      <PrimaryButton loading={saving} onPress={onSave} title="Save profile" />
      <PrimaryButton
        loading={exporting}
        onPress={onExportJson}
        title="Export data (JSON)"
        variant="ghost"
      />
    </View>
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
  help: {
    color: colors.muted,
    marginTop: -8,
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
    fontSize: 16,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  multiline: {
    minHeight: 88,
    textAlignVertical: 'top',
  },
});
