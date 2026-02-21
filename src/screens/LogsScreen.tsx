import React, { useMemo } from 'react';
import { FlatList, SafeAreaView, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../app/navigation';
import { EmptyState } from '../components/ui';
import { useAppTheme } from '../theme/useAppTheme';
import { LogEntryRow } from './logs/LogEntryRow';
import { LogsListHeader } from './logs/LogsListHeader';
import { createLogsStyles } from './logs/logs.styles';
import { LogEntry } from './logs/logs.types';
import { useLogsScreenState } from './logs/useLogsScreenState';

export const LogsScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const theme = useAppTheme();
  const styles = useMemo(() => createLogsStyles(theme), [theme]);

  const {
    filter,
    setFilter,
    search,
    setSearch,
    refreshing,
    rangePreset,
    setRangePreset,
    pinned,
    pendingDeleteKey,
    toast,
    setToast,
    glance,
    alerts,
    visible,
    filteredCounts,
    load,
    onRefresh,
    requestDelete,
    togglePin,
    logKey,
    tempUnit,
  } = useLogsScreenState();

  const renderRow = ({ item, index }: { item: LogEntry; index: number }) => (
    <LogEntryRow
      entry={item}
      previousEntry={index > 0 ? visible[index - 1] : undefined}
      pendingDeleteKey={pendingDeleteKey}
      isPinned={pinned.includes(logKey(item))}
      theme={theme}
      styles={styles}
      logKey={logKey}
      onTogglePin={togglePin}
      onRequestDelete={requestDelete}
    />
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]}>
      <FlatList
        data={visible}
        keyExtractor={(item) => `${item.kind}-${item.id}`}
        ListHeaderComponent={
          <LogsListHeader
            toast={toast}
            onDismissToast={() => setToast(null)}
            styles={styles}
            theme={theme}
            glance={glance}
            alerts={alerts}
            tempUnit={tempUnit}
            onQuickAdd={(type) => navigation.navigate('AddEntry', { type })}
            onRefreshLogs={load}
            rangePreset={rangePreset}
            onSelectRange={setRangePreset}
            filter={filter}
            onSelectFilter={setFilter}
            search={search}
            onChangeSearch={setSearch}
            visibleCount={visible.length}
            filteredCounts={filteredCounts}
          />
        }
        renderItem={renderRow}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={<EmptyState title="No entries yet" subtitle="Add your first log entry to begin tracking." />}
        refreshing={refreshing}
        onRefresh={onRefresh}
        contentContainerStyle={styles.listContent}
      />
    </SafeAreaView>
  );
};
