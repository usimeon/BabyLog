import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../app/navigation';
import { AppTheme } from '../../theme/designSystem';
import { formatDateTime } from '../../utils/time';
import { LogEntry } from './logs.types';
import { getKindMeta } from './logs.styles';
import { LogsStyles } from './logs.styles';

type LogEntryRowProps = {
  entry: LogEntry;
  previousEntry?: LogEntry;
  pendingDeleteKey: string | null;
  isPinned: boolean;
  theme: AppTheme;
  styles: LogsStyles;
  logKey: (entry: Pick<LogEntry, 'kind' | 'id'>) => string;
  onTogglePin: (entry: LogEntry) => void;
  onRequestDelete: (entry: LogEntry) => void;
};

export const LogEntryRow = ({
  entry,
  previousEntry,
  pendingDeleteKey,
  isPinned,
  theme,
  styles,
  logKey,
  onTogglePin,
  onRequestDelete,
}: LogEntryRowProps) => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const itemDay = entry.timestamp.slice(0, 10);
  const prevDay = previousEntry ? previousEntry.timestamp.slice(0, 10) : '';
  const showDayHeader = itemDay !== prevDay;
  const meta = getKindMeta(entry.kind, theme);
  const isDeletePending = pendingDeleteKey === logKey(entry);

  return (
    <>
      {showDayHeader ? (
        <Text style={[styles.dayHeader, { color: theme.colors.textSecondary }]}>
          {new Date(`${itemDay}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
        </Text>
      ) : null}
      <Pressable
        style={[styles.row, { backgroundColor: meta.bg, borderColor: meta.border }]}
        onPress={() => navigation.navigate('AddEntry', { type: entry.kind, entryId: entry.id })}
        onLongPress={() => onRequestDelete(entry)}
        accessibilityRole="button"
        accessibilityLabel={`Open ${meta.label} entry`}
      >
        <View style={styles.rowHead}>
          <View style={styles.kindWrap}>
            <View style={[styles.kindIconBubble, { borderColor: meta.border, backgroundColor: theme.colors.surface }]}>
              <Ionicons name={meta.icon} size={16} color={meta.iconColor} />
            </View>
            <Text style={[styles.kind, { color: meta.iconColor }]}>{meta.label}</Text>
          </View>
          <View style={styles.rowActions}>
            <Pressable onPress={() => onTogglePin(entry)} hitSlop={8} accessibilityRole="button" accessibilityLabel={isPinned ? 'Unpin entry' : 'Pin entry'}>
              <Ionicons name={isPinned ? 'star' : 'star-outline'} size={18} color={isPinned ? '#F59E0B' : theme.colors.textMuted} />
            </Pressable>
            <Pressable onPress={() => onRequestDelete(entry)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Delete entry">
              <Ionicons name="trash-outline" size={18} color={isDeletePending ? theme.colors.error : theme.colors.textMuted} />
            </Pressable>
          </View>
        </View>

        <Text style={[styles.title, { color: theme.colors.textPrimary }]}>{entry.title}</Text>
        <Text style={[styles.sub, { color: theme.colors.textSecondary }]}>{formatDateTime(entry.timestamp)}</Text>
        <Text style={[styles.sub, { color: theme.colors.textSecondary }]}>{entry.subtitle || '—'}</Text>
        {entry.notes ? <Text style={[styles.sub, { color: theme.colors.textSecondary }]}>{entry.notes}</Text> : null}
      </Pressable>
    </>
  );
};
