import Papa from 'papaparse';
import { parseZipArchive, type ZipEntry } from '../utils/zipUtils.js';
import {
  transformNutrition,
  transformMeasurements,
  transformExercise,
  exerciseDateRange,
  type MfpNutritionRow,
  type MfpMeasurementRow,
  type MfpExerciseRow,
} from '../integrations/myfitnesspal/mfpTransform.js';
import { importFoodDiaryEntriesInBulk } from './foodEntryService.js';
import measurementService from './measurementService.js';
import exerciseEntryService from './exerciseEntryService.js';
import exerciseEntryRepository from '../models/exerciseEntry.js';
import preferenceRepository from '../models/preferenceRepository.js';
import { log } from '../config/logging.js';
import type {
  MyFitnessPalImportDomain,
  MyFitnessPalImportDomainResult,
  MyFitnessPalImportRequest,
} from '@workspace/shared';

const MFP_EXERCISE_SOURCE = 'MFP_Import';

function findZipEntry(
  entries: ZipEntry[],
  ...patterns: string[]
): ZipEntry | undefined {
  return entries.find((e) => {
    const norm = e.path.toLowerCase().replace(/[\s_.-]+/g, '');
    return patterns.some((p) => norm.includes(p.replace(/[\s_.-]+/g, '')));
  });
}

function parseCsv<T>(buffer: Buffer): T[] {
  const result = Papa.parse<T>(buffer.toString('utf8'), {
    header: true,
    dynamicTyping: true,
    skipEmptyLines: true,
  });
  return result.data;
}

const domainSkipped = (): MyFitnessPalImportDomainResult => ({
  selected: false,
  imported: 0,
  skipped: 0,
  failed: 0,
});

/**
 * Ingests a MyFitnessPal Premium export ZIP. The ZIP is parsed in memory, the
 * three summary CSVs are located by filename pattern, transformed into the
 * shapes of the three existing import services, and imported. Domains the user
 * did not select are left untouched. Returns a per-domain count summary.
 */
export async function importMyFitnessPalExport(
  userId: string,
  actingUserId: string,
  zipBuffer: Buffer,
  options: MyFitnessPalImportRequest
): Promise<{
  message: string;
  nutrition: MyFitnessPalImportDomainResult;
  measurement: MyFitnessPalImportDomainResult;
  exercise: MyFitnessPalImportDomainResult;
}> {
  const entries = parseZipArchive(zipBuffer);
  const selected = new Set<MyFitnessPalImportDomain>(options.domains);

  const nutritionEntry = findZipEntry(
    entries,
    'nutritiosummary',
    'nutritionsummary'
  );
  const measurementEntry = findZipEntry(
    entries,
    'measurementssummary',
    'measurementsummary'
  );
  const exerciseEntry = findZipEntry(
    entries,
    'exercisesummary',
    'exercisesummary'
  );

  const nutrition: MyFitnessPalImportDomainResult = domainSkipped();
  const measurement: MyFitnessPalImportDomainResult = domainSkipped();
  const exercise: MyFitnessPalImportDomainResult = domainSkipped();

  // Nutrition → food diary.
  if (selected.has('nutrition')) {
    if (!nutritionEntry) {
      nutrition.failed = 1;
      nutrition.selected = true;
    } else {
      const rows = parseCsv<MfpNutritionRow>(nutritionEntry.getData());
      const { rows: diaryRows, skipped } = transformNutrition(rows);
      const result = await importFoodDiaryEntriesInBulk(
        userId,
        actingUserId,
        diaryRows,
        {},
        false
      );
      nutrition.selected = true;
      nutrition.imported = result.processed.length;
      nutrition.skipped = skipped + result.errors.length;
      nutrition.failed = 0;
    }
  }

  // Measurement → check-in weights.
  if (selected.has('measurement')) {
    if (!measurementEntry) {
      measurement.failed = 1;
      measurement.selected = true;
    } else {
      const rows = parseCsv<MfpMeasurementRow>(measurementEntry.getData());
      const { rows: weightItems, skipped } = transformMeasurements(
        rows,
        options.weightUnit
      );
      const result = await measurementService.processHealthData(
        weightItems,
        userId,
        actingUserId
      );
      measurement.selected = true;
      measurement.imported = result.processed.length;
      measurement.skipped = skipped + result.skipped.length;
      measurement.failed = result.errors.length;
    }
  }

  // Exercise → exercise history (delete-then-insert idempotency).
  if (selected.has('exercise')) {
    if (!exerciseEntry) {
      exercise.failed = 1;
      exercise.selected = true;
    } else {
      const rows = parseCsv<MfpExerciseRow>(exerciseEntry.getData());
      const prefs = await preferenceRepository.getUserPreferences(userId);
      const weightUnit = prefs?.default_weight_unit === 'lbs' ? 'lb' : 'kg';
      const { rows: entryGroups, skipped } = transformExercise(
        rows,
        weightUnit
      );

      const range = exerciseDateRange(entryGroups);
      if (range) {
        await exerciseEntryRepository.deleteExerciseEntriesByEntrySourceAndDate(
          userId,
          range.start,
          range.end,
          MFP_EXERCISE_SOURCE
        );
      }

      const result = await exerciseEntryService.importExerciseEntriesFromCsv(
        userId,
        actingUserId,
        entryGroups,
        MFP_EXERCISE_SOURCE
      );
      exercise.selected = true;
      exercise.imported = result.created;
      exercise.skipped = skipped;
      exercise.failed = result.failed;
    }
  }

  const totalImported =
    nutrition.imported + measurement.imported + exercise.imported;
  const message =
    totalImported > 0
      ? 'MyFitnessPal export imported successfully.'
      : 'No MyFitnessPal data was imported.';

  log(
    'info',
    `[MyFitnessPal] Import for ${userId}: nutrition=${nutrition.imported}, measurement=${measurement.imported}, exercise=${exercise.imported}`
  );

  return { message, nutrition, measurement, exercise };
}

export default { importMyFitnessPalExport };
