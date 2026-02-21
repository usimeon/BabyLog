import { StyleSheet } from 'react-native';
import { AppTheme } from '../../theme/designSystem';
import { EntryKind } from './logs.types';

export const getKindMeta = (kind: EntryKind, theme: AppTheme) => {
  if (kind === 'feed') {
    return {
      label: 'Feed',
      icon: 'restaurant-outline' as const,
      iconColor: '#BE123C',
      bg: theme.mode === 'dark' ? 'rgba(190, 18, 60, 0.24)' : '#FFF1F2',
      border: theme.mode === 'dark' ? 'rgba(251, 113, 133, 0.45)' : '#FECDD3',
    };
  }
  if (kind === 'measurement') {
    return {
      label: 'Growth',
      icon: 'barbell-outline' as const,
      iconColor: '#0F766E',
      bg: theme.mode === 'dark' ? 'rgba(15, 118, 110, 0.26)' : '#ECFDF5',
      border: theme.mode === 'dark' ? 'rgba(52, 211, 153, 0.45)' : '#BBF7D0',
    };
  }
  if (kind === 'temperature') {
    return {
      label: 'Temp',
      icon: 'thermometer-outline' as const,
      iconColor: '#B45309',
      bg: theme.mode === 'dark' ? 'rgba(180, 83, 9, 0.22)' : '#FFFBEB',
      border: theme.mode === 'dark' ? 'rgba(251, 191, 36, 0.45)' : '#FDE68A',
    };
  }
  if (kind === 'diaper') {
    return {
      label: 'Diaper',
      icon: 'water-outline' as const,
      iconColor: '#1D4ED8',
      bg: theme.mode === 'dark' ? 'rgba(29, 78, 216, 0.24)' : '#EFF6FF',
      border: theme.mode === 'dark' ? 'rgba(56, 189, 248, 0.45)' : '#BFDBFE',
    };
  }
  if (kind === 'medication') {
    return {
      label: 'Medication',
      icon: 'medkit-outline' as const,
      iconColor: '#7C2D12',
      bg: theme.mode === 'dark' ? 'rgba(124, 45, 18, 0.24)' : '#FFF7ED',
      border: theme.mode === 'dark' ? 'rgba(249, 115, 22, 0.45)' : '#FDBA74',
    };
  }
  return {
    label: 'Milestone',
    icon: 'trophy-outline' as const,
    iconColor: '#6D28D9',
    bg: theme.mode === 'dark' ? 'rgba(109, 40, 217, 0.24)' : '#F5F3FF',
    border: theme.mode === 'dark' ? 'rgba(167, 139, 250, 0.45)' : '#DDD6FE',
  };
};

export const createLogsStyles = (theme: AppTheme) =>
  StyleSheet.create({
    safe: { flex: 1 },
    headerWrap: { paddingTop: theme.spacing[4], gap: theme.spacing[2] },
    hint: { ...theme.typography.caption, marginTop: theme.spacing[1] },
    filterTitle: { ...theme.typography.caption, marginTop: theme.spacing[2], marginBottom: theme.spacing[1] },
    dayHeader: {
      ...theme.typography.caption,
      fontWeight: '700',
      marginTop: theme.spacing[2],
      marginBottom: theme.spacing[1],
      marginLeft: theme.spacing[1],
    },
    statBox: {
      borderWidth: 1,
      borderRadius: theme.radius.sm,
      paddingVertical: theme.spacing[2],
      paddingHorizontal: theme.spacing[3],
      minWidth: 74,
    },
    statValue: { ...theme.typography.h6, fontWeight: '800' },
    statLabel: { ...theme.typography.caption },
    alertItem: {
      ...theme.typography.bodySm,
      marginBottom: theme.spacing[2],
      paddingHorizontal: theme.spacing[3],
      paddingVertical: theme.spacing[2],
      borderRadius: theme.radius.sm,
      fontWeight: '600',
    },
    alertOk: {
      ...theme.typography.bodySm,
      paddingHorizontal: theme.spacing[3],
      paddingVertical: theme.spacing[2],
      borderRadius: theme.radius.sm,
      fontWeight: '600',
    },
    searchInput: {
      marginTop: theme.spacing[2],
    },
    row: {
      borderRadius: theme.radius.md,
      borderWidth: 1,
      padding: theme.spacing[3],
    },
    rowHead: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: theme.spacing[1],
    },
    kindWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing[2],
    },
    kindIconBubble: {
      width: 28,
      height: 28,
      borderRadius: 14,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    kind: { ...theme.typography.caption, fontWeight: '800' },
    rowActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing[3],
    },
    title: { ...theme.typography.bodyLg, fontWeight: '800', marginBottom: theme.spacing[1] },
    sub: { ...theme.typography.bodySm, marginBottom: 2 },
    separator: { height: theme.spacing[2] },
    listContent: {
      paddingHorizontal: theme.spacing[4],
      paddingBottom: theme.spacing[4],
    },
  });

export type LogsStyles = ReturnType<typeof createLogsStyles>;
