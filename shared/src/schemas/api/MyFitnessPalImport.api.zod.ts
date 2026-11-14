import { z } from 'zod';

/**
 * MyFitnessPal Premium CSV-export import.
 *
 * The client uploads the ZIP MyFitnessPal ships with "Premium Export" (three
 * CSVs: Nutrition-Summary, Measurement-Summary, Exercise-Summary) plus the
 * weight unit the export was recorded in. The server unzips it, transforms each
 * CSV into the shapes of the three existing import services, and reports per
 * domain counts. The export is meal-level aggregates only — no food names,
 * brands, or quantities — so nutrition lands as one synthetic food per meal.
 */

/**
 * The unit the weight figures in the export were recorded in. MyFitnessPal
 * exports carry no unit of their own, so the client tells us. Weight is stored
 * canonically in kg; the transform converts lb→kg when this is 'lb'.
 */
export const myFitnessPalWeightUnitSchema = z.enum(['kg', 'lb']);

export type MyFitnessPalWeightUnit = z.infer<
  typeof myFitnessPalWeightUnitSchema
>;

/**
 * The three importable domains, one per CSV in the export. The client toggles
 * which to import so a user can pull only the slice they want (e.g. weight
 * history only) without re-importing the rest.
 */
export const myFitnessPalImportDomainSchema = z.enum([
  'nutrition',
  'measurement',
  'exercise',
]);

export type MyFitnessPalImportDomain = z.infer<
  typeof myFitnessPalImportDomainSchema
>;

export const myFitnessPalImportRequestSchema = z.object({
  weightUnit: myFitnessPalWeightUnitSchema.default('lb'),
  domains: z
    .array(myFitnessPalImportDomainSchema)
    .min(1, 'Select at least one domain to import')
    .default(['nutrition', 'measurement', 'exercise']),
});

export type MyFitnessPalImportRequest = z.infer<
  typeof myFitnessPalImportRequestSchema
>;

/** Per-domain outcome of a single import run. */
export const myFitnessPalImportDomainResultSchema = z
  .object({
    /** True when this domain was selected and processed; false when skipped by the user's toggles. */
    selected: z.boolean(),
    /** Rows/entries successfully written. */
    imported: z.number().int().min(0),
    /** Rows skipped (blank, unparseable, or a known artifact). */
    skipped: z.number().int().min(0),
    /** Rows that failed and were not written. */
    failed: z.number().int().min(0),
  })
  .strict();

export type MyFitnessPalImportDomainResult = z.infer<
  typeof myFitnessPalImportDomainResultSchema
>;

export const myFitnessPalImportResponseSchema = z
  .object({
    message: z.string(),
    nutrition: myFitnessPalImportDomainResultSchema,
    measurement: myFitnessPalImportDomainResultSchema,
    exercise: myFitnessPalImportDomainResultSchema,
  })
  .strict();

export type MyFitnessPalImportResponse = z.infer<
  typeof myFitnessPalImportResponseSchema
>;

/** A domain result for a domain the user did not select (all counters zero). */
export const myFitnessPalImportDomainSkipped =
  (): MyFitnessPalImportDomainResult => ({
    selected: false,
    imported: 0,
    skipped: 0,
    failed: 0,
  });
