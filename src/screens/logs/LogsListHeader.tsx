import React from 'react';
import { Text, View } from 'react-native';
import { Button, Card, Input, Row, SelectPill } from '../../components/ui';
import { ToastBanner } from '../../components/ToastBanner';
import { AppTheme } from '../../theme/designSystem';
import { filters, GlanceStats, rangeFilterPills, RangePreset, ToastState } from './logs.types';
import { AlertItem, LogFilter } from './logs.types';
import { LogsStyles } from './logs.styles';

type FilteredCounts = {
  feed: number;
  measurement: number;
  temperature: number;
  diaper: number;
  medication: number;
  milestone: number;
};

type LogsListHeaderProps = {
  toast: ToastState;
  onDismissToast: () => void;
  styles: LogsStyles;
  theme: AppTheme;
  glance: GlanceStats;
  alerts: AlertItem[];
  tempUnit: 'c' | 'f';
  onQuickAdd: (type: 'feed' | 'measurement' | 'temperature' | 'diaper' | 'medication' | 'milestone') => void;
  onRefreshLogs: () => void;
  rangePreset: RangePreset;
  onSelectRange: (value: RangePreset) => void;
  filter: LogFilter;
  onSelectFilter: (value: LogFilter) => void;
  search: string;
  onChangeSearch: (value: string) => void;
  visibleCount: number;
  filteredCounts: FilteredCounts;
};

const StatBox = ({ styles, theme, value, label }: { styles: LogsStyles; theme: AppTheme; value: string | number; label: string }) => (
  <View style={[styles.statBox, { backgroundColor: theme.colors.surfaceAlt, borderColor: theme.colors.border }]}>
    <Text style={[styles.statValue, { color: theme.colors.textPrimary }]}>{value}</Text>
    <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>{label}</Text>
  </View>
);

export const LogsListHeader = ({
  toast,
  onDismissToast,
  styles,
  theme,
  glance,
  alerts,
  tempUnit,
  onQuickAdd,
  onRefreshLogs,
  rangePreset,
  onSelectRange,
  filter,
  onSelectFilter,
  search,
  onChangeSearch,
  visibleCount,
  filteredCounts,
}: LogsListHeaderProps) => {
  return (
    <View style={styles.headerWrap}>
      {toast ? <ToastBanner kind={toast.kind} message={toast.message} onDismiss={onDismissToast} /> : null}

      <Card title="Quick Add">
        <Row>
          <SelectPill label="+ Feed" selected={false} onPress={() => onQuickAdd('feed')} />
          <SelectPill label="+ Growth" selected={false} onPress={() => onQuickAdd('measurement')} />
          <SelectPill label="+ Temp" selected={false} onPress={() => onQuickAdd('temperature')} />
          <SelectPill label="+ Diaper" selected={false} onPress={() => onQuickAdd('diaper')} />
          <SelectPill label="+ Med" selected={false} onPress={() => onQuickAdd('medication')} />
          <SelectPill label="+ Milestone" selected={false} onPress={() => onQuickAdd('milestone')} />
        </Row>
        <Button title="Refresh Logs" variant="secondary" onPress={onRefreshLogs} />
      </Card>

      <Card title="Today At A Glance">
        <Row>
          <StatBox styles={styles} theme={theme} value={glance.entriesToday} label="entries" />
          <StatBox styles={styles} theme={theme} value={glance.feedsToday} label="feeds" />
          <StatBox styles={styles} theme={theme} value={glance.diapersToday} label="diapers" />
          <StatBox styles={styles} theme={theme} value={glance.latestTemp} label={`latest ${tempUnit.toUpperCase()}`} />
        </Row>
      </Card>

      <Card title="Alerts">
        {alerts.length ? (
          alerts.map((item, idx) => (
            <Text
              key={`${item.level}-${idx}`}
              style={[
                styles.alertItem,
                {
                  backgroundColor: item.level === 'critical' ? theme.colors.primarySoft : theme.colors.surfaceAlt,
                  color: item.level === 'critical' ? theme.colors.error : theme.colors.warning,
                },
              ]}
            >
              {item.level === 'critical' ? 'Critical: ' : 'Warning: '}
              {item.message}
            </Text>
          ))
        ) : (
          <Text style={[styles.alertOk, { color: theme.colors.success, backgroundColor: theme.colors.surfaceAlt }]}>
            No active alerts right now.
          </Text>
        )}
      </Card>

      <Card title="Filter">
        <Text style={[styles.filterTitle, { color: theme.colors.textSecondary }]}>Range</Text>
        <Row>{rangeFilterPills.map((item) => <SelectPill key={item.id} label={item.label} selected={rangePreset === item.id} onPress={() => onSelectRange(item.id)} />)}</Row>

        <Text style={[styles.filterTitle, { color: theme.colors.textSecondary }]}>Type</Text>
        <Row>{filters.map((option) => <SelectPill key={option} label={option} selected={filter === option} onPress={() => onSelectFilter(option)} />)}</Row>

        <Input value={search} onChangeText={onChangeSearch} placeholder="Search notes, type, details..." style={styles.searchInput} />
        <Text style={[styles.hint, { color: theme.colors.textMuted }]}>Tap entry to edit. Long-press or trash icon to delete.</Text>
      </Card>

      <Card title="Filtered Snapshot">
        <Row>
          <StatBox styles={styles} theme={theme} value={visibleCount} label="entries" />
          <StatBox styles={styles} theme={theme} value={filteredCounts.feed} label="feeds" />
          <StatBox styles={styles} theme={theme} value={filteredCounts.measurement} label="growth" />
          <StatBox styles={styles} theme={theme} value={filteredCounts.temperature} label="temp" />
          <StatBox styles={styles} theme={theme} value={filteredCounts.diaper} label="diapers" />
          <StatBox styles={styles} theme={theme} value={filteredCounts.medication} label="meds" />
          <StatBox styles={styles} theme={theme} value={filteredCounts.milestone} label="milestones" />
        </Row>
      </Card>
    </View>
  );
};
