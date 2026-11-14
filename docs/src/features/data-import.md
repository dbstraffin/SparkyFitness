# Importing your data

SparkyFitness provides generic CSV importers for bringing your history in from other apps: **Food Diary**, **Workout History**, and **Check-in & Health Data**. The importers parse the file in your browser and let you map your file's columns to the expected fields, so the same importer works for many sources — including exports from MyFitnessPal, Flo, Hevy, and others.

Everything lives in **Settings → Data Import**, where each importer is a labelled row with an **Import** button. These are one-time migration tools, which is why they live in Settings rather than on the daily screens.

## Food Diary

Logs past meals to your food diary by date and meal type, matching or creating foods as needed.

Expected columns:

- `date`, `meal_type`, `meal_name`, `food_name`, `brand`, `quantity`, `unit`
- Nutrients: `calories`, `protein`, `carbs`, `fat`, `saturated_fat`, `polyunsaturated_fat`, `monounsaturated_fat`, `trans_fat`, `cholesterol`, `sodium`, `potassium`, `dietary_fiber`, `sugars`, `vitamin_a`, `vitamin_c`, `calcium`, `iron`

Any extra column beyond the base set is treated as a custom nutrient by name.

## Workout History

Imports past workouts, sets, reps, and weights. The system creates new exercises or presets if they don't exist, and imports your entries, sets, and activity details.

Required columns:

- `entry_date`, `exercise_name`, `exercise_force`, `exercise_level`, `exercise_mechanic`

Optional per-set columns:

- `set_number`, `reps`, `weight`, `duration_min`, `rest_time_sec`

The dropdown columns accept standard values: `exercise_force` is `pull`, `push`, or `static`; `exercise_level` is `beginner`, `intermediate`, or `expert`; `exercise_mechanic` is `isolation` or `compound`. **Activity Field** and **Value** are custom fields you can add to each entry.

## Check-in & Health Data

Imports body measurements, sleep, vitals, activity, hydration, and mood. The importer has a category selector, and the expected columns depend on the category:

- **Body Measurements**: `date`, `weight`, `weight_unit`, `body_fat`, `height`, `neck`, `waist`, `hips`, `length_unit`
- **Sleep**: `date`, `bedtime`, `wake_time`, `duration_in_seconds`, `time_asleep_in_seconds`, `deep_sleep_seconds`, `light_sleep_seconds`, `rem_sleep_seconds`, `awake_sleep_seconds`, `sleep_score`, `stage_events`, `source`
- **Vitals & Custom**: `date`, `type`, `value`, `unit`, `source`, `notes`
- **Daily Activity**: `date`, `type`, `value`, `unit`, `source`
- **Hydration**: `date`, `value`, `unit`, `source`
- **Mood**: `date`, `mood_value`, `mood_tags`, `notes`

Each category has a downloadable template and a set of accepted values shown in the UI.

## Matching columns

Most columns are auto-detected from the header row. The importer normalizes headers before matching — it ignores case, underscores, spaces, and punctuation, and strips parenthetical units (so `Protein (g)` matches `Protein`). It also recognizes common aliases:

- `Carbohydrates` → `carbs`
- `Fiber` → `dietary_fiber`
- `Sugar` → `sugars`
- `Date` → `entry_date` (Workout History)

Matching is by name only, never by column position or content, so a column that can't be auto-matched is left unmapped rather than guessed. When a required column can't be matched, a mapping dialog appears and you assign the file column to the expected field by hand.

## Migrating from MyFitnessPal

MyFitnessPal's file export is a **Premium / Premium+** feature — free accounts can't download the CSVs (they can print a report or share their diary, but that's not the same as the export).

**Getting the export.** Request it from the app (**More** → **Nutrition**/**Progress** → **Export**) or the website (**Reports** → **Export**), pick a date range, and confirm your email. MyFitnessPal emails the ZIP to your account email. For the current, authoritative steps, see [MyFitnessPal's export guide](https://support.myfitnesspal.com/hc/en-us/articles/360032273352-Export-your-nutrition-progress-and-exercise-data) — their menus shift from time to time.

**What's in the ZIP.** Three CSVs (named `<Type>-Summary-<date-range>.csv`), each mapping to one of the generic importers:

- `Nutrition-Summary-…` → **Food Diary**
- `Measurement-Summary-…` → **Check-in & Health Data**
- `Exercise-Summary-…` → **Workout History**

Unzip the file, then import each CSV into its matching importer. The header matching above absorbs most of the differences (MFP's `Protein (g)`, `Carbohydrates (g)`, `Fiber`, `Sugar`, `Meal`, and `Date` all map automatically); any remaining column is mapped by hand in the mapping dialog.

> [!NOTE]
> The MyFitnessPal export is a summary, not a detailed log. Nutrition comes in as one entry per meal (totals, not individual foods), weight carries no unit of its own, and exercise is one row per day. The import reflects what the export contains; it can't produce detail the export doesn't have.

## Why the importers are generic

SparkyFitness favors generic importers over per-vendor parsers. Vendor export formats change over time, and headers vary by account language, so a parser built for one vendor tends to break and needs constant upkeep. The generic importers are maintained centrally, and the header-mapping dialog is the escape hatch: when a column can't be auto-matched, you map it by hand.

For any app — MyFitnessPal, Flo, Hevy, and so on — the workflow is the same: export your data, then import it through the generic importers, mapping columns as needed.

## Related pages

- [Check-In](/features/check-in)
- [Measurements](/features/measurements)
- [Food Database Manager](/features/food/food-database-manager)
- [Exercise Database Manager](/features/exercises/exercise-database-manager)
- [User Settings](/features/user-settings)
