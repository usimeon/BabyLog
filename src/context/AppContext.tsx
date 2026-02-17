import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import { Session } from '@supabase/supabase-js';
import { initDatabase } from '../db';
import { getOrCreateDefaultBaby } from '../db/babyRepo';
import {
  getAmountUnit,
  getBackupSettings,
  getLastSyncAt,
  getReminderSettings,
  getSmartAlertSettings,
  getTempUnit,
  getWeightUnit,
  setAuthUserId,
  setAmountUnit,
  saveBackupSettings,
  saveSmartAlertSettings,
  setTempUnit,
  setWeightUnit,
  saveReminderSettings,
} from '../db/settingsRepo';
import { BackupSettings, ReminderSettings, SmartAlertSettings } from '../types/models';
import { isSupabaseConfigured, supabase } from '../supabase/client';
import { getCurrentSession } from '../supabase/auth';
import { syncAll } from '../supabase/sync';
import { runAutoBackupIfDue } from '../services/backups';

type AppContextValue = {
  initialized: boolean;
  babyId: string;
  amountUnit: 'ml' | 'oz';
  weightUnit: 'kg' | 'lb';
  tempUnit: 'c' | 'f';
  reminderSettings: ReminderSettings;
  smartAlertSettings: SmartAlertSettings;
  backupSettings: BackupSettings;
  session: Session | null;
  supabaseEnabled: boolean;
  syncState: 'idle' | 'syncing' | 'success' | 'error';
  syncError: string | null;
  lastSyncAt: string | null;
  dataVersion: number;
  refreshAppState: () => Promise<void>;
  updateAmountUnit: (unit: 'ml' | 'oz') => Promise<void>;
  updateWeightUnit: (unit: 'kg' | 'lb') => Promise<void>;
  updateTempUnit: (unit: 'c' | 'f') => Promise<void>;
  updateReminderSettings: (settings: ReminderSettings) => Promise<void>;
  updateSmartAlertSettings: (settings: SmartAlertSettings) => Promise<void>;
  updateBackupSettings: (settings: BackupSettings) => Promise<void>;
  refreshSession: () => Promise<void>;
  syncNow: () => Promise<void>;
  bumpDataVersion: () => void;
};

const AppContext = createContext<AppContextValue | null>(null);

const defaultReminder: ReminderSettings = {
  enabled: false,
  intervalHours: 3,
  quietHoursStart: null,
  quietHoursEnd: null,
  allowDuringQuietHours: false,
};

const defaultSmartAlerts: SmartAlertSettings = {
  enabled: true,
  feedGapHours: 4.5,
  diaperGapHours: 8,
  feverThresholdC: 38,
  lowFeedsPerDay: 6,
};

const defaultBackupSettings: BackupSettings = {
  enabled: false,
  destination: 'share',
  intervalDays: 1,
  lastBackupAt: null,
};

export const AppProvider = ({ children }: React.PropsWithChildren) => {
  const [initialized, setInitialized] = useState(false);
  const [babyId, setBabyId] = useState('');
  const [amountUnit, setAmountUnitState] = useState<'ml' | 'oz'>('ml');
  const [weightUnit, setWeightUnitState] = useState<'kg' | 'lb'>('lb');
  const [tempUnit, setTempUnitState] = useState<'c' | 'f'>('f');
  const [reminderSettings, setReminderSettingsState] = useState<ReminderSettings>(defaultReminder);
  const [smartAlertSettings, setSmartAlertSettingsState] = useState<SmartAlertSettings>(defaultSmartAlerts);
  const [backupSettings, setBackupSettingsState] = useState<BackupSettings>(defaultBackupSettings);
  const [session, setSession] = useState<Session | null>(null);
  const [syncState, setSyncState] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastSyncAt, setLastSyncAtState] = useState<string | null>(null);
  const [dataVersion, setDataVersion] = useState(0);

  const refreshSession = async () => {
    const next = await getCurrentSession();
    setSession(next);
    await setAuthUserId(next?.user.id ?? null);
  };

  const refreshAppState = async () => {
    const baby = await getOrCreateDefaultBaby();
    const nextAmountUnit = (await getAmountUnit()) as 'ml' | 'oz';
    const nextWeightUnit = (await getWeightUnit()) as 'kg' | 'lb';
    const nextTempUnit = (await getTempUnit()) as 'c' | 'f';
    const nextReminder = await getReminderSettings();
    const nextSmartAlerts = await getSmartAlertSettings();
    const nextBackupSettings = await getBackupSettings();
    const nextLastSyncAt = await getLastSyncAt();

    setBabyId(baby.id);
    setAmountUnitState(nextAmountUnit);
    setWeightUnitState(nextWeightUnit);
    setTempUnitState(nextTempUnit);
    setReminderSettingsState(nextReminder);
    setSmartAlertSettingsState(nextSmartAlerts);
    setBackupSettingsState(nextBackupSettings);
    setLastSyncAtState(nextLastSyncAt);
  };

  useEffect(() => {
    const boot = async () => {
      await initDatabase();
      await refreshAppState();
      if (isSupabaseConfigured) {
        await refreshSession();
        if (supabase) {
          supabase.auth.onAuthStateChange((_event, s) => {
            setSession(s);
          });
        }
      }
      setInitialized(true);
    };

    boot();
  }, []);

  const syncNow = async () => {
    if (!isSupabaseConfigured) return;
    try {
      setSyncState('syncing');
      setSyncError(null);
      await syncAll();
      await refreshAppState();
      setDataVersion((prev) => prev + 1);
      setSyncState('success');
    } catch (error: any) {
      setSyncState('error');
      setSyncError(error?.message ?? 'Sync failed');
    }
  };

  const bumpDataVersion = () => {
    setDataVersion((prev) => prev + 1);
  };

  useEffect(() => {
    if (!initialized || !isSupabaseConfigured) return;

    syncNow();

    const sub = AppState.addEventListener('change', (status) => {
      if (status === 'active') {
        syncNow();
      }
    });

    return () => sub.remove();
  }, [initialized]);

  useEffect(() => {
    if (!initialized) return;

    const checkBackup = async () => {
      const updatedAt = await runAutoBackupIfDue(backupSettings);
      if (updatedAt) {
        await saveBackupSettings({ ...backupSettings, lastBackupAt: updatedAt });
        setBackupSettingsState((prev) => ({ ...prev, lastBackupAt: updatedAt }));
      }
    };

    checkBackup();

    const sub = AppState.addEventListener('change', (status) => {
      if (status === 'active') {
        checkBackup();
      }
    });

    return () => sub.remove();
  }, [initialized, backupSettings]);

  const updateAmountUnit = async (unit: 'ml' | 'oz') => {
    await setAmountUnit(unit);
    setAmountUnitState(unit);
  };

  const updateWeightUnit = async (unit: 'kg' | 'lb') => {
    await setWeightUnit(unit);
    setWeightUnitState(unit);
  };

  const updateTempUnit = async (unit: 'c' | 'f') => {
    await setTempUnit(unit);
    setTempUnitState(unit);
  };

  const updateReminderSettings = async (settings: ReminderSettings) => {
    await saveReminderSettings(settings);
    setReminderSettingsState(settings);
  };

  const updateSmartAlertSettings = async (settings: SmartAlertSettings) => {
    await saveSmartAlertSettings(settings);
    setSmartAlertSettingsState(settings);
  };

  const updateBackupSettings = async (settings: BackupSettings) => {
    await saveBackupSettings(settings);
    setBackupSettingsState(settings);
  };

  const value = useMemo<AppContextValue>(
    () => ({
      initialized,
      babyId,
      amountUnit,
      weightUnit,
      tempUnit,
      reminderSettings,
      smartAlertSettings,
      backupSettings,
      session,
      supabaseEnabled: isSupabaseConfigured,
      syncState,
      syncError,
      lastSyncAt,
      dataVersion,
      refreshAppState,
      updateAmountUnit,
      updateWeightUnit,
      updateTempUnit,
      updateReminderSettings,
      updateSmartAlertSettings,
      updateBackupSettings,
      refreshSession,
      syncNow,
      bumpDataVersion,
    }),
    [
      initialized,
      babyId,
      amountUnit,
      weightUnit,
      tempUnit,
      reminderSettings,
      smartAlertSettings,
      backupSettings,
      session,
      syncState,
      syncError,
      lastSyncAt,
      dataVersion,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useAppContext = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext must be used inside AppProvider');
  return ctx;
};
