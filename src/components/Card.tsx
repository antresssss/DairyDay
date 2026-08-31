import { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, radius } from '../theme';

type Props = {
  children: ReactNode;
  style?: object;
};

export function Card({ children, style }: Props) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <Text style={styles.label}>{children}</Text>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderColor: colors.line,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: 16,
  },
  label: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
