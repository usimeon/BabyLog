import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { Session } from '@supabase/supabase-js';
import { initDatabase } from '../db';
import {
  createBaby,
  getBabyById,
  getOrCreateDefaultBaby,
  isBabyNameTaken,
  listBabies,
  softDeleteBaby,
  upsertBaby,
} from '../db/babyRepo';
import {
  getActiveBabyId,
  getAmountUnit,
  getBackupSettings,
  getLastSyncAt,
  getLocalDataOwnerUserId,
  getRequiredProfileOwnerUserId,
  getReminderSettings,
  getSmartAlertSettings,
  getTempUnit,
  getWeightUnit,
  saveBackupSettings,
  saveReminderSettings,
  saveSmartAlertSettings,
  setActiveBabyId,
  setAmountUnit,
  setAuthUserId,
  setLocalDataOwnerUserId,
  setRequiredProfileOwnerUserId,
  setTempUnit,
  setWeightUnit,
} from '../db/settingsRepo';
import { BackupSettings, ReminderSettings, SmartAlertSettings } from '../types/models';
import { isSupabaseConfigured, supabase } from '../supabase/client';
import { getCurrentSession } from '../supabase/auth';
import { syncAll } from '../supabase/sync';
import { runAutoBackupIfDue } from '../services/backups';
import { postAuthEnsureBabyProfile } from '../services/postAuthEnsureBabyProfile';
import { nowIso } from '../utils/time';
import {
  defaultBackupSettings,
  defaultReminder,
  defaultSmartAlerts,
  getProfileOwnerKey,
  isPlaceholderBaby,
  normalizeName,
  pickPreferredBaby,
  toBirthdateIso,
} from './appContext.helpers';

type AppContextValue = {
  initialized: boolean;
  appStateHydrating: boolean;
  forceMainAfterOnboarding: boolean;
  babyId: string;
  babyName: string;
  babies: Array<{ id: string; name: string; photoUri?: string | null; birthdate?: string | null }>;
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
  hasRequiredBabyProfile: boolean;
  refreshAppState: () => Promise<void>;
  switchActiveBaby: (babyId: string) => Promise<void>;
  updateAmountUnit: (unit: 'ml' | 'oz') => Promise<void>;
  updateWeightUnit: (unit: 'kg' | 'lb') => Promise<void>;
  updateTempUnit: (unit: 'c' | 'f') => Promise<void>;
  updateReminderSettings: (settings: ReminderSettings) => Promise<void>;
  updateSmartAlertSettings: (settings: SmartAlertSettings) => Promise<void>;
  updateBackupSettings: (settings: BackupSettings) => Promise<void>;
  refreshSession: () => Promise<void>;
  syncNow: () => Promise<void>;
  bumpDataVersion: () => void;
  saveRequiredBabyProfile: (babyName: string, babyBirthdate: Date, babyPhotoUri?: string | null) => Promise<string>;
  createNewBabyProfile: (babyName: string, babyBirthdate: Date, babyPhotoUri?: string | null) => Promise<string>;
};

const AppContext = createContext<AppContextValue | null>(null);

export const AppProvider = ({ children }: React.PropsWithChildren) => {
  const [initialized, setInitialized] = useState(false);
  const [appStateHydrating, setAppStateHydrating] = useState(false);
  const [forceMainAfterOnboarding, setForceMainAfterOnboarding] = useState(false);
  const [babyId, setBabyId] = useState('');
  const [babyName, setBabyName] = useState('My Baby');
  const [babies, setBabies] = useState<Array<{ id: string; name: string; photoUri?: string | null; birthdate?: string | null }>>([]);
  const [amountUnit, setAmountUnitState] = useState<'ml' | 'oz'>('ml');
  const [weightUnit, setWeightUnitState] = useState<'kg' | 'lb'>('lb');
  const [tempUnit, setTempUnitState] = useState<'c' | 'f'>('f');
  const [reminderSettings, setReminderSettingsState] = useState<ReminderSettings>(defaultReminder);
  const [smartAlertSettings, setSmartAlertSettingsState] = useState<SmartAlertSettings>(defaultSmartAlerts);
  const [backupSettings, setBackupSettingsState] = useState<BackupSettings>(defaultBackupSettings);
  const [sessionState, setSessionState] = useState<Session | null>(null);
  const [syncState, setSyncState] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastSyncAt, setLastSyncAtState] = useState<string | null>(null);
  const [dataVersion, setDataVersion] = useState(0);
  const [hasRequiredBabyProfile, setHasRequiredBabyProfile] = useState(false);

  const mountedRef = useRef(true);
  const sessionRef = useRef<Session | null>(null);
  const syncTaskRef = useRef<Promise<void> | null>(null);
  const switchQueueRef = useRef<Promise<unknown>>(Promise.resolve());
  const authQueueRef = useRef<Promise<unknown>>(Promise.resolve());
  const requiredProfileOwnerRef = useRef<string | null>(null);
  const babyIdRef = useRef('');
  const babiesRef = useRef<Array<{ id: string; name: string; photoUri?: string | null; birthdate?: string | null }>>([]);

  useEffect(() => {
    babyIdRef.current = babyId;
  }, [babyId]);

  useEffect(() => {
    babiesRef.current = babies;
  }, [babies]);

  const setSession = useCallback((next: Session | null) => {
    const nextOwnerKey = getProfileOwnerKey(next);
    if (!next?.user?.id) {
      requiredProfileOwnerRef.current = null;
      if (mountedRef.current) {
        setForceMainAfterOnboarding(false);
      }
    } else if (
      requiredProfileOwnerRef.current &&
      requiredProfileOwnerRef.current !== '__local__' &&
      requiredProfileOwnerRef.current !== nextOwnerKey
    ) {
      requiredProfileOwnerRef.current = null;
    }

    sessionRef.current = next;
    if (mountedRef.current) {
      setSessionState(next);
    }
  }, []);

  const loadAppState = useCallback(async (sessionSnapshot: Session | null) => {
    if (mountedRef.current) {
      setAppStateHydrating(true);
    }
    try {
      const [configuredActiveBabyId, nextAmountUnit, nextWeightUnit, nextTempUnit, nextReminder, nextSmartAlerts, nextBackupSettings, nextLastSyncAt, persistedRequiredProfileOwner] =
        await Promise.all([
          getActiveBabyId(),
          getAmountUnit(),
          getWeightUnit(),
          getTempUnit(),
          getReminderSettings(),
          getSmartAlertSettings(),
          getBackupSettings(),
          getLastSyncAt(),
          getRequiredProfileOwnerUserId(),
        ]);

      let babyList = await listBabies();
      if (isSupabaseConfigured && sessionSnapshot && babyList.length > 1) {
        const hasRealProfile = babyList.some((item) => postAuthEnsureBabyProfile(item));
        if (!hasRealProfile) {
          const placeholders = babyList.filter((item) => isPlaceholderBaby(item));
          if (placeholders.length > 1) {
            for (const duplicate of placeholders.slice(1)) {
              await softDeleteBaby(duplicate.id);
            }
            babyList = await listBabies();
          }
        }
      }
      if (!babyList.length && !isSupabaseConfigured) {
        const fallback = await getOrCreateDefaultBaby();
        babyList = [fallback];
      }

      const ownerKey = getProfileOwnerKey(sessionSnapshot);
      const hasPersistedRequiredProfile = persistedRequiredProfileOwner === ownerKey;
      const shouldPreserveKnownProfileState =
        Boolean(sessionSnapshot?.user?.id) &&
        !babyList.length &&
        (hasPersistedRequiredProfile || requiredProfileOwnerRef.current === ownerKey || babiesRef.current.length > 0);

      const active = pickPreferredBaby(babyList, configuredActiveBabyId);
      if (active?.id && configuredActiveBabyId !== active.id) {
        await setActiveBabyId(active.id);
      }

      if (!mountedRef.current) return;

      if (!shouldPreserveKnownProfileState) {
        setBabyId(active?.id ?? '');
        setBabyName(normalizeName(active?.name));
        setBabies(
          babyList.map((item) => ({
            id: item.id,
            name: normalizeName(item.name),
            photoUri: item.photo_uri ?? null,
            birthdate: item.birthdate ?? null,
          })),
        );
      }
      setAmountUnitState(nextAmountUnit as 'ml' | 'oz');
      setWeightUnitState(nextWeightUnit as 'kg' | 'lb');
      setTempUnitState(nextTempUnit as 'c' | 'f');
      setReminderSettingsState(nextReminder);
      setSmartAlertSettingsState(nextSmartAlerts);
      setBackupSettingsState(nextBackupSettings);
      setLastSyncAtState(nextLastSyncAt);
      const derivedHasRequiredProfile = babyList.some((item) => postAuthEnsureBabyProfile(item));
      if (derivedHasRequiredProfile) {
        requiredProfileOwnerRef.current = ownerKey;
        await setRequiredProfileOwnerUserId(ownerKey);
        setHasRequiredBabyProfile(true);
        setForceMainAfterOnboarding(false);
      } else if (hasPersistedRequiredProfile && babyList.length > 0) {
        requiredProfileOwnerRef.current = ownerKey;
        setHasRequiredBabyProfile(true);
        setForceMainAfterOnboarding(false);
      } else if (!babyList.length && isSupabaseConfigured && sessionSnapshot) {
        // Avoid flipping to false during transient empty states while sync is in progress.
        setHasRequiredBabyProfile((prev) => prev && requiredProfileOwnerRef.current === ownerKey);
      } else {
        const canKeepPrevious =
          Boolean(sessionSnapshot?.user?.id) &&
          requiredProfileOwnerRef.current !== null &&
          (requiredProfileOwnerRef.current === ownerKey || requiredProfileOwnerRef.current === '__local__');
        if (sessionSnapshot?.user?.id) {
          // Keep this monotonic during a signed-in session to prevent onboarding loops
          // caused by transient sync reads.
          setHasRequiredBabyProfile((prev) => prev || canKeepPrevious);
        } else {
          setHasRequiredBabyProfile(false);
        }
      }
    } finally {
      if (mountedRef.current) {
        setAppStateHydrating(false);
      }
    }
  }, []);

  const refreshAppState = useCallback(async () => {
    await loadAppState(sessionRef.current);
  }, [loadAppState]);

  const syncNow = useCallback(async () => {
    if (!isSupabaseConfigured) return;

    if (syncTaskRef.current) {
      return syncTaskRef.current;
    }

    const task = (async () => {
      try {
        if (mountedRef.current) {
          setSyncState('syncing');
          setSyncError(null);
        }

        await syncAll();
        await loadAppState(sessionRef.current);

        if (mountedRef.current) {
          setDataVersion((prev) => prev + 1);
          setSyncState('success');
        }
      } catch (error: any) {
        if (mountedRef.current) {
          setSyncState('error');
          setSyncError(error?.message ?? 'Sync failed');
        }
        throw error;
      } finally {
        syncTaskRef.current = null;
      }
    })();

    syncTaskRef.current = task;
    return task;
  }, [loadAppState]);

  const refreshSession = useCallback(async () => {
    const nextSession = await getCurrentSession();
    setSession(nextSession);
    await setAuthUserId(nextSession?.user.id ?? null);

    if (isSupabaseConfigured && nextSession?.user?.id) {
      try {
        await syncNow();
      } catch {
        await loadAppState(nextSession);
      }
      return;
    }

    await loadAppState(nextSession);
  }, [loadAppState, setSession, syncNow]);

  const bumpDataVersion = useCallback(() => {
    if (!mountedRef.current) return;
    setDataVersion((prev) => prev + 1);
  }, []);

  const switchActiveBaby = useCallback(
    async (nextBabyId: string) => {
      const run = async () => {
        const trimmed = nextBabyId.trim();
        if (!trimmed) return;
        if (trimmed === babyId) return;

        const target = await getBabyById(trimmed);
        if (!target || target.deleted_at) {
          throw new Error('Selected baby profile is no longer available.');
        }

        await setActiveBabyId(trimmed);
        await loadAppState(sessionRef.current);
        if (mountedRef.current) {
          setDataVersion((prev) => prev + 1);
        }
      };

      const nextTask = switchQueueRef.current.then(run, run);
      switchQueueRef.current = nextTask.then(
        () => undefined,
        () => undefined,
      );

      return nextTask as Promise<void>;
    },
    [babyId, loadAppState],
  );

  const saveRequiredBabyProfile = useCallback(
    async (name: string, birthdate: Date, babyPhotoUri?: string | null) => {
      const trimmedName = name.trim();
      if (!trimmedName) throw new Error('Baby name is required.');

      const duplicateName = await isBabyNameTaken(trimmedName, babyId ? { excludeBabyId: babyId } : undefined);
      if (duplicateName) throw new Error('Baby name already exists. Use a different name.');

      const birthdateIso = toBirthdateIso(birthdate);
      const existing = babyId ? await getBabyById(babyId) : null;

      let targetId = existing?.id ?? '';
      if (existing) {
        await upsertBaby(
          {
            ...existing,
            name: trimmedName,
            birthdate: birthdateIso,
            photo_uri: babyPhotoUri ?? existing.photo_uri ?? null,
            updated_at: nowIso(),
          },
          true,
        );
      } else {
        const created = await createBaby({ name: trimmedName, birthdate: birthdateIso, photo_uri: babyPhotoUri ?? null });
        targetId = created.id;
      }

      if (targetId) {
        await setActiveBabyId(targetId);
      }

      if (mountedRef.current) {
        const authUserId = sessionRef.current?.user?.id ?? null;
        if (authUserId) {
          const localOwner = await getLocalDataOwnerUserId();
          if (localOwner !== authUserId) {
            await setLocalDataOwnerUserId(authUserId);
          }
        }

        const ownerKey = getProfileOwnerKey(sessionRef.current);
        requiredProfileOwnerRef.current = ownerKey;
        await setRequiredProfileOwnerUserId(ownerKey);
        babyIdRef.current = targetId;
        setBabyId(targetId);
        setBabyName(normalizeName(trimmedName));
        setBabies((prev) => {
          const nextItem = {
            id: targetId,
            name: normalizeName(trimmedName),
            photoUri: babyPhotoUri ?? existing?.photo_uri ?? null,
            birthdate: birthdateIso,
          };
          const idx = prev.findIndex((item) => item.id === targetId);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = nextItem;
            babiesRef.current = next;
            return next;
          }
          const next = [...prev, nextItem];
          babiesRef.current = next;
          return next;
        });
        setHasRequiredBabyProfile(true);
        setForceMainAfterOnboarding(true);
        setDataVersion((prev) => prev + 1);
      }
      return targetId;
    },
    [babyId],
  );

  const createNewBabyProfile = useCallback(
    async (name: string, birthdate: Date, babyPhotoUri?: string | null) => {
      const trimmedName = name.trim();
      if (!trimmedName) throw new Error('Baby name is required.');

      const duplicateName = await isBabyNameTaken(trimmedName);
      if (duplicateName) throw new Error('Baby name already exists. Use a different name.');

      const created = await createBaby({
        name: trimmedName,
        birthdate: toBirthdateIso(birthdate),
        photo_uri: babyPhotoUri ?? null,
      });
      await setActiveBabyId(created.id);

      if (mountedRef.current) {
        const authUserId = sessionRef.current?.user?.id ?? null;
        if (authUserId) {
          const localOwner = await getLocalDataOwnerUserId();
          if (localOwner !== authUserId) {
            await setLocalDataOwnerUserId(authUserId);
          }
        }

        babyIdRef.current = created.id;
        setBabyId(created.id);
        setBabyName(normalizeName(trimmedName));
        setBabies((prev) => [
          ...(() => {
            const next = [
              ...prev.filter((item) => item.id !== created.id),
              {
                id: created.id,
                name: normalizeName(trimmedName),
                photoUri: babyPhotoUri ?? null,
                birthdate: created.birthdate ?? null,
              },
            ];
            babiesRef.current = next;
            return next;
          })(),
        ]);
        setDataVersion((prev) => prev + 1);
      }
      return created.id;
    },
    [],
  );

  useEffect(() => {
    mountedRef.current = true;

    let cancelled = false;
    let unsubscribeAuth: (() => void) | null = null;

    const boot = async () => {
      try {
        await initDatabase();

        if (cancelled) return;

        if (!isSupabaseConfigured) {
          await loadAppState(null);
        } else {
          const nextSession = await getCurrentSession();
          setSession(nextSession);
          await setAuthUserId(nextSession?.user.id ?? null);

          if (nextSession?.user?.id) {
            try {
              await syncNow();
            } catch {
              await loadAppState(nextSession);
            }
          } else {
            await loadAppState(nextSession);
          }

          if (supabase) {
            const { data } = supabase.auth.onAuthStateChange((event, nextSessionFromEvent) => {
              const run = async () => {
                // Ignore transient null sessions unless this is an explicit sign-out.
                if (!nextSessionFromEvent && event !== 'SIGNED_OUT') {
                  return;
                }

                setSession(nextSessionFromEvent);
                await setAuthUserId(nextSessionFromEvent?.user.id ?? null);

                if (nextSessionFromEvent?.user?.id) {
                  try {
                    await syncNow();
                  } catch {
                    await loadAppState(nextSessionFromEvent);
                  }
                } else {
                  await loadAppState(nextSessionFromEvent);
                }
              };

              const nextTask = authQueueRef.current.then(run, run);
              authQueueRef.current = nextTask.then(
                () => undefined,
                () => undefined,
              );
            });

            unsubscribeAuth = () => data.subscription.unsubscribe();
          }
        }
      } catch (error: any) {
        if (!cancelled && mountedRef.current) {
          setSyncState('error');
          setSyncError(error?.message ?? 'Failed to initialize app state.');
        }
      } finally {
        if (!cancelled && mountedRef.current) {
          setInitialized(true);
        }
      }
    };

    void boot();

    return () => {
      cancelled = true;
      mountedRef.current = false;
      if (unsubscribeAuth) {
        unsubscribeAuth();
      }
    };
  }, [loadAppState, setSession, syncNow]);

  useEffect(() => {
    if (!initialized || !isSupabaseConfigured || !sessionState?.user?.id) return;

    void syncNow().catch(() => undefined);

    const sub = AppState.addEventListener('change', (status) => {
      if (status === 'active') {
        void syncNow().catch(() => undefined);
      }
    });

    return () => sub.remove();
  }, [initialized, sessionState?.user?.id, syncNow]);

  useEffect(() => {
    if (!initialized) return;

    const checkBackup = async () => {
      const updatedAt = await runAutoBackupIfDue(backupSettings);
      if (updatedAt) {
        const next = { ...backupSettings, lastBackupAt: updatedAt };
        await saveBackupSettings(next);
        if (mountedRef.current) {
          setBackupSettingsState(next);
        }
      }
    };

    void checkBackup();

    const sub = AppState.addEventListener('change', (status) => {
      if (status === 'active') {
        void checkBackup();
      }
    });

    return () => sub.remove();
  }, [initialized, backupSettings]);

  const updateAmountUnit = useCallback(async (unit: 'ml' | 'oz') => {
    await setAmountUnit(unit);
    if (mountedRef.current) {
      setAmountUnitState(unit);
    }
  }, []);

  const updateWeightUnit = useCallback(async (unit: 'kg' | 'lb') => {
    await setWeightUnit(unit);
    if (mountedRef.current) {
      setWeightUnitState(unit);
    }
  }, []);

  const updateTempUnit = useCallback(async (unit: 'c' | 'f') => {
    await setTempUnit(unit);
    if (mountedRef.current) {
      setTempUnitState(unit);
    }
  }, []);

  const updateReminderSettings = useCallback(async (settings: ReminderSettings) => {
    await saveReminderSettings(settings);
    if (mountedRef.current) {
      setReminderSettingsState(settings);
    }
  }, []);

  const updateSmartAlertSettings = useCallback(async (settings: SmartAlertSettings) => {
    await saveSmartAlertSettings(settings);
    if (mountedRef.current) {
      setSmartAlertSettingsState(settings);
    }
  }, []);

  const updateBackupSettings = useCallback(async (settings: BackupSettings) => {
    await saveBackupSettings(settings);
    if (mountedRef.current) {
      setBackupSettingsState(settings);
    }
  }, []);

  const value = useMemo<AppContextValue>(
    () => ({
      initialized,
      appStateHydrating,
      forceMainAfterOnboarding,
      babyId,
      babyName,
      babies,
      amountUnit,
      weightUnit,
      tempUnit,
      reminderSettings,
      smartAlertSettings,
      backupSettings,
      session: sessionState,
      supabaseEnabled: isSupabaseConfigured,
      syncState,
      syncError,
      lastSyncAt,
      dataVersion,
      hasRequiredBabyProfile,
      refreshAppState,
      switchActiveBaby,
      updateAmountUnit,
      updateWeightUnit,
      updateTempUnit,
      updateReminderSettings,
      updateSmartAlertSettings,
      updateBackupSettings,
      refreshSession,
      syncNow,
      bumpDataVersion,
      saveRequiredBabyProfile,
      createNewBabyProfile,
    }),
    [
      initialized,
      appStateHydrating,
      forceMainAfterOnboarding,
      babyId,
      babyName,
      babies,
      amountUnit,
      weightUnit,
      tempUnit,
      reminderSettings,
      smartAlertSettings,
      backupSettings,
      sessionState,
      syncState,
      syncError,
      lastSyncAt,
      dataVersion,
      hasRequiredBabyProfile,
      refreshAppState,
      switchActiveBaby,
      updateAmountUnit,
      updateWeightUnit,
      updateTempUnit,
      updateReminderSettings,
      updateSmartAlertSettings,
      updateBackupSettings,
      refreshSession,
      syncNow,
      bumpDataVersion,
      saveRequiredBabyProfile,
      createNewBabyProfile,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useAppContext = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext must be used inside AppProvider');
  return ctx;
};
