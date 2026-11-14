import { describe, expect, it } from 'vitest';
import {
  transformNutrition,
  transformMeasurements,
  transformExercise,
  exerciseDateRange,
  type MfpNutritionRow,
  type MfpMeasurementRow,
  type MfpExerciseRow,
} from '../integrations/myfitnesspal/mfpTransform.js';

describe('transformNutrition', () => {
  it('maps a meal row to a synthetic diary row with snapshot totals', () => {
    const row: MfpNutritionRow = {
      Date: '2026-10-14',
      Meal: 'Breakfast',
      Calories: 610.1,
      'Fat (g)': 12.8,
      'Saturated Fat': 4.5,
      'Polyunsaturated Fat': 0.4,
      'Monounsaturated Fat': 0.1,
      'Trans Fat': 0.0,
      Cholesterol: 31.3,
      'Sodium (mg)': 306.7,
      Potassium: 749.3,
      'Carbohydrates (g)': 74.4,
      Fiber: 11.1,
      Sugar: 32.1,
      'Protein (g)': 51.2,
      'Vitamin A': 0.0,
      'Vitamin C': 6.3,
      Calcium: 43.7,
      Iron: 10.8,
    };
    const { rows, skipped } = transformNutrition([row]);
    expect(skipped).toBe(0);
    expect(rows).toHaveLength(1);
    const r = rows[0]!;
    expect(r.date).toBe('2026-10-14');
    expect(r.meal_type).toBe('Breakfast');
    expect(r.food_name).toBe('Breakfast');
    expect(r.quantity).toBe(1);
    expect(r.unit).toBe('meal');
    expect(r.calories).toBe(610.1);
    expect(r.protein).toBe(51.2);
    expect(r.carbs).toBe(74.4);
    expect(r.fat).toBe(12.8);
    expect(r.dietary_fiber).toBe(11.1);
    expect(r.sugars).toBe(32.1);
  });

  it('skips rows with no date or meal', () => {
    const { rows, skipped } = transformNutrition([
      { Date: '', Meal: 'Lunch', Calories: 100 },
      { Date: '2026-01-01', Meal: '' },
    ]);
    expect(rows).toHaveLength(0);
    expect(skipped).toBe(2);
  });

  it('skips a row with no nutrients at all', () => {
    const { rows, skipped } = transformNutrition([
      { Date: '2026-01-01', Meal: 'Lunch' },
    ]);
    expect(rows).toHaveLength(0);
    expect(skipped).toBe(1);
  });
});

describe('transformMeasurements', () => {
  it('converts lb to kg when the unit is lb', () => {
    const row: MfpMeasurementRow = { Date: '2026-10-14', Weight: 177.0 };
    const { rows } = transformMeasurements([row], 'lb');
    expect(rows).toHaveLength(1);
    expect(rows[0]!.type).toBe('weight');
    expect(rows[0]!.value).toBeCloseTo(177 * 0.453592, 5);
    expect(rows[0]!.source).toBe('MFP_Import');
  });

  it('passes kg through unchanged', () => {
    const row: MfpMeasurementRow = { Date: '2026-10-14', Weight: 80.2 };
    const { rows } = transformMeasurements([row], 'kg');
    expect(rows[0]!.value).toBeCloseTo(80.2, 5);
  });

  it('skips non-positive or missing weights', () => {
    const { rows, skipped } = transformMeasurements(
      [
        { Date: '2026-01-01', Weight: 0 },
        { Date: '2026-01-01', Weight: -5 },
        { Date: '', Weight: 80 },
      ],
      'kg'
    );
    expect(rows).toHaveLength(0);
    expect(skipped).toBe(3);
  });
});

describe('transformExercise', () => {
  it('maps a cardio row to a duration-only entry', () => {
    const row: MfpExerciseRow = {
      Date: '2026-10-14',
      Exercise: 'Walking, 3.0 mph, mod. pace',
      Type: 'Cardio',
      'Exercise Calories': 125,
      'Exercise Minutes': 24,
    };
    const { rows } = transformExercise([row], 'kg');
    expect(rows).toHaveLength(1);
    const g = rows[0]!;
    expect(g.exercise_name).toBe('Walking, 3.0 mph, mod. pace');
    expect(g.exercise_category).toBe('Cardio');
    expect(g.calories_burned).toBe(125);
    expect(g.sets).toHaveLength(1);
    expect(g.sets[0]!.duration_min).toBe(24);
    expect(g.sets[0]!.weight).toBeUndefined();
  });

  it('emits weight in the requested unit (lbs passthrough)', () => {
    const row: MfpExerciseRow = {
      Date: '2026-10-14',
      Exercise: 'Bench Press',
      'Exercise Minutes': 10,
      'Reps Per Set': 8,
      Pounds: 180,
    };
    const { rows } = transformExercise([row], 'lb');
    expect(rows[0]!.sets[0]!.weight).toBe(180);
    expect(rows[0]!.sets[0]!.reps).toBe(8);
  });

  it('converts pounds to kg when the user prefers kg', () => {
    const row: MfpExerciseRow = {
      Date: '2026-10-14',
      Exercise: 'Bench Press',
      'Exercise Minutes': 10,
      Pounds: 180,
    };
    const { rows } = transformExercise([row], 'kg');
    expect(rows[0]!.sets[0]!.weight).toBeCloseTo(180 * 0.453592, 5);
  });

  it('skips the Garmin Connect calorie adjustment artifact', () => {
    const row: MfpExerciseRow = {
      Date: '2026-10-14',
      Exercise: 'Garmin Connect calorie adjustment',
      Type: 'Cardio',
      'Exercise Calories': 0,
      'Exercise Minutes': 1,
      Steps: 1729,
    };
    const { rows, skipped } = transformExercise([row], 'kg');
    expect(rows).toHaveLength(0);
    expect(skipped).toBe(1);
  });
});

describe('exerciseDateRange', () => {
  it('returns min/max across groups', () => {
    const range = exerciseDateRange([
      { entry_date: '2026-11-01', exercise_name: 'a', sets: [] },
      { entry_date: '2026-10-14', exercise_name: 'b', sets: [] },
      { entry_date: '2026-10-20', exercise_name: 'c', sets: [] },
    ]);
    expect(range).toEqual({ start: '2026-10-14', end: '2026-11-01' });
  });

  it('returns null for an empty list', () => {
    expect(exerciseDateRange([])).toBeNull();
  });
});
