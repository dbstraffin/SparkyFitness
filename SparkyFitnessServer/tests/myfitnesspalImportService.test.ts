import { vi, beforeEach, describe, expect, it } from 'vitest';

vi.mock('../config/logging', () => ({ log: vi.fn() }));
vi.mock('../utils/zipUtils', () => ({
  parseZipArchive: vi.fn(),
}));
vi.mock('../services/foodEntryService', () => ({
  importFoodDiaryEntriesInBulk: vi.fn(),
}));
vi.mock('../services/measurementService', () => ({
  default: { processHealthData: vi.fn() },
}));
vi.mock('../services/exerciseEntryService', () => ({
  default: { importExerciseEntriesFromCsv: vi.fn() },
}));
vi.mock('../models/exerciseEntry', () => ({
  default: { deleteExerciseEntriesByEntrySourceAndDate: vi.fn() },
}));
vi.mock('../models/preferenceRepository', () => ({
  default: { getUserPreferences: vi.fn() },
}));

import { parseZipArchive } from '../utils/zipUtils.js';
import { importFoodDiaryEntriesInBulk } from '../services/foodEntryService.js';
import measurementService from '../services/measurementService.js';
import exerciseEntryService from '../services/exerciseEntryService.js';
import exerciseEntryRepository from '../models/exerciseEntry.js';
import preferenceRepository from '../models/preferenceRepository.js';
import { importMyFitnessPalExport } from '../services/myfitnesspalImportService.js';

const mockParse = parseZipArchive as ReturnType<typeof vi.fn>;
const mockFoodBulk = importFoodDiaryEntriesInBulk as ReturnType<typeof vi.fn>;
const mockProcessHealth = measurementService.processHealthData as ReturnType<
  typeof vi.fn
>;
const mockExerciseImport =
  exerciseEntryService.importExerciseEntriesFromCsv as ReturnType<typeof vi.fn>;
const mockDelete =
  exerciseEntryRepository.deleteExerciseEntriesByEntrySourceAndDate as ReturnType<
    typeof vi.fn
  >;
const mockPrefs = preferenceRepository.getUserPreferences as ReturnType<
  typeof vi.fn
>;

// A fake ZIP entry whose getData() returns the given CSV text.
const fakeEntry = (path: string, text: string) => ({
  path,
  isDirectory: false,
  uncompressedSize: text.length,
  getData: () => Buffer.from(text),
});

const nutritionCsv = [
  'Date,Meal,Calories,Protein (g)',
  '2026-10-14,Breakfast,610.1,51.2',
].join('\n');
const measurementCsv = ['Date,Weight', '2026-10-14,177.0'].join('\n');
const exerciseCsv = [
  'Date,Exercise,Type,Exercise Calories,Exercise Minutes,Sets,Reps Per Set,Pounds,Steps,Note',
  '2026-10-14,Walking,Cardio,125,24,,,,',
].join('\n');

const allEntries = () => [
  fakeEntry('Nutrition-Summary.csv', nutritionCsv),
  fakeEntry('Measurement-Summary.csv', measurementCsv),
  fakeEntry('Exercise-Summary.csv', exerciseCsv),
];

beforeEach(() => {
  vi.clearAllMocks();
});

describe('importMyFitnessPalExport', () => {
  it('imports all three selected domains', async () => {
    mockParse.mockReturnValue(allEntries());
    mockFoodBulk.mockResolvedValue({
      message: 'ok',
      processed: [{ id: '1' }],
      errors: [],
      skipped: [],
    });
    mockProcessHealth.mockResolvedValue({
      message: 'ok',
      processed: [{ type: 'weight', status: 'success' }],
      errors: [],
      skipped: [],
    });
    mockPrefs.mockResolvedValue({ default_weight_unit: 'kg' });
    mockExerciseImport.mockResolvedValue({
      message: 'ok',
      created: 1,
      updated: 0,
      failed: 0,
    });

    const result = await importMyFitnessPalExport(
      'user-1',
      'user-1',
      Buffer.alloc(0),
      {
        weightUnit: 'lb',
        domains: ['nutrition', 'measurement', 'exercise'],
      }
    );

    expect(result.nutrition.selected).toBe(true);
    expect(result.nutrition.imported).toBe(1);
    expect(result.measurement.selected).toBe(true);
    expect(result.measurement.imported).toBe(1);
    expect(result.exercise.selected).toBe(true);
    expect(result.exercise.imported).toBe(1);
    // Exercise idempotency: delete the MFP-source window before inserting.
    expect(mockDelete).toHaveBeenCalled();
    expect(mockExerciseImport).toHaveBeenCalledWith(
      'user-1',
      'user-1',
      expect.any(Array),
      'MFP_Import'
    );
  });

  it('leaves unselected domains untouched', async () => {
    mockParse.mockReturnValue(allEntries());
    mockPrefs.mockResolvedValue({ default_weight_unit: 'kg' });

    const result = await importMyFitnessPalExport(
      'user-1',
      'user-1',
      Buffer.alloc(0),
      {
        weightUnit: 'lb',
        domains: ['measurement'],
      }
    );

    expect(result.nutrition.selected).toBe(false);
    expect(result.nutrition.imported).toBe(0);
    expect(result.exercise.selected).toBe(false);
    expect(result.measurement.selected).toBe(true);
    expect(mockFoodBulk).not.toHaveBeenCalled();
    expect(mockExerciseImport).not.toHaveBeenCalled();
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('reports a missing CSV file as a failure for that domain', async () => {
    mockParse.mockReturnValue([
      fakeEntry('Measurement-Summary.csv', measurementCsv),
    ]);
    mockPrefs.mockResolvedValue({ default_weight_unit: 'kg' });

    const result = await importMyFitnessPalExport(
      'user-1',
      'user-1',
      Buffer.alloc(0),
      {
        weightUnit: 'lb',
        domains: ['nutrition', 'exercise'],
      }
    );

    expect(result.nutrition.selected).toBe(true);
    expect(result.nutrition.failed).toBe(1);
    expect(result.exercise.selected).toBe(true);
    expect(result.exercise.failed).toBe(1);
  });
});
