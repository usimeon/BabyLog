import { getOrCreateDefaultBaby } from './babyRepo';
import { migrate } from './migrations';
import { getAmountUnit, getReminderSettings, getWeightUnit, setAmountUnit, setWeightUnit } from './settingsRepo';

let initialized = false;

export const initDatabase = async () => {
  if (initialized) return;
  await migrate();
  await getOrCreateDefaultBaby();

  const amount = await getAmountUnit();
  if (!amount) await setAmountUnit('ml');

  const weight = await getWeightUnit();
  if (!weight) await setWeightUnit('kg');

  await getReminderSettings();
  initialized = true;
};
