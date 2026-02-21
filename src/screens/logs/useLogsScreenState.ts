import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { getPinnedLogs, setPinnedLogs } from '../../db/settingsRepo';
import { listFeeds, softDeleteFeed } from '../../db/feedRepo';
import { listMeasurements, softDeleteMeasurement } from '../../db/measurementRepo';
import { listTemperatureLogs, softDeleteTemperatureLog } from '../../db/temperatureRepo';
import { listDiaperLogs, softDeleteDiaperLog } from '../../db/diaperRepo';
import { getMedicationSpacingAlert, listMedicationLogs, softDeleteMedicationLog } from '../../db/medicationRepo';
import { listMilestones, softDeleteMilestone } from '../../db/milestoneRepo';
import { recalculateReminder } from '../../services/reminderCoordinator';
import { useAppContext } from '../../context/AppContext';
import { ToastBannerKind } from '../../components/ToastBanner';
import { DiaperLog, FeedEvent, TemperatureLog } from '../../types/models';
import { formatTemp } from '../../utils/units';
import { buildGlanceStats, buildLogEntries, countFilteredKinds, filterVisibleEntries } from './logs.helpers';
import { AlertItem, GlanceStats, LogEntry, LogFilter, RangePreset, ToastState } from './logs.types';

const defaultGlance: GlanceStats = {
  feedsToday: 0,
  diapersToday: 0,
  latestTemp: '—',
  entriesToday: 0,
};

export const useLogsScreenState = () => {
  const { babyId, amountUnit, weightUnit, tempUnit, reminderSettings, smartAlertSettings, syncNow, bumpDataVersion, dataVersion } =
    useAppContext();
  const [filter, setFilter] = useState<LogFilter>('all');
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [rangePreset, setRangePreset] = useState<RangePreset>('all');
  const [pinned, setPinned] = useState<string[]>([]);
  const [pendingDeleteKey, setPendingDeleteKey] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const [glance, setGlance] = useState<GlanceStats>(defaultGlance);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);

  const logKey = useCallback((entry: Pick<LogEntry, 'kind' | 'id'>) => `${entry.kind}:${entry.id}`, []);

  const showToast = useCallback((message: string, kind: ToastBannerKind = 'info') => {
    setToast({ kind, message });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(timeout);
  }, [toast]);

  const loadPinned = useCallback(async () => {
    const keys = await getPinnedLogs();
    setPinned(keys);
  }, []);

  const loadAlerts = useCallback(
    async (feeds: FeedEvent[], temps: TemperatureLog[], diapers: DiaperLog[]) => {
      const nextAlerts: AlertItem[] = [];
      const lastFeed = feeds[0];
      const latestTemp = temps[0];
      const lastDiaper = diapers[0];

      if (lastFeed && smartAlertSettings.enabled) {
        const hoursSinceFeed = (Date.now() - new Date(lastFeed.timestamp).getTime()) / 36e5;
        if (hoursSinceFeed >= smartAlertSettings.feedGapHours) {
          nextAlerts.push({ level: 'warning', message: `No recent feed for ${hoursSinceFeed.toFixed(1)}h (threshold ${smartAlertSettings.feedGapHours}h).` });
        }
      }
      if (latestTemp && smartAlertSettings.enabled && Number(latestTemp.temperature_c) >= smartAlertSettings.feverThresholdC) {
        nextAlerts.push({ level: 'critical', message: `Latest logged temperature is ${formatTemp(Number(latestTemp.temperature_c), tempUnit)}.` });
      }
      if (lastDiaper && smartAlertSettings.enabled) {
        const hoursSinceDiaper = (Date.now() - new Date(lastDiaper.timestamp).getTime()) / 36e5;
        if (hoursSinceDiaper >= smartAlertSettings.diaperGapHours) {
          nextAlerts.push({ level: 'warning', message: `No diaper log for ${hoursSinceDiaper.toFixed(1)}h (threshold ${smartAlertSettings.diaperGapHours}h).` });
        }
      }
      if (smartAlertSettings.enabled) {
        const feed24 = feeds.filter((x) => Date.now() - new Date(x.timestamp).getTime() <= 24 * 60 * 60 * 1000).length;
        if (feed24 < smartAlertSettings.lowFeedsPerDay) {
          nextAlerts.push({ level: 'warning', message: `Only ${feed24} feed(s) in last 24h (target ${smartAlertSettings.lowFeedsPerDay}).` });
        }
        const spacingAlert = await getMedicationSpacingAlert(babyId);
        if (spacingAlert) {
          nextAlerts.push({
            level: 'critical',
            message: `${spacingAlert.medication} given after ${spacingAlert.actualHours.toFixed(1)}h (minimum ${spacingAlert.minHours}h).`,
          });
        }
      }

      setAlerts(nextAlerts);
    },
    [babyId, smartAlertSettings, tempUnit],
  );

  const load = useCallback(async () => {
    const [feeds, measurements, temps, diapers, medications, milestones] = await Promise.all([
      listFeeds(babyId),
      listMeasurements(babyId),
      listTemperatureLogs(babyId),
      listDiaperLogs(babyId),
      listMedicationLogs(babyId),
      listMilestones(babyId),
    ]);
    const mapped = buildLogEntries({ feeds, measurements, temps, diapers, medications, milestones, amountUnit, weightUnit, tempUnit });
    setEntries(mapped);
    setPendingDeleteKey(null);
    setGlance(buildGlanceStats(feeds, diapers, temps, mapped, tempUnit));
    await loadAlerts(feeds, temps, diapers);
    await loadPinned();
  }, [amountUnit, babyId, loadAlerts, loadPinned, tempUnit, weightUnit]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  useEffect(() => {
    load();
  }, [dataVersion, load]);

  const visible = useMemo(
    () => filterVisibleEntries({ entries, filter, search, rangePreset, pinned, getEntryKey: (entry) => `${entry.kind}:${entry.id}` }),
    [entries, filter, pinned, rangePreset, search],
  );

  const filteredCounts = useMemo(() => countFilteredKinds(visible), [visible]);

  const deleteEntry = useCallback(
    async (entry: LogEntry) => {
      try {
        if (entry.kind === 'feed') {
          await softDeleteFeed(entry.id);
          try {
            await recalculateReminder(babyId, reminderSettings);
          } catch {
            // keep deletion successful even if reminder reschedule fails
          }
        }
        if (entry.kind === 'measurement') await softDeleteMeasurement(entry.id);
        if (entry.kind === 'temperature') await softDeleteTemperatureLog(entry.id);
        if (entry.kind === 'diaper') await softDeleteDiaperLog(entry.id);
        if (entry.kind === 'medication') await softDeleteMedicationLog(entry.id);
        if (entry.kind === 'milestone') await softDeleteMilestone(entry.id);
      } catch (error: any) {
        showToast(error?.message ?? 'Delete failed.', 'error');
        return;
      }
      bumpDataVersion();
      await load();
      void syncNow().catch(() => undefined);
      showToast('Entry deleted.', 'success');
    },
    [babyId, bumpDataVersion, load, reminderSettings, showToast, syncNow],
  );

  const requestDelete = useCallback(
    (entry: LogEntry) => {
      const key = logKey(entry);
      if (pendingDeleteKey !== key) {
        setPendingDeleteKey(key);
        showToast('Tap delete again to confirm.', 'info');
        return;
      }
      setPendingDeleteKey(null);
      void deleteEntry(entry);
    },
    [deleteEntry, logKey, pendingDeleteKey, showToast],
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await syncNow();
      await load();
      showToast('Logs refreshed.', 'success');
    } catch (error: any) {
      showToast(error?.message ?? 'Refresh failed.', 'error');
    } finally {
      setRefreshing(false);
    }
  }, [load, showToast, syncNow]);

  const togglePin = useCallback(async (entry: LogEntry) => {
    const key = logKey(entry);
    const exists = pinned.includes(key);
    const next = exists ? pinned.filter((x) => x !== key) : [...pinned, key];
    setPinned(next);
    await setPinnedLogs(next);
  }, [logKey, pinned]);

  return {
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
  };
};
