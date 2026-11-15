import { isAggregateMapping } from '@/utils/csvAggregate';

const NUTRIENTS = ['calories', 'protein', 'carbs', 'fat'];

describe('isAggregateMapping', () => {
  it('detects a per-meal aggregate file (identity unmapped, nutrients mapped)', () => {
    const mapping: Record<string, string> = {
      date: 'Date',
      meal_type: 'Meal Type',
      calories: 'Calories',
      protein: 'Protein',
      carbs: 'Carbs',
      fat: 'Fat',
    };
    expect(isAggregateMapping(mapping, NUTRIENTS)).toBe(true);
  });

  it('returns false when food_name is mapped (per-food file)', () => {
    const mapping: Record<string, string> = {
      date: 'Date',
      meal_type: 'Meal',
      food_name: 'Food',
      quantity: 'Qty',
      unit: 'Unit',
      calories: 'Calories',
    };
    expect(isAggregateMapping(mapping, NUTRIENTS)).toBe(false);
  });

  it('returns false when quantity is mapped (per-food file)', () => {
    const mapping: Record<string, string> = {
      date: 'Date',
      meal_type: 'Meal',
      quantity: 'Qty',
      calories: 'Calories',
    };
    expect(isAggregateMapping(mapping, NUTRIENTS)).toBe(false);
  });

  it('returns false when no nutrients are mapped', () => {
    const mapping: Record<string, string> = {
      date: 'Date',
      meal_type: 'Meal',
    };
    expect(isAggregateMapping(mapping, NUTRIENTS)).toBe(false);
  });

  it('returns false for an empty mapping', () => {
    expect(isAggregateMapping({}, NUTRIENTS)).toBe(false);
  });
});
