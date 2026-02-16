import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

export const Card = ({ title, children }: React.PropsWithChildren<{ title?: string }>) => (
  <View style={styles.card}>
    {title ? <Text style={styles.cardTitle}>{title}</Text> : null}
    {children}
  </View>
);

export const Row = ({ children }: React.PropsWithChildren) => <View style={styles.row}>{children}</View>;

export const Label = ({ children }: React.PropsWithChildren) => <Text style={styles.label}>{children}</Text>;

export const Input = (props: React.ComponentProps<typeof TextInput>) => (
  <TextInput {...props} style={[styles.input, props.style]} placeholderTextColor="#9aa2ad" />
);

export const Button = ({
  title,
  onPress,
  variant = 'primary',
}: {
  title: string;
  onPress: () => void | Promise<void>;
  variant?: 'primary' | 'secondary' | 'danger';
}) => (
  <Pressable
    onPress={onPress}
    style={[styles.button, variant === 'secondary' && styles.buttonSecondary, variant === 'danger' && styles.buttonDanger]}
  >
    <Text style={[styles.buttonText, variant !== 'primary' && styles.buttonTextAlt]}>{title}</Text>
  </Pressable>
);

export const SelectPill = ({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) => (
  <Pressable onPress={onPress} style={[styles.pill, selected && styles.pillSelected]}>
    <Text style={[styles.pillText, selected && styles.pillTextSelected]}>{label}</Text>
  </Pressable>
);

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e4e7ec',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
    color: '#223',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  label: {
    fontSize: 13,
    color: '#4b5563',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d0d7de',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#111827',
    backgroundColor: '#fff',
  },
  button: {
    backgroundColor: '#F77575',
    borderRadius: 10,
    paddingVertical: 11,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonSecondary: {
    backgroundColor: '#eef2ff',
  },
  buttonDanger: {
    backgroundColor: '#fee2e2',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
  },
  buttonTextAlt: {
    color: '#1f2937',
  },
  pill: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 6,
  },
  pillSelected: {
    borderColor: '#F77575',
    backgroundColor: '#dbeafe',
  },
  pillText: {
    color: '#374151',
    fontSize: 12,
    fontWeight: '500',
  },
  pillTextSelected: {
    color: '#F77575',
  },
});
