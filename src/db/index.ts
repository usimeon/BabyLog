import { migrate } from './migrations';
import {
  getAmountUnit,
  getBackupSettings,
  getReminderSettings,
  getSmartAlertSettings,
  getTempUnit,
  getWeightUnit,
  setAmountUnit,
  setTempUnit,
  setWeightUnit,
} from './settingsRepo';

let initialized = false;

export const initDatabase = async () => {
  if (initialized) return;
  await migrate();

  const amount = await getAmountUnit();
  if (!amount) await setAmountUnit('ml');

  const weight = await getWeightUnit();
  if (!weight) await setWeightUnit('lb');

  const temp = await getTempUnit();
  if (!temp) await setTempUnit('f');

  await getReminderSettings();
  await getSmartAlertSettings();
  await getBackupSettings();
  initialized = true;
};
