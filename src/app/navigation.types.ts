export type RootStackParamList = {
  Main: undefined;
  Charts: undefined;
  Settings: undefined;
  BabyOnboarding: { mode?: 'required' | 'new' } | undefined;
  AddEntry:
    | {
        type?: 'feed' | 'measurement' | 'temperature' | 'diaper' | 'medication' | 'milestone';
        entryId?: string;
      }
    | undefined;
  Auth: undefined;
};

export type MainTabParamList = {
  Today: undefined;
  QuickAdd: undefined;
  Logs: undefined;
};

export type NavBaby = {
  id: string;
  name: string;
  photoUri?: string | null;
  birthdate?: string | null;
};
