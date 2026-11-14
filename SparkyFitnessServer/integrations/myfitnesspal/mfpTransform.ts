import type { MyFitnessPalWeightUnit } from '@workspace/shared';

/**
 * Pure transforms from MyFitnessPal Premium export CSV rows to the shapes of
 * the three existing import services. No I/O here — the orchestrator parses the
 * ZIP and feeds the parsed rows in. The export is meal-level aggregates only
 * (no food names, brands, or quantities), so nutrition lands as one synthetic
 * food per meal (quantity 1, unit "meal") carrying the meal's snapshot totals.
 */

// ── CSV row shapes (verified against a real Premium export) ─────────────────

export interface MfpNutritionRow {
  Date?: string;
  Meal?: string;
  Calories?: number;
  'Fat (g)'?: number;
  'Saturated Fat'?: number;
  'Polyunsaturated Fat'?: number;
  'Monounsaturated Fat'?: number;
  'Trans Fat'?: number;
  Cholesterol?: number;
  'Sodium (mg)'?: number;
  Potassium?: number;
  'Carbohydrates (g)'?: number;
  Fiber?: number;
  Sugar?: number;
  'Protein (g)'?: number;
  'Vitamin A'?: number;
  'Vitamin C'?: number;
  Calcium?: number;
  Iron?: number;
  Note?: string;
}

export interface MfpMeasurementRow {
  Date?: string;
  Weight?: number;
}

export interface MfpExerciseRow {
  Date?: string;
  Exercise?: string;
  Type?: string;
  'Exercise Calories'?: number;
  'Exercise Minutes'?: number;
  Sets?: number;
  'Reps Per Set'?: number;
  Pounds?: number;
  Steps?: number;
  Note?: string;
}

// ── Output shapes ────────────────────────────────────────────────────────────

/**
 * A food-diary row shaped for `importFoodDiaryEntriesInBulk`. The index
 * signature matches `FoodDiaryImportRow`, which the bulk importer expects, and
 * lets the nutrient map assign into a row by key.
 */
export interface MfpNutritionDiaryRow {
  date: string;
  meal_type: string;
  food_name: string;
  quantity: number;
  unit: string;
  calories?: number;
  fat?: number;
  saturated_fat?: number;
  polyunsaturated_fat?: number;
  monounsaturated_fat?: number;
  trans_fat?: number;
  cholesterol?: number;
  sodium?: number;
  potassium?: number;
  carbs?: number;
  dietary_fiber?: number;
  sugars?: number;
  protein?: number;
  vitamin_a?: number;
  vitamin_c?: number;
  calcium?: number;
  iron?: number;
  [column: string]: unknown;
}

/** A health-data item shaped for `processHealthData` (weight, stored in kg). */
export interface MfpWeightItem {
  type: 'weight';
  value: number;
  date: string;
  source: string;
}

/** An exercise entry group shaped for `importExerciseEntriesFromCsv`. */
export interface MfpExerciseEntryGroup {
  entry_date: string;
  exercise_name: string;
  exercise_category?: string;
  calories_burned?: number;
  sets: {
    set_number: number;
    reps?: number;
    weight?: number;
    duration_min?: number;
  }[];
}

export interface MfpTransformResult<T> {
  rows: T[];
  skipped: number;
}

const LB_TO_KG = 0.453592;

// MFP books a synthetic "Garmin Connect calorie adjustment" row to reconcile
// device-reported calories; it is not a real workout and is dropped.
const GARMIN_ARTIFACT = 'garmin connect calorie adjustment';

const toNum = (value: unknown): number | undefined => {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : undefined;
};

// ── Nutrition ────────────────────────────────────────────────────────────────

/**
 * Maps each MFP nutrition row to a synthetic food-diary row. `food_name` is the
 * meal name so all entries of the same meal reuse one auto-created food, and
 * the per-row snapshot columns carry that day's totals (authoritative on the
 * entry, never mutating the library food).
 */
export function transformNutrition(
  rows: MfpNutritionRow[]
): MfpTransformResult<MfpNutritionDiaryRow> {
  const out: MfpNutritionDiaryRow[] = [];
  let skipped = 0;
  for (const row of rows) {
    const date = (row.Date ?? '').trim();
    const meal = (row.Meal ?? '').trim();
    if (!date || !meal) {
      skipped++;
      continue;
    }
    const diary: MfpNutritionDiaryRow = {
      date,
      meal_type: meal,
      food_name: meal,
      quantity: 1,
      unit: 'meal',
    };
    const map: [keyof MfpNutritionDiaryRow, keyof MfpNutritionRow][] = [
      ['calories', 'Calories'],
      ['fat', 'Fat (g)'],
      ['saturated_fat', 'Saturated Fat'],
      ['polyunsaturated_fat', 'Polyunsaturated Fat'],
      ['monounsaturated_fat', 'Monounsaturated Fat'],
      ['trans_fat', 'Trans Fat'],
      ['cholesterol', 'Cholesterol'],
      ['sodium', 'Sodium (mg)'],
      ['potassium', 'Potassium'],
      ['carbs', 'Carbohydrates (g)'],
      ['dietary_fiber', 'Fiber'],
      ['sugars', 'Sugar'],
      ['protein', 'Protein (g)'],
      ['vitamin_a', 'Vitamin A'],
      ['vitamin_c', 'Vitamin C'],
      ['calcium', 'Calcium'],
      ['iron', 'Iron'],
    ];
    let hasNutrient = false;
    for (const [target, sourceKey] of map) {
      const n = toNum(row[sourceKey]);
      if (n !== undefined) {
        diary[target] = n;
        hasNutrient = true;
      }
    }
    if (!hasNutrient) {
      skipped++;
      continue;
    }
    out.push(diary);
  }
  return { rows: out, skipped };
}

// ── Measurement ──────────────────────────────────────────────────────────────

/**
 * Maps MFP weight rows to health-data items. The export carries no unit of its
 * own, so `weightUnit` tells us what the scale recorded; the value is stored in
 * kg (the handler stores `value` as-is), so lb is converted here.
 */
export function transformMeasurements(
  rows: MfpMeasurementRow[],
  weightUnit: MyFitnessPalWeightUnit
): MfpTransformResult<MfpWeightItem> {
  const out: MfpWeightItem[] = [];
  let skipped = 0;
  for (const row of rows) {
    const date = (row.Date ?? '').trim();
    const raw = toNum(row.Weight);
    if (!date || raw === undefined || raw <= 0) {
      skipped++;
      continue;
    }
    const kg = weightUnit === 'lb' ? raw * LB_TO_KG : raw;
    out.push({ type: 'weight', value: kg, date, source: 'MFP_Import' });
  }
  return { rows: out, skipped };
}

// ── Exercise ─────────────────────────────────────────────────────────────────

/**
 * Maps MFP exercise rows to entry groups. The "Pounds" column is always pounds;
 * it is emitted in `exerciseWeightUnit` (the user's preferred weight unit) so
 * the importer's unit handling (which converts lbs→kg only when the pref is
 * lbs) stores the right value. A single set carries the minutes (as
 * `duration_min`), and weight/reps when present; the Garmin adjustment artifact
 * is skipped.
 */
export function transformExercise(
  rows: MfpExerciseRow[],
  exerciseWeightUnit: MyFitnessPalWeightUnit
): MfpTransformResult<MfpExerciseEntryGroup> {
  const out: MfpExerciseEntryGroup[] = [];
  let skipped = 0;
  for (const row of rows) {
    const date = (row.Date ?? '').trim();
    const name = (row.Exercise ?? '').trim();
    if (!date || !name) {
      skipped++;
      continue;
    }
    if (name.toLowerCase() === GARMIN_ARTIFACT) {
      skipped++;
      continue;
    }
    const minutes = toNum(row['Exercise Minutes']);
    const reps = toNum(row['Reps Per Set']);
    const pounds = toNum(row.Pounds);
    const calories = toNum(row['Exercise Calories']);

    const set: MfpExerciseEntryGroup['sets'][number] = { set_number: 1 };
    if (minutes !== undefined && minutes > 0) set.duration_min = minutes;
    if (reps !== undefined && reps > 0) set.reps = Math.round(reps);
    if (pounds !== undefined && pounds > 0) {
      set.weight = exerciseWeightUnit === 'lb' ? pounds : pounds * LB_TO_KG;
    }

    const group: MfpExerciseEntryGroup = {
      entry_date: date,
      exercise_name: name,
      sets: [set],
    };
    const category = (row.Type ?? '').trim();
    if (category) group.exercise_category = category;
    if (calories !== undefined && calories > 0)
      group.calories_burned = calories;

    out.push(group);
  }
  return { rows: out, skipped };
}

/**
 * Min/max date across exercise entry groups, for the delete-then-insert
 * idempotency window. Null when there are no groups.
 */
export function exerciseDateRange(
  groups: MfpExerciseEntryGroup[]
): { start: string; end: string } | null {
  if (groups.length === 0) return null;
  let start = groups[0]!.entry_date;
  let end = groups[0]!.entry_date;
  for (const g of groups) {
    if (g.entry_date < start) start = g.entry_date;
    if (g.entry_date > end) end = g.entry_date;
  }
  return { start, end };
}
