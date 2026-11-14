import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Upload, Info } from 'lucide-react';
import { useMyFitnessPalImportMutation } from '@/hooks/Integrations/useMyFitnessPalImport';
import type {
  MyFitnessPalImportDomain,
  MyFitnessPalImportResponse,
  MyFitnessPalWeightUnit,
} from '@workspace/shared';

const DOMAINS: MyFitnessPalImportDomain[] = [
  'nutrition',
  'measurement',
  'exercise',
];

const DOMAIN_LABEL_KEYS: Record<MyFitnessPalImportDomain, string> = {
  nutrition: 'domainNutrition',
  measurement: 'domainMeasurement',
  exercise: 'domainExercise',
};

const MyFitnessPalImport = ({ onClose }: { onClose?: () => void }) => {
  const { t } = useTranslation();
  const { mutateAsync, isPending } = useMyFitnessPalImportMutation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [weightUnit, setWeightUnit] = useState<MyFitnessPalWeightUnit>('lb');
  const [selectedDomains, setSelectedDomains] = useState<
    Set<MyFitnessPalImportDomain>
  >(new Set(DOMAINS));
  const [result, setResult] = useState<MyFitnessPalImportResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const toggleDomain = (domain: MyFitnessPalImportDomain) => {
    setSelectedDomains((prev) => {
      const next = new Set(prev);
      if (next.has(domain)) next.delete(domain);
      else next.add(domain);
      return next;
    });
  };

  const handleImport = async () => {
    if (!file || selectedDomains.size === 0) return;
    setError(null);
    setResult(null);
    try {
      const response = await mutateAsync({
        file,
        weightUnit,
        domains: [...selectedDomains],
      });
      setResult(response);
      onClose?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const domainSummary = (domain: MyFitnessPalImportDomain): string => {
    const r = result?.[domain];
    if (!result || !r?.selected) return t('myfitnesspalImport.notSelected');
    const parts: string[] = [];
    if (r.imported > 0)
      parts.push(t('myfitnesspalImport.imported', { count: r.imported }));
    if (r.skipped > 0)
      parts.push(t('myfitnesspalImport.skipped', { count: r.skipped }));
    if (r.failed > 0)
      parts.push(t('myfitnesspalImport.failed', { count: r.failed }));
    return parts.length > 0 ? parts.join(' · ') : '—';
  };

  return (
    <div className="flex flex-col gap-6 p-2">
      <div className="flex items-start gap-2 rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <span>{t('myfitnesspalImport.limitations')}</span>
      </div>

      <div className="flex flex-col gap-2">
        <Label>{t('myfitnesspalImport.selectFile')}</Label>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className="flex items-center gap-2"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-4 w-4" />
            {t('myfitnesspalImport.selectFile')}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".zip"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </div>
        <span className="text-sm text-muted-foreground">
          {file
            ? t('myfitnesspalImport.fileSelected', { name: file.name })
            : t('myfitnesspalImport.noFile')}
        </span>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label>{t('myfitnesspalImport.weightUnit')}</Label>
          <Select
            value={weightUnit}
            onValueChange={(val) =>
              setWeightUnit(val as MyFitnessPalWeightUnit)
            }
          >
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="lb">lb</SelectItem>
              <SelectItem value="kg">kg</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground">
            {t('myfitnesspalImport.weightUnitHint')}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label>{t('myfitnesspalImport.domains')}</Label>
        <div className="flex flex-col gap-2">
          {DOMAINS.map((domain) => (
            <label
              key={domain}
              className="flex cursor-pointer items-center gap-2 text-sm"
            >
              <Checkbox
                checked={selectedDomains.has(domain)}
                onCheckedChange={() => toggleDomain(domain)}
              />
              <span>
                {t(`myfitnesspalImport.${DOMAIN_LABEL_KEYS[domain]}`)}
              </span>
            </label>
          ))}
        </div>
      </div>

      {result && (
        <div className="rounded-md border p-3">
          <p className="mb-2 font-medium">
            {t('myfitnesspalImport.resultTitle')}
          </p>
          <div className="flex flex-col gap-1 text-sm">
            {DOMAINS.map((domain) => (
              <div key={domain} className="flex justify-between">
                <span>
                  {t(`myfitnesspalImport.${DOMAIN_LABEL_KEYS[domain]}`)}
                </span>
                <span className="text-muted-foreground">
                  {domainSummary(domain)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {t('myfitnesspalImport.error')}: {error}
        </div>
      )}

      <Button
        type="button"
        onClick={handleImport}
        disabled={isPending || !file || selectedDomains.size === 0}
        className="flex items-center gap-2"
      >
        {isPending ? (
          <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-white" />
        ) : (
          <Upload className="h-4 w-4" />
        )}
        {isPending
          ? t('myfitnesspalImport.importing')
          : t('myfitnesspalImport.import')}
      </Button>
    </div>
  );
};

export default MyFitnessPalImport;
