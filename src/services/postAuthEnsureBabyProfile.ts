import { BabyProfile } from '../types/models';
import { isBabyProfileComplete } from './babyProfileValidation';

export const postAuthEnsureBabyProfile = (baby: BabyProfile | null | undefined) => {
  if (!baby) return false;
  return isBabyProfileComplete(baby.name, baby.birthdate ?? null);
};

