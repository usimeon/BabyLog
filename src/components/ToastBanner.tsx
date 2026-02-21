import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppTheme } from '../theme/designSystem';
import { useAppTheme } from '../theme/useAppTheme';

export type ToastBannerKind = 'success' | 'error' | 'info';

type ToastBannerProps = {
  kind?: ToastBannerKind;
  message: string;
  onDismiss?: () => void;
  actionLabel?: string;
  onAction?: () => void;
};

const iconForKind = (kind: ToastBannerKind): keyof typeof Ionicons.glyphMap => {
  if (kind === 'success') return 'checkmark-circle';
  if (kind === 'error') return 'alert-circle';
  return 'information-circle';
};

export const ToastBanner = ({
  kind = 'info',
  message,
  onDismiss,
  actionLabel,
  onAction,
}: ToastBannerProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const borderColor = kind === 'error' ? theme.colors.error : kind === 'success' ? theme.colors.success : theme.colors.info;

  return (
    <View style={[styles.wrap, { backgroundColor: theme.colors.surfaceElevated, borderColor }]}>
      <Ionicons name={iconForKind(kind)} size={18} color={borderColor} />
      <Text style={[styles.message, { color: theme.colors.textPrimary }]}>{message}</Text>
      {actionLabel && onAction ? (
        <Pressable
          onPress={onAction}
          style={[styles.actionButton, { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceAlt }]}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
        >
          <Text style={[styles.actionText, { color: theme.colors.textPrimary }]}>{actionLabel}</Text>
        </Pressable>
      ) : null}
      {onDismiss ? (
        <Pressable
          onPress={onDismiss}
          style={styles.closeButton}
          accessibilityRole="button"
          accessibilityLabel="Dismiss notification"
        >
          <Ionicons name="close" size={16} color={theme.colors.textSecondary} />
        </Pressable>
      ) : null}
    </View>
  );
};

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    wrap: {
      borderWidth: 1,
      borderRadius: theme.radius.md,
      minHeight: 50,
      paddingHorizontal: theme.spacing[3],
      paddingVertical: theme.spacing[2],
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing[2],
    },
    message: {
      ...theme.typography.bodySm,
      flex: 1,
      fontWeight: '600',
    },
    closeButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    actionButton: {
      minHeight: 30,
      borderRadius: theme.radius.full,
      borderWidth: 1,
      paddingHorizontal: theme.spacing[2],
      alignItems: 'center',
      justifyContent: 'center',
    },
    actionText: {
      ...theme.typography.caption,
      fontWeight: '700',
    },
  });
