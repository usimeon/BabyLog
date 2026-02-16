import { AmountUnit, WeightUnit } from '../types/models';

const OZ_TO_ML = 29.5735;
const LB_TO_KG = 0.45359237;

export const mlToDisplay = (valueMl: number, unit: AmountUnit) =>
  unit === 'ml' ? valueMl : valueMl / OZ_TO_ML;

export const displayToMl = (value: number, unit: AmountUnit) =>
  unit === 'ml' ? value : value * OZ_TO_ML;

export const kgToDisplay = (valueKg: number, unit: WeightUnit) =>
  unit === 'kg' ? valueKg : valueKg / LB_TO_KG;

export const displayToKg = (value: number, unit: WeightUnit) =>
  unit === 'kg' ? value : value * LB_TO_KG;

export const formatAmount = (valueMl?: number | null, unit: AmountUnit = 'ml') => {
  if (valueMl === null || valueMl === undefined) return '—';
  const value = mlToDisplay(valueMl, unit);
  return `${value.toFixed(1)} ${unit}`;
};

export const formatWeight = (valueKg?: number | null, unit: WeightUnit = 'kg') => {
  if (valueKg === null || valueKg === undefined) return '—';
  const value = kgToDisplay(valueKg, unit);
  return `${value.toFixed(2)} ${unit}`;
};
