import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius } from '../theme';

type Props = {
  label: string;
  value: string;
  onPrev: () => void;
  onNext: () => void;
  nextDisabled?: boolean;
};

export function DateStepper({ label, value, onPrev, onNext, nextDisabled }: Props) {
  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.row}>
        <Pressable onPress={onPrev} style={styles.chip} accessibilityRole="button">
          <Text style={styles.chipText}>‹</Text>
        </Pressable>
        <Text style={styles.value}>{value}</Text>
        <Pressable
          onPress={onNext}
          disabled={nextDisabled}
          style={[styles.chip, nextDisabled && styles.chipDisabled]}
          accessibilityRole="button"
        >
          <Text style={[styles.chipText, nextDisabled && styles.chipTextDisabled]}>›</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 8,
  },
  label: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '600',
  },
  row: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderColor: colors.line,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  chip: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.sm,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  chipDisabled: {
    opacity: 0.35,
  },
  chipText: {
    color: colors.primaryDark,
    fontSize: 22,
    fontWeight: '700',
  },
  chipTextDisabled: {
    color: colors.muted,
  },
  value: {
    color: colors.ink,
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
});
