import { BabyProfile } from '../types/models';
import { isBabyProfileComplete } from './babyProfileValidation';

type BabyProfileLike = Pick<BabyProfile, 'name' | 'birthdate'>;

export const postAuthEnsureBabyProfile = (baby: BabyProfileLike | null | undefined) => {
  if (!baby) return false;
  if (isBabyProfileComplete(baby.name, baby.birthdate ?? null)) return true;

  // Backward-compat: older profiles can be valid without a saved birthdate.
  // Keep onboarding required only for placeholder/default baby records.
  const normalizedName = baby.name?.trim().toLowerCase() ?? '';
  return normalizedName.length > 0 && normalizedName !== 'my baby';
};
