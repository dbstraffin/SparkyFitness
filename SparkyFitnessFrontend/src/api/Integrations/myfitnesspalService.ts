import { apiCall } from '@/api/api';
import type {
  MyFitnessPalImportDomain,
  MyFitnessPalImportResponse,
  MyFitnessPalWeightUnit,
} from '@workspace/shared';

export interface MyFitnessPalImportParams {
  file: File;
  weightUnit: MyFitnessPalWeightUnit;
  domains: MyFitnessPalImportDomain[];
}

/**
 * Uploads the MyFitnessPal Premium export ZIP and the selected import options.
 * The server unzips and ingests the selected domains; the response carries
 * per-domain counts. Errors are surfaced inline by the caller (the dialog
 * reports the failure for the current upload only), so the global toast is
 * suppressed.
 */
export async function importMyFitnessPalExport(
  params: MyFitnessPalImportParams
): Promise<MyFitnessPalImportResponse> {
  const formData = new FormData();
  formData.append('file', params.file);
  formData.append('weightUnit', params.weightUnit);
  formData.append('domains', params.domains.join(','));
  return apiCall<MyFitnessPalImportResponse>(
    '/integrations/myfitnesspal/import',
    {
      method: 'POST',
      body: formData,
      isFormData: true,
      suppressErrorToast: true,
    }
  );
}
