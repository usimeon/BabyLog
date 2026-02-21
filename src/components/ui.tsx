import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  PressableProps,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { AppTheme } from '../theme/designSystem';
import { useAppTheme } from '../theme/useAppTheme';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';
type PillSize = 'sm' | 'md';

const hitSlop8 = { top: 8, right: 8, bottom: 8, left: 8 } as const;

export const Card = ({
  title,
  subtitle,
  children,
  style,
  contentStyle,
}: React.PropsWithChildren<{
  title?: string;
  subtitle?: string;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
}>) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
        },
        theme.shadows.level1,
        style,
      ]}
    >
      {title ? <Text style={[styles.cardTitle, { color: theme.colors.textPrimary }]}>{title}</Text> : null}
      {subtitle ? <Text style={[styles.cardSubtitle, { color: theme.colors.textSecondary }]}>{subtitle}</Text> : null}
      <View style={contentStyle}>{children}</View>
    </View>
  );
};

export const ScreenContainer = ({
  children,
  style,
}: React.PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
}>) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return <View style={[styles.screenContainer, { backgroundColor: theme.colors.background }, style]}>{children}</View>;
};

export const Row = ({
  children,
  style,
}: React.PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
}>) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  return <View style={[styles.row, style]}>{children}</View>;
};

export const Label = ({ children, style }: React.PropsWithChildren<{ style?: StyleProp<TextStyle> }>) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  return (
    <Text style={[styles.label, { color: theme.colors.textSecondary }, style]} maxFontSizeMultiplier={1.3}>
      {children}
    </Text>
  );
};

export const Input = ({
  style,
  editable,
  errorText,
  hintText,
  accessibilityLabel,
  ...props
}: TextInputProps & {
  errorText?: string | null;
  hintText?: string;
  accessibilityLabel?: string;
}) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [focused, setFocused] = useState(false);
  const disabled = editable === false;
  const hasError = Boolean(errorText);

  return (
    <View style={styles.inputWrap}>
      <TextInput
        {...props}
        accessibilityLabel={accessibilityLabel}
        editable={editable}
        style={[
          styles.input,
          {
            color: disabled ? theme.colors.disabledText : theme.colors.textPrimary,
            backgroundColor: disabled ? theme.colors.disabledBg : theme.colors.surface,
            borderColor: hasError ? theme.colors.error : focused ? theme.colors.primary : theme.colors.border,
          },
          style,
        ]}
        onFocus={(e) => {
          setFocused(true);
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          props.onBlur?.(e);
        }}
        placeholderTextColor={theme.colors.textMuted}
        selectionColor={theme.colors.primary}
      />
      {hasError ? (
        <Text style={[styles.inputMessage, { color: theme.colors.error }]} maxFontSizeMultiplier={1.2}>
          {errorText}
        </Text>
      ) : hintText ? (
        <Text style={[styles.inputMessage, { color: theme.colors.textMuted }]} maxFontSizeMultiplier={1.2}>
          {hintText}
        </Text>
      ) : null}
    </View>
  );
};

export const Button = ({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  style,
  accessibilityLabel,
}: {
  title: string;
  onPress: () => void | Promise<void>;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const sizeStyle =
    size === 'sm'
      ? styles.buttonSm
      : size === 'lg'
        ? styles.buttonLg
        : styles.buttonMd;

  const textSizeStyle = size === 'sm' ? styles.buttonTextSm : styles.buttonText;

  return (
    <Pressable
      onPress={disabled || loading ? undefined : onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: disabled || loading }}
      style={({ pressed }) => [
        styles.buttonBase,
        sizeStyle,
        variant === 'primary' && {
          backgroundColor: pressed ? theme.colors.primaryPressed : theme.colors.primary,
          borderColor: theme.colors.primary,
        },
        variant === 'secondary' && {
          backgroundColor: pressed ? theme.colors.surfaceAlt : theme.colors.surface,
          borderColor: theme.colors.border,
        },
        variant === 'outline' && {
          backgroundColor: pressed ? theme.colors.primarySoft : 'transparent',
          borderColor: theme.colors.primary,
        },
        variant === 'ghost' && {
          backgroundColor: pressed ? theme.colors.primarySoft : 'transparent',
          borderColor: 'transparent',
        },
        variant === 'danger' && {
          backgroundColor: pressed ? '#DC2626' : theme.colors.error,
          borderColor: pressed ? '#DC2626' : theme.colors.error,
        },
        (disabled || loading) && {
          backgroundColor: theme.colors.disabledBg,
          borderColor: theme.colors.disabledBg,
        },
        style,
      ]}
      hitSlop={hitSlop8}
    >
      {loading ? (
        <ActivityIndicator size="small" color={variant === 'secondary' || variant === 'ghost' ? theme.colors.textPrimary : '#FFFFFF'} />
      ) : (
        <Text
          style={[
            textSizeStyle,
            variant === 'primary' || variant === 'danger'
              ? { color: '#FFFFFF' }
              : variant === 'secondary'
                ? { color: theme.colors.textPrimary }
                : { color: theme.colors.primary },
            (disabled || loading) && { color: theme.colors.disabledText },
          ]}
          maxFontSizeMultiplier={1.2}
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
};

export const SelectPill = ({
  label,
  selected,
  onPress,
  disabled = false,
  accessibilityLabel,
  size = 'md',
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  size?: PillSize;
}) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const isCompact = size === 'sm';
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected, disabled }}
      style={({ pressed }) => [
        styles.pill,
        isCompact ? styles.pillSm : null,
        { borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
        selected && { borderColor: theme.colors.primary, backgroundColor: theme.colors.primarySoft },
        pressed && !disabled && { opacity: 0.92 },
        disabled && { opacity: 0.6 },
      ]}
      hitSlop={hitSlop8}
    >
      <Text
        style={[
          styles.pillText,
          isCompact ? styles.pillTextSm : null,
          { color: theme.colors.textSecondary },
          selected && { color: theme.colors.primary },
        ]}
        maxFontSizeMultiplier={1.2}
      >
        {label}
      </Text>
    </Pressable>
  );
};

export const SectionHeader = ({
  title,
  right,
  style,
}: {
  title: string;
  right?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  return (
    <View style={[styles.sectionHeader, style]}>
      <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>{title}</Text>
      {right}
    </View>
  );
};

export const ListItem = ({
  title,
  subtitle,
  left,
  right,
  onPress,
  style,
}: {
  title: string;
  subtitle?: string;
  left?: React.ReactNode;
  right?: React.ReactNode;
  onPress?: PressableProps['onPress'];
  style?: StyleProp<ViewStyle>;
}) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const content = (
    <View style={[styles.listItem, style]}>
      <View style={styles.listItemLeft}>
        {left}
        <View style={styles.listItemTextWrap}>
          <Text style={[styles.listItemTitle, { color: theme.colors.textPrimary }]}>{title}</Text>
          {subtitle ? <Text style={[styles.listItemSubtitle, { color: theme.colors.textSecondary }]}>{subtitle}</Text> : null}
        </View>
      </View>
      {right}
    </View>
  );

  if (!onPress) return content;
  return (
    <Pressable onPress={onPress} hitSlop={hitSlop8} style={({ pressed }) => [pressed && { opacity: 0.92 }]}>
      {content}
    </Pressable>
  );
};

export const EmptyState = ({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  return (
    <View style={[styles.emptyState, { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceAlt }]}>
      <Text style={[styles.emptyTitle, { color: theme.colors.textPrimary }]}>{title}</Text>
      {subtitle ? <Text style={[styles.emptySubtitle, { color: theme.colors.textSecondary }]}>{subtitle}</Text> : null}
    </View>
  );
};

export const InlineMessage = ({
  kind = 'info',
  message,
}: {
  kind?: 'success' | 'error' | 'info';
  message: string;
}) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  return (
    <View
      style={[
        styles.inlineMessage,
        {
          borderColor: kind === 'error' ? theme.colors.error : kind === 'success' ? theme.colors.success : theme.colors.info,
          backgroundColor: theme.colors.surface,
        },
      ]}
    >
      <Text style={[styles.inlineMessageText, { color: theme.colors.textPrimary }]}>{message}</Text>
    </View>
  );
};

export const Loader = ({ label = 'Loading...' }: { label?: string }) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  return (
    <View style={styles.loaderWrap}>
      <ActivityIndicator size="small" color={theme.colors.primary} />
      <Text style={[styles.loaderLabel, { color: theme.colors.textSecondary }]}>{label}</Text>
    </View>
  );
};

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    screenContainer: {
      flex: 1,
    },
    card: {
      borderRadius: theme.radius.lg,
      paddingHorizontal: theme.spacing[4],
      paddingVertical: theme.spacing[4],
      borderWidth: 1,
    },
    cardTitle: {
      ...theme.typography.h6,
      marginBottom: theme.spacing[1],
    },
    cardSubtitle: {
      ...theme.typography.bodySm,
      marginBottom: theme.spacing[3],
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: theme.spacing[2],
    },
    label: {
      ...theme.typography.caption,
      marginBottom: theme.spacing[1],
    },
    inputWrap: {
      marginBottom: theme.spacing[1],
    },
    input: {
      borderWidth: 1,
      borderRadius: theme.radius.md,
      paddingHorizontal: theme.spacing[3],
      minHeight: 48,
      ...theme.typography.body,
    },
    inputMessage: {
      ...theme.typography.caption,
      marginTop: theme.spacing[1],
      paddingHorizontal: theme.spacing[1],
    },
    buttonBase: {
      borderRadius: theme.radius.md,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: 64,
    },
    buttonSm: {
      minHeight: 44,
      paddingHorizontal: theme.spacing[3],
    },
    buttonMd: {
      minHeight: 50,
      paddingHorizontal: theme.spacing[4],
    },
    buttonLg: {
      minHeight: 56,
      paddingHorizontal: theme.spacing[5],
    },
    buttonText: {
      ...theme.typography.button,
    },
    buttonTextSm: {
      ...theme.typography.buttonSm,
    },
    pill: {
      borderWidth: 1,
      borderRadius: theme.radius.full,
      minHeight: 38,
      paddingHorizontal: theme.spacing[3],
      paddingVertical: theme.spacing[2],
      marginBottom: theme.spacing[1],
      alignItems: 'center',
      justifyContent: 'center',
    },
    pillSm: {
      minHeight: 34,
      paddingHorizontal: theme.spacing[2],
      paddingVertical: theme.spacing[1],
    },
    pillText: {
      ...theme.typography.caption,
      textTransform: 'capitalize',
    },
    pillTextSm: {
      ...theme.typography.overline,
      letterSpacing: 0.2,
    },
    sectionHeader: {
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: theme.spacing[2],
    },
    sectionTitle: {
      ...theme.typography.h5,
    },
    listItem: {
      minHeight: 56,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.spacing[3],
    },
    listItemLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing[3],
      flex: 1,
    },
    listItemTextWrap: {
      flex: 1,
      gap: theme.spacing[0],
    },
    listItemTitle: {
      ...theme.typography.bodyLg,
      fontWeight: '600',
    },
    listItemSubtitle: {
      ...theme.typography.bodySm,
    },
    emptyState: {
      borderWidth: 1,
      borderRadius: theme.radius.lg,
      padding: theme.spacing[4],
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.spacing[1],
    },
    emptyTitle: {
      ...theme.typography.h6,
      textAlign: 'center',
    },
    emptySubtitle: {
      ...theme.typography.bodySm,
      textAlign: 'center',
    },
    inlineMessage: {
      borderWidth: 1,
      borderRadius: theme.radius.md,
      paddingVertical: theme.spacing[2],
      paddingHorizontal: theme.spacing[3],
    },
    inlineMessageText: {
      ...theme.typography.bodySm,
    },
    loaderWrap: {
      minHeight: 48,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.spacing[2],
    },
    loaderLabel: {
      ...theme.typography.bodySm,
    },
  });
