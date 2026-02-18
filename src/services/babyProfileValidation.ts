export const MAX_BABY_AGE_YEARS = 18;

export const validateBabyProfile = (name: string, birthdate: Date) => {
  const trimmed = name.trim();
  if (!trimmed) return 'Baby name is required.';

  const now = new Date();
  const birth = new Date(birthdate);
  if (Number.isNaN(birth.getTime())) return 'Birthdate is invalid.';
  if (birth.getTime() > now.getTime()) return 'Birthdate cannot be in the future.';

  const maxAgeMs = MAX_BABY_AGE_YEARS * 365.25 * 24 * 60 * 60 * 1000;
  if (now.getTime() - birth.getTime() > maxAgeMs) {
    return `Birthdate must be within the last ${MAX_BABY_AGE_YEARS} years.`;
  }

  return null;
};

export const isBabyProfileComplete = (name?: string | null, birthdateIso?: string | null) => {
  if (!name?.trim() || !birthdateIso) return false;
  const birthdate = new Date(birthdateIso);
  return validateBabyProfile(name, birthdate) === null;
};

