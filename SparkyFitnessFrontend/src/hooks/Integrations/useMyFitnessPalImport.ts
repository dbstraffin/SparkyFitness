import { useMutation } from '@tanstack/react-query';
import { importMyFitnessPalExport } from '@/api/Integrations/myfitnesspalService';
import { useDiaryInvalidation } from '@/hooks/useInvalidateKeys';
import type {
  MyFitnessPalImportDomain,
  MyFitnessPalImportResponse,
  MyFitnessPalWeightUnit,
} from '@workspace/shared';

export interface MyFitnessPalImportVariables {
  file: File;
  weightUnit: MyFitnessPalWeightUnit;
  domains: MyFitnessPalImportDomain[];
}

/**
 * Uploads a MyFitnessPal Premium export ZIP and ingests the selected domains.
 * Success refreshes the diary family (food, measurement, exercise) so the newly
 * imported entries appear. Failures are shown inline by the page, so the
 * global toast is suppressed.
 */
export const useMyFitnessPalImportMutation = () => {
  const invalidateDiary = useDiaryInvalidation();

  return useMutation({
    mutationFn: (vars: MyFitnessPalImportVariables) =>
      importMyFitnessPalExport(vars),
    onSuccess: (_result: MyFitnessPalImportResponse) => {
      invalidateDiary();
    },
    meta: {
      silentError: true,
    },
  });
};
