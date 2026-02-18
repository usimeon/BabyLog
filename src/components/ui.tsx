import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, TextInputProps, useColorScheme, View } from 'react-native';
import { getTheme } from '../theme/designSystem';

export const Card = ({ title, children }: React.PropsWithChildren<{ title?: string }>) => {
  const scheme = useColorScheme();
  const theme = getTheme(scheme === 'dark' ? 'dark' : 'light');
  return (
    <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }, theme.shadows.level1]}>
      {title ? <Text style={[styles.cardTitle, { color: theme.colors.textPrimary }]}>{title}</Text> : null}
      {children}
    </View>
  );
};

export const Row = ({ children }: React.PropsWithChildren) => <View style={styles.row}>{children}</View>;

export const Label = ({ children }: React.PropsWithChildren) => {
  const scheme = useColorScheme();
  const theme = getTheme(scheme === 'dark' ? 'dark' : 'light');
  return <Text style={[styles.label, { color: theme.colors.textSecondary }]}>{children}</Text>;
};

export const Input = ({ style, editable, ...props }: TextInputProps) => {
  const scheme = useColorScheme();
  const theme = getTheme(scheme === 'dark' ? 'dark' : 'light');
  const disabled = editable === false;
  return (
    <TextInput
      {...props}
      editable={editable}
      style={[
        styles.input,
        {
          color: disabled ? theme.colors.textMuted : theme.colors.textPrimary,
          backgroundColor: disabled ? theme.colors.neutral100 : theme.colors.surface,
          borderColor: theme.colors.border,
        },
        style,
      ]}
      placeholderTextColor={theme.colors.textMuted}
    />
  );
};

export const Button = ({
  title,
  onPress,
  variant = 'primary',
}: {
  title: string;
  onPress: () => void | Promise<void>;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
}) => {
  const scheme = useColorScheme();
  const theme = getTheme(scheme === 'dark' ? 'dark' : 'light');
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        variant === 'primary' && {
          backgroundColor: pressed ? theme.colors.neutral700 : theme.colors.primary,
        },
        variant === 'secondary' && {
          backgroundColor: theme.colors.neutral100,
          borderColor: theme.colors.border,
          borderWidth: 1,
        },
        variant === 'ghost' && {
          backgroundColor: pressed ? `${theme.colors.primary}14` : 'transparent',
          borderWidth: 0,
        },
        variant === 'danger' && {
          backgroundColor: pressed ? '#B91C1C' : theme.colors.error,
        },
      ]}
    >
      <Text
        style={[
          styles.buttonText,
          variant === 'primary' || variant === 'danger'
            ? { color: '#fff' }
            : variant === 'secondary'
              ? { color: theme.colors.textPrimary }
              : { color: theme.colors.primary },
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
};

export const SelectPill = ({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) => {
  const scheme = useColorScheme();
  const theme = getTheme(scheme === 'dark' ? 'dark' : 'light');
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.pill,
        { borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
        selected && { borderColor: theme.colors.primary, backgroundColor: `${theme.colors.primary}14` },
      ]}
    >
      <Text style={[styles.pillText, { color: theme.colors.textSecondary }, selected && { color: theme.colors.primary }]}>
        {label}
      </Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  cardTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '600',
    letterSpacing: 0,
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  label: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    letterSpacing: 0.2,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 52,
    fontSize: 15,
    lineHeight: 22,
  },
  button: {
    borderRadius: 14,
    minHeight: 52,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  pill: {
    borderWidth: 1,
    borderRadius: 999,
    minHeight: 36,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 6,
  },
  pillText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
});
