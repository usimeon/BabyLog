export type NavigationGateInput = {
  supabaseEnabled: boolean;
  hasSession: boolean;
  hasRequiredBabyProfile: boolean;
  appStateHydrating: boolean;
  forceMainAfterOnboarding: boolean;
  syncState: 'idle' | 'syncing' | 'success' | 'error';
  babyName: string;
  babies: Array<{ id: string; name: string; photoUri?: string | null; birthdate?: string | null }>;
};

export type NavigationGateResult = {
  requiresAuth: boolean;
  hasCreatedBabyFallback: boolean;
  requiresBabyProfile: boolean;
  stackKey: 'auth' | 'required-onboarding' | 'app';
};

export const getNavigationGate = ({
  supabaseEnabled,
  hasSession,
  hasRequiredBabyProfile,
  appStateHydrating,
  forceMainAfterOnboarding,
  syncState,
  babyName,
  babies,
}: NavigationGateInput): NavigationGateResult => {
  const requiresAuth = supabaseEnabled && !hasSession;
  const normalizedActiveName = babyName.trim().toLowerCase();
  const hasNamedActiveBaby = normalizedActiveName.length > 0 && normalizedActiveName !== 'my baby';
  const hasCreatedBabyFallback = hasNamedActiveBaby || babies.some((baby) => {
    const normalizedName = baby.name.trim().toLowerCase();
    const hasRealName = normalizedName.length > 0 && normalizedName !== 'my baby';
    const hasBirthdate = Boolean(baby.birthdate && baby.birthdate.trim().length > 0);
    return hasRealName || hasBirthdate;
  });

  const requiresBabyProfile =
    supabaseEnabled &&
    hasSession &&
    !hasRequiredBabyProfile &&
    !appStateHydrating &&
    !forceMainAfterOnboarding &&
    syncState !== 'syncing' &&
    !hasCreatedBabyFallback;
  const stackKey = requiresAuth ? 'auth' : requiresBabyProfile ? 'required-onboarding' : 'app';

  return {
    requiresAuth,
    hasCreatedBabyFallback,
    requiresBabyProfile,
    stackKey,
  };
};
