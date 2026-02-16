import { describe, expect, it } from 'vitest';
import { displayToKg, displayToMl, kgToDisplay, mlToDisplay } from './units';

describe('units conversion', () => {
  it('round-trips ml and oz', () => {
    const ml = displayToMl(4, 'oz');
    const oz = mlToDisplay(ml, 'oz');
    expect(oz).toBeCloseTo(4, 5);
  });

  it('round-trips kg and lb', () => {
    const kg = displayToKg(10, 'lb');
    const lb = kgToDisplay(kg, 'lb');
    expect(lb).toBeCloseTo(10, 5);
  });

  it('keeps canonical unit unchanged', () => {
    expect(displayToMl(90, 'ml')).toBe(90);
    expect(displayToKg(5.5, 'kg')).toBe(5.5);
  });
});
