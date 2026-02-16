import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import { Session } from '@supabase/supabase-js';
import { initDatabase } from '../db';
import { getOrCreateDefaultBaby } from '../db/babyRepo';
import {
  getAmountUnit,
  getReminderSettings,
  getWeightUnit,
  setAuthUserId,
  setAmountUnit,
  setWeightUnit,
  saveReminderSettings,
} from '../db/settingsRepo';
import { ReminderSettings } from '../types/models';
import { isSupabaseConfigured, supabase } from '../supabase/client';
import { getCurrentSession } from '../supabase/auth';
import { syncAll } from '../supabase/sync';

type AppContextValue = {
  initialized: boolean;
  babyId: string;
  amountUnit: 'ml' | 'oz';
  weightUnit: 'kg' | 'lb';
  reminderSettings: ReminderSettings;
  session: Session | null;
  supabaseEnabled: boolean;
  refreshAppState: () => Promise<void>;
  updateAmountUnit: (unit: 'ml' | 'oz') => Promise<void>;
  updateWeightUnit: (unit: 'kg' | 'lb') => Promise<void>;
  updateReminderSettings: (settings: ReminderSettings) => Promise<void>;
  refreshSession: () => Promise<void>;
  syncNow: () => Promise<void>;
};

const AppContext = createContext<AppContextValue | null>(null);

const defaultReminder: ReminderSettings = {
  enabled: false,
  intervalHours: 3,
  quietHoursStart: null,
  quietHoursEnd: null,
  allowDuringQuietHours: false,
};

export const AppProvider = ({ children }: React.PropsWithChildren) => {
  const [initialized, setInitialized] = useState(false);
  const [babyId, setBabyId] = useState('');
  const [amountUnit, setAmountUnitState] = useState<'ml' | 'oz'>('ml');
  const [weightUnit, setWeightUnitState] = useState<'kg' | 'lb'>('kg');
  const [reminderSettings, setReminderSettingsState] = useState<ReminderSettings>(defaultReminder);
  const [session, setSession] = useState<Session | null>(null);

  const refreshSession = async () => {
    const next = await getCurrentSession();
    setSession(next);
    await setAuthUserId(next?.user.id ?? null);
  };

  const refreshAppState = async () => {
    const baby = await getOrCreateDefaultBaby();
    const nextAmountUnit = (await getAmountUnit()) as 'ml' | 'oz';
    const nextWeightUnit = (await getWeightUnit()) as 'kg' | 'lb';
    const nextReminder = await getReminderSettings();

    setBabyId(baby.id);
    setAmountUnitState(nextAmountUnit);
    setWeightUnitState(nextWeightUnit);
    setReminderSettingsState(nextReminder);
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
    await syncAll();
    await refreshAppState();
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

  const updateAmountUnit = async (unit: 'ml' | 'oz') => {
    await setAmountUnit(unit);
    setAmountUnitState(unit);
  };

  const updateWeightUnit = async (unit: 'kg' | 'lb') => {
    await setWeightUnit(unit);
    setWeightUnitState(unit);
  };

  const updateReminderSettings = async (settings: ReminderSettings) => {
    await saveReminderSettings(settings);
    setReminderSettingsState(settings);
  };

  const value = useMemo<AppContextValue>(
    () => ({
      initialized,
      babyId,
      amountUnit,
      weightUnit,
      reminderSettings,
      session,
      supabaseEnabled: isSupabaseConfigured,
      refreshAppState,
      updateAmountUnit,
      updateWeightUnit,
      updateReminderSettings,
      refreshSession,
      syncNow,
    }),
    [initialized, babyId, amountUnit, weightUnit, reminderSettings, session],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useAppContext = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext must be used inside AppProvider');
  return ctx;
};
